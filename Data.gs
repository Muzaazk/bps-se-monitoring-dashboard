/**
 * DATA.gs — Data Engine & Master Cache Manager
 * 
 * ALUR DATA:
 *   Spreadsheet ──(Refresh Data)──> Parser ──> Master JSON (Google Drive)
 *                                                    │
 *                                                    ├─> RAM Cache (CacheService)
 *                                                    │          │
 *                                                    └──────────┴──> Frontend
 */

/**
 * Resolves active or target spreadsheet instance safely
 * @return {Spreadsheet}
 */
function getSpreadsheet() {
  try {
    var id = (CONFIG.SPREADSHEET_ID || "").trim();
    if (id) {
      return SpreadsheetApp.openById(id);
    }
    var activeSs = SpreadsheetApp.getActiveSpreadsheet();
    if (activeSs) {
      return activeSs;
    }
    throw new Error("Spreadsheet tidak terhubung! Silakan isi SPREADSHEET_ID Anda pada file Config.gs.");
  } catch (e) {
    Logger.log("Error opening spreadsheet: " + e.message);
    throw new Error("Gagal membuka Spreadsheet: " + e.message);
  }
}

/**
 * Builds header hierarchy paths dynamically from multi-level header rows
 * @param {Array[]} headerRows Matrix of header rows
 * @param {number} numCols Total columns
 * @return {string[]} Array of combined header title paths
 */
function buildHeaderPaths(headerRows, numCols) {
  var paths = [];
  var nR = headerRows.length;
  for (var c = 0; c < numCols; c++) {
    var parts = [];
    for (var r = 0; r < nR; r++) {
      var val = stripZeroWidthSpace((headerRows[r] || [])[c] || "");
      if (val === "" && c > 0) {
        var b = c - 1;
        while (b >= 0 && stripZeroWidthSpace((headerRows[r] || [])[b] || "") === "") b--;
        if (b >= 0) val = stripZeroWidthSpace((headerRows[r] || [])[b]);
      }
      if (val && !/^\(\d+\)$/.test(val)) parts.push(val);
    }
    var uniq = [];
    for (var k = 0; k < parts.length; k++) {
      if (k === 0 || parts[k] !== parts[k - 1]) uniq.push(parts[k]);
    }
    paths.push(uniq.join(" > "));
  }
  return paths;
}

/**
 * Identifies key indicator column indices dynamically based on header titles
 * @param {string} sheetName Sheet title
 * @param {string[]} paths Combined header paths
 * @return {Object} Key column mapping
 */
function identifyKeyColumns(sheetName, paths) {
  var m = {};
  var has = function (p, words) {
    var pl = p.toLowerCase();
    for (var i = 0; i < words.length; i++) {
      if (pl.indexOf(words[i]) < 0) return false;
    }
    return true;
  };
  for (var i = 0; i < paths.length; i++) {
    var p = paths[i];
    if (sheetName === "PROGRES PENDATAAN") {
      if (has(p, ["prelist"])) m.prelist = i;
      if (has(p, ["responden didata"]) && !has(p, ["persen"])) m.didata = i;
      if ((has(p, ["sedang didata"]) || has(p, ["draft"])) && !has(p, ["persen"])) m.draft = i;
    } else if (sheetName === "SKALA USAHA") {
      if (has(p, ["prelist", "ub"])) m.prelist_ub = i;
      if (has(p, ["prelist", "um"]) && !has(p, ["umk"])) m.prelist_um = i;
      if (has(p, ["prelist", "umk"])) m.prelist_umk = i;
      if (has(p, ["bku", "ub"]) && !has(p, ["persen"])) m.usaha_ub = i;
      if (has(p, ["bku", "um"]) && !has(p, ["umk"]) && !has(p, ["persen"])) m.usaha_umk = i;
      if (has(p, ["bku", "umk"]) && !has(p, ["persen"])) m.usaha_umk = i;
      if (has(p, ["total usaha"]) && !has(p, ["persen"])) m.total_usaha = i;
    } else if (sheetName === "PROPORSI PERTANIAN NON PERTANIA") {
      if (has(p, ["bku", "ditemukan", "pertanian"]) && !has(p, ["persen"]) && !has(p, ["non"])) m.bku_ditemukan_tani = i;
      if (has(p, ["bku", "ditemukan", "non pertanian"])) m.bku_ditemukan_nontani = i;
      if (has(p, ["bku", "baru", "pertanian"]) && !has(p, ["persen"]) && !has(p, ["non"])) m.bku_baru_tani = i;
      if (has(p, ["bku", "baru", "non pertanian"])) m.bku_baru_nontani = i;
      if (has(p, ["keluarga", "ditemukan", "pertanian"]) && !has(p, ["persen"]) && !has(p, ["non"])) m.kel_ditemukan_tani = i;
      if (has(p, ["keluarga", "ditemukan", "non pertanian"])) m.kel_ditemukan_nontani = i;
      if (has(p, ["keluarga", "baru", "pertanian"]) && !has(p, ["persen"]) && !has(p, ["non"])) m.kel_baru_tani = i;
      if (has(p, ["keluarga", "baru", "non pertanian"])) m.kel_baru_nontani = i;
    } else if (sheetName === "KESELURUHAN USAHA") {
      if (has(p, ["prelist usaha"]) && !has(p, ["keluarga"])) m.prelist_bku = i;
      if (has(p, ["prelist usaha keluarga"])) m.prelist_kel = i;
      if (has(p, ["total prelist"])) m.prelist_total = i;
      if (has(p, ["total usaha"]) && !has(p, ["persen"])) m.total_usaha = i;
    } else if (sheetName === "JARINGAN USAHA") {
      if (has(p, ["tunggal"])) m.jaringan_tunggal = i;
      if (has(p, ["kantor pusat"])) m.jaringan_pusat = i;
      if (has(p, ["cabang"])) m.jaringan_cabang = i;
      if (has(p, ["perwakilan"])) m.jaringan_perwakilan = i;
      if (has(p, ["pabrik"])) m.jaringan_pabrik = i;
      if (has(p, ["unit pembantu"])) m.jaringan_pembantu = i;
    }
  }
  return m;
}

/**
 * Fast Data Audit for Level 0-2 rows
 * @param {string} sheetName Sheet title
 * @param {Array[]} values Raw matrix
 * @param {number} dataStartIdx Row index where data starts
 * @return {Object[]} Array of audit warnings
 */
function auditSheetData(sheetName, values, dataStartIdx) {
  var warnings = [];
  try {
    var seenCodes = {};
    for (var i = dataStartIdx; i < values.length; i++) {
      var row = values[i];
      if (!row || row.length === 0) continue;
      
      var rawCode = String(row[0] || "").trim();
      var rawName = String(row[1] || "").trim();
      var lineNo = i + 1;
      
      if (!rawCode && !rawName) continue;
      if (rawName === "TOTAL" || rawCode === "Catatan" || rawCode === "Sumber") continue;
      
      if (!rawCode) {
        warnings.push({
          sheet: sheetName, line: lineNo, code: rawCode,
          issue: "Kode Wilayah Kosong", severity: "HIGH",
          details: "Baris " + lineNo + " memiliki nama '" + rawName + "' tetapi kodenya kosong."
        });
        continue;
      }
      
      if (!isValidBpsCode(rawCode)) {
        if (rawCode.length > 20 || /persentase|total/i.test(rawCode)) continue;
        warnings.push({
          sheet: sheetName, line: lineNo, code: rawCode,
          issue: "Format Kode Wilayah Tidak Valid", severity: "MEDIUM",
          details: "Kode '" + rawCode + "' (panjang " + rawCode.length + " digit) tidak sesuai standar BPS."
        });
        continue;
      }
      
      if (seenCodes[rawCode]) {
        warnings.push({
          sheet: sheetName, line: lineNo, code: rawCode,
          issue: "Kode Wilayah Duplikat", severity: "HIGH",
          details: "Kode '" + rawCode + "' terdeteksi lebih dari satu kali (baris " + seenCodes[rawCode] + " dan " + lineNo + ")."
        });
      } else {
        seenCodes[rawCode] = lineNo;
      }
      
      if (!rawName) {
        warnings.push({
          sheet: sheetName, line: lineNo, code: rawCode,
          issue: "Nama Wilayah Kosong", severity: "MEDIUM",
          details: "Kode '" + rawCode + "' tidak memiliki nama wilayah."
        });
      }
    }
  } catch (e) {
    Logger.log("Error in auditSheetData: " + e.message);
  }
  return warnings;
}

// ============================================================================
// MASTER CACHE REBUILD & REFRESH DATA (Spreadsheet -> Drive Master JSON)
// ============================================================================

/**
 * MASTER PROCESS: Reads Spreadsheet, builds Master Datasets, and saves to Google Drive JSON.
 * Triggered ONLY when user clicks "Segarkan Data Cache" or during first setup.
 * @return {Object} Master cache build summary
 */
function buildAndPersistMasterCache() {
  var startTime = new Date().getTime();
  Logger.log("=== MULAI SINKRONISASI SPREADSHEET KE MASTER CACHE GOOGLE DRIVE ===");
  
  try {
    var ss          = getSpreadsheet();
    var ssId        = ss.getId();
    var sheets      = ss.getSheets();
    var metaSheets  = {};
    var hierarchy   = {}; // Tree: code -> { name, level, parent }
    var summaryData = {}; // Kab + 27 Kec cell values
    var desaData    = {}; // 461 Desa cell values
    var slsData     = {}; // SLS / Sub-SLS cell values
    var allWarnings = [];

    for (var si = 0; si < sheets.length; si++) {
      var sheet = sheets[si];
      var sName = sheet.getName();
      if (sName.charAt(0) === "_" || sName === "Cache") continue;

      try {
        var allVals = sheet.getDataRange().getValues();
        if (!allVals || allVals.length < 5) continue;

        // Find numbering row index (row with "(1)")
        var numRowIdx = 3;
        var limit = Math.min(allVals.length, 10);
        outerLoop:
        for (var i = 0; i < limit; i++) {
          for (var j = 0; j < Math.min((allVals[i] || []).length, 5); j++) {
            if (stripZeroWidthSpace(String(allVals[i][j] || "")) === "(1)") {
              numRowIdx = i;
              break outerLoop;
            }
          }
        }

        var headerRows = [];
        for (var h = 1; h <= numRowIdx; h++) headerRows.push(allVals[h] || []);
        var numCols = (headerRows[0] || []).length;
        var hPaths  = buildHeaderPaths(headerRows, numCols);
        var keyCols = identifyKeyColumns(sName, hPaths);
        var warnings = auditSheetData(sName, allVals, numRowIdx + 1);

        metaSheets[sName] = {
          headers:      headerRows,
          headerPaths:  hPaths,
          keyColumns:   keyCols,
          columnsCount: numCols
        };

        if (warnings && warnings.length > 0) {
          allWarnings = allWarnings.concat(warnings);
        }

        // Process data rows
        for (var ri = numRowIdx + 1; ri < allVals.length; ri++) {
          var row   = allVals[ri];
          if (!row || row.length === 0) continue;

          var code  = String(row[0] || "").trim();
          var wname = stripZeroWidthSpace(String(row[1] || ""));

          if (wname === "TOTAL" || code === "Catatan" || code === "Sumber") continue;
          if (code === "" && wname === "") continue;
          if (!isValidBpsCode(code)) continue;

          var lv = getBpsLevel(code);
          var parentCode = getParentCode(code);
          var cellValues = row.slice(2);

          // 1. Store in Hierarchy Tree (Level 0-2)
          if (lv >= 0 && lv <= 2) {
            if (!hierarchy[code]) {
              hierarchy[code] = {
                name:      wname,
                level:     lv,
                levelName: getBpsLevelName(lv),
                parent:    parentCode
              };
            }
          }

          // 2. Store Cell Values by Level
          if (lv === 0 || lv === 1) { // Kabupaten & Kecamatan
            if (!summaryData[code]) {
              summaryData[code] = {
                name:      wname,
                level:     lv,
                levelName: getBpsLevelName(lv),
                parent:    parentCode,
                sheets:    {}
              };
            }
            summaryData[code].sheets[sName] = cellValues;
          } else if (lv === 2) { // Desa
            if (!desaData[code]) {
              desaData[code] = {
                name:      wname,
                level:     2,
                levelName: "Desa/Kelurahan",
                parent:    parentCode,
                sheets:    {}
              };
            }
            desaData[code].sheets[sName] = cellValues;
          } else if (lv === 3 || lv === 4) { // SLS / Sub-SLS
            if (!slsData[code]) {
              slsData[code] = {
                name:      wname,
                level:     lv,
                levelName: getBpsLevelName(lv),
                parent:    parentCode,
                sheets:    {}
              };
            }
            slsData[code].sheets[sName] = cellValues;
          }
        }

      } catch (sheetErr) {
        Logger.log("Error parsing sheet " + sName + ": " + sheetErr.message);
      }
    }

    var now = new Date().toISOString();
    
    // Construct 4 JSON Master Objects
    var metaObj = {
      metadata: {
        appName:       CONFIG.APP_NAME,
        version:       CONFIG.APP_VERSION,
        cacheVersion:  getCacheVersionTag(),
        lastUpdated:   now,
        spreadsheetId: ssId,
        sheets:        metaSheets
      },
      audit: {
        status:        allWarnings.length === 0 ? "PASS" : "WARNING",
        warningsCount: allWarnings.length,
        warnings:      allWarnings.slice(0, 100)
      }
    };

    var metaJsonStr = JSON.stringify(metaObj);
    var hierJsonStr = JSON.stringify(hierarchy);
    var summJsonStr = JSON.stringify(summaryData);
    var desaJsonStr = JSON.stringify(desaData);
    var slsJsonStr  = JSON.stringify(slsData);

    // Save to Layer 1 (Google Drive Master JSON)
    var cacheFolder = getOrCreateCacheFolder();
    var metaFileId  = saveDriveMasterJson(cacheFolder, CONFIG.CACHE_FILES.METADATA, metaJsonStr);
    var hierFileId  = saveDriveMasterJson(cacheFolder, CONFIG.CACHE_FILES.HIERARCHY, hierJsonStr);
    var summFileId  = saveDriveMasterJson(cacheFolder, CONFIG.CACHE_FILES.SUMMARY, summJsonStr);
    var desaFileId  = saveDriveMasterJson(cacheFolder, CONFIG.CACHE_FILES.DESA_DATA, desaJsonStr);
    var slsFileId   = saveDriveMasterJson(cacheFolder, CONFIG.CACHE_FILES.SLS_DATA, slsJsonStr);

    // Save to Layer 2 (RAM Cache Warmup)
    putRamCache("metadata", metaJsonStr);
    putRamCache("hierarchy", hierJsonStr);
    putRamCache("summary", summJsonStr);

    // Save to Layer 3 (ScriptProperties Metadata ONLY)
    saveCacheMetadataProps({
      folderId:   cacheFolder.getId(),
      fileMetaId: metaFileId,
      fileHierId: hierFileId,
      fileSummId: summFileId,
      fileDesaId: desaFileId,
      fileSlsId:  slsFileId
    });

    var elapsedSec = ((new Date().getTime() - startTime) / 1000).toFixed(1);
    Logger.log("=== SINKRONISASI MASTER CACHE SELESAI Dalam " + elapsedSec + " detik ===");

    return {
      status: "success",
      elapsedSec: elapsedSec,
      regionsCount: Object.keys(hierarchy).length,
      warningsCount: allWarnings.length,
      audit: metaObj.audit
    };

  } catch (e) {
    Logger.log("Error in buildAndPersistMasterCache: " + e.message);
    throw new Error("Gagal membangun Master Cache: " + e.message);
  }
}

// ============================================================================
// DAILY OPERATIONAL DATA RETRIEVAL (Drive / RAM Cache ONLY, NO SPREADSHEET)
// ============================================================================

/**
 * Initial payload endpoint for Web App.
 * Reads hierarchy + summary + metadata from RAM (Layer 2) or Drive JSON (Layer 1).
 * NEVER READS SPREADSHEET!
 * @return {Object} Structured JSON payload
 */
function getInitialPayload() {
  try {
    // If Master Cache doesn't exist yet, build it for the first time
    if (!isMasterCacheValid()) {
      Logger.log("Master Cache invalid or missing. Performing initial build...");
      buildAndPersistMasterCache();
    }

    var metaProps = getCacheMetadataProps();

    // 1. Try reading from Layer 2 (RAM Cache — 50ms fast response)
    var metaStr = getRamCache("metadata");
    var hierStr = getRamCache("hierarchy");
    var summStr = getRamCache("summary");

    // 2. If RAM Cache miss, fallback to Layer 1 (Google Drive Master JSON)
    if (!metaStr && metaProps.fileMetaId) metaStr = readDriveMasterJson(metaProps.fileMetaId);
    if (!hierStr && metaProps.fileHierId) hierStr = readDriveMasterJson(metaProps.fileHierId);
    if (!summStr && metaProps.fileSummId) summStr = readDriveMasterJson(metaProps.fileSummId);

    // If still missing, rebuild Master Cache
    if (!metaStr || !hierStr || !summStr) {
      Logger.log("Master JSON files unreadable. Rebuilding Master Cache...");
      buildAndPersistMasterCache();
      metaStr = getRamCache("metadata");
      hierStr = getRamCache("hierarchy");
      summStr = getRamCache("summary");
    }

    var metaObj = JSON.parse(metaStr);
    var hierarchy = JSON.parse(hierStr);
    var summaryData = JSON.parse(summStr);

    // Warm up RAM Cache for next request if it was a RAM miss
    putRamCache("metadata", metaStr);
    putRamCache("hierarchy", hierStr);
    putRamCache("summary", summStr);

    // Merge hierarchy tree + summary cell data (Kab + Kec) into active regions map
    var regionsMap = {};
    for (var code in hierarchy) {
      var item = hierarchy[code];
      regionsMap[code] = {
        name:      item.name,
        level:     item.level,
        levelName: getBpsLevelName(item.level),
        parent:    item.parent,
        sheets:    (summaryData[code] && summaryData[code].sheets) ? summaryData[code].sheets : null
      };
    }

    return {
      metadata: metaObj.metadata,
      regions:  regionsMap,
      audit:     metaObj.audit
    };

  } catch (e) {
    Logger.log("Error in getInitialPayload: " + e.message);
    throw new Error("Gagal mengambil payload data: " + e.message);
  }
}

/**
 * Retrieves cell data for all Desas under a Kecamatan code lazily.
 * Reads from Layer 2 RAM or Layer 1 Drive Master JSON (`desa_data.json`).
 * NEVER READS SPREADSHEET!
 * @param {string} kecCode 7-digit Kecamatan code
 * @return {Object} Map of Desa regions with cell data
 */
function getDesaDataForKecamatan(kecCode) {
  var result = {};
  try {
    if (!kecCode || kecCode.length !== 7) return result;

    var metaProps = getCacheMetadataProps();
    var desaStr = getRamCache("desa_data");

    if (!desaStr && metaProps.fileDesaId) {
      desaStr = readDriveMasterJson(metaProps.fileDesaId);
      if (desaStr) putRamCache("desa_data", desaStr); // Warm up RAM
    }

    if (!desaStr) return result;

    var allDesaData = JSON.parse(desaStr);
    for (var code in allDesaData) {
      if (code.indexOf(kecCode) === 0) {
        result[code] = allDesaData[code];
      }
    }

    Logger.log("Loaded " + Object.keys(result).length + " desa from Master Cache for Kecamatan " + kecCode);
  } catch (e) {
    Logger.log("Error in getDesaDataForKecamatan for " + kecCode + ": " + e.message);
  }
  return result;
}

/**
 * Retrieves SLS/Sub-SLS (Level 3-4) regions for a Desa code dynamically.
 * Reads from Layer 2 RAM or Layer 1 Drive Master JSON (`se2026_sls_data.json`).
 * NEVER READS SPREADSHEET!
 * @param {string} desaCode 10-digit Desa code
 * @return {Object} Map of SLS/Sub-SLS regions
 */
function getSLSDataForDesa(desaCode) {
  var slsData = {};
  try {
    if (!desaCode || desaCode.length !== 10) return slsData;

    var metaProps = getCacheMetadataProps();
    var slsStr = getRamCache("sls_data");

    if (!slsStr && metaProps.fileSlsId) {
      slsStr = readDriveMasterJson(metaProps.fileSlsId);
      if (slsStr) putRamCache("sls_data", slsStr); // Warm up RAM
    }

    if (!slsStr) return slsData;

    var allSlsData = JSON.parse(slsStr);
    for (var code in allSlsData) {
      if (code.indexOf(desaCode) === 0) {
        slsData[code] = allSlsData[code];
      }
    }

    Logger.log("Loaded " + Object.keys(slsData).length + " SLS/Sub-SLS from Master Cache for Desa " + desaCode);
  } catch (e) {
    Logger.log("Error in getSLSDataForDesa for " + desaCode + ": " + e.message);
  }
  return slsData;
}

/**
 * Triggers full Master Cache rebuild from Spreadsheet.
 * Called when user clicks "Segarkan Data Cache".
 * @param {boolean} includeHeavyAudit
 * @return {Object} Refresh result summary
 */
function refreshDataCache(includeHeavyAudit) {
  try {
    purgeAllCache();
    return buildAndPersistMasterCache();
  } catch (e) {
    Logger.log("Error refreshing data cache: " + e.message);
    throw new Error("Gagal menyegarkan data dari Spreadsheet: " + e.message);
  }
}
