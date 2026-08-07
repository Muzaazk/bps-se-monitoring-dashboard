/**
 * CACHE.gs — Multi-Layer Caching Engine for BPS SE 2026 Dashboard
 * 
 * Layer 1 — Google Drive (Master Cache):
 *   Stores full JSON master files (metadata.json, hierarchy.json, summary.json, desa_data.json)
 *   Created & updated ONLY during "Refresh Data". Primary data source after Spreadsheet.
 * 
 * Layer 2 — CacheService (Fast RAM Cache):
 *   Google Cloud RAM cache (50ms ultra fast response).
 *   Caches fast-access JSON data for summary & hierarchy.
 * 
 * Layer 3 — ScriptProperties (Metadata Only):
 *   Stores ONLY lightweight configuration strings (<1KB total):
 *   Folder ID, File IDs, Cache Version, Refresh Timestamp.
 *   NO DATASETS ARE STORED IN SCRIPT PROPERTIES!
 */

var PROP_KEYS = {
  VERSION_MARKER:   "SE2026_CACHE_VER",
  TIMESTAMP_MARKER: "SE2026_CACHE_TIME",
  FOLDER_ID:        "SE2026_DRIVE_FOLDER_ID",
  FILE_ID_META:     "SE2026_FILE_META",
  FILE_ID_HIER:     "SE2026_FILE_HIER",
  FILE_ID_SUMM:     "SE2026_FILE_SUMM",
  FILE_ID_DESA:     "SE2026_FILE_DESA",
  FILE_ID_SLS:      "SE2026_FILE_SLS",
  REFRESH_USER:     "SE2026_REFRESH_USER"
};

/**
 * Gets cache version tag
 * @return {string}
 */
function getCacheVersionTag() {
  return (CONFIG.CACHE_VERSION || "v2.1.0") + "_" + (CONFIG.SPREADSHEET_ID || "active");
}

// ============================================================================
// LAYER 3 — ScriptProperties (Metadata Only)
// ============================================================================

/**
 * Reads all metadata from ScriptProperties
 * @return {Object} Metadata object
 */
function getCacheMetadataProps() {
  try {
    var props = PropertiesService.getScriptProperties();
    return {
      version:      props.getProperty(PROP_KEYS.VERSION_MARKER),
      timestamp:    props.getProperty(PROP_KEYS.TIMESTAMP_MARKER),
      folderId:     props.getProperty(PROP_KEYS.FOLDER_ID),
      fileMetaId:   props.getProperty(PROP_KEYS.FILE_ID_META),
      fileHierId:   props.getProperty(PROP_KEYS.FILE_ID_HIER),
      fileSummId:   props.getProperty(PROP_KEYS.FILE_ID_SUMM),
      fileDesaId:   props.getProperty(PROP_KEYS.FILE_ID_DESA),
      fileSlsId:    props.getProperty(PROP_KEYS.FILE_ID_SLS),
      refreshUser:  props.getProperty(PROP_KEYS.REFRESH_USER)
    };
  } catch (e) {
    Logger.log("Error reading cache metadata props: " + e.message);
    return {};
  }
}

/**
 * Checks if Master Cache exists and is valid
 * @return {boolean}
 */
function isMasterCacheValid() {
  try {
    var meta = getCacheMetadataProps();
    if (!meta.version || meta.version !== getCacheVersionTag()) return false;
    if (!meta.folderId || !meta.fileMetaId || !meta.fileHierId || !meta.fileSummId || !meta.fileDesaId || !meta.fileSlsId) return false;
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Saves metadata properties to ScriptProperties (Metadata ONLY, < 1KB)
 * @param {Object} metaObj Properties object
 */
function saveCacheMetadataProps(metaObj) {
  try {
    var props = PropertiesService.getScriptProperties();
    var toSave = {};
    toSave[PROP_KEYS.VERSION_MARKER]   = getCacheVersionTag();
    toSave[PROP_KEYS.TIMESTAMP_MARKER] = String(new Date().getTime());
    
    if (metaObj.folderId)   toSave[PROP_KEYS.FOLDER_ID]   = metaObj.folderId;
    if (metaObj.fileMetaId) toSave[PROP_KEYS.FILE_ID_META] = metaObj.fileMetaId;
    if (metaObj.fileHierId) toSave[PROP_KEYS.FILE_ID_HIER] = metaObj.fileHierId;
    if (metaObj.fileSummId) toSave[PROP_KEYS.FILE_ID_SUMM] = metaObj.fileSummId;
    if (metaObj.fileDesaId) toSave[PROP_KEYS.FILE_ID_DESA] = metaObj.fileDesaId;
    if (metaObj.fileSlsId)  toSave[PROP_KEYS.FILE_ID_SLS]  = metaObj.fileSlsId;
    
    try {
      var userEmail = Session.getActiveUser().getEmail();
      if (userEmail) toSave[PROP_KEYS.REFRESH_USER] = userEmail;
    } catch (uErr) {}

    props.setProperties(toSave);
    Logger.log("Layer 3 Metadata Properties updated successfully.");
  } catch (e) {
    Logger.log("Error saving cache metadata props: " + e.message);
  }
}

// ============================================================================
// LAYER 1 — Google Drive Master JSON Cache
// ============================================================================

/**
 * Gets or creates the Master Cache Folder in Google Drive
 * @return {Folder} Google Drive Folder instance
 */
function getOrCreateCacheFolder() {
  var folderName = CONFIG.CACHE_FOLDER_NAME || "BPS_SE_Dashboard_Cache";
  var meta = getCacheMetadataProps();
  
  if (meta.folderId) {
    try {
      return DriveApp.getFolderById(meta.folderId);
    } catch (e) {
      Logger.log("Stored folder ID invalid, searching by name: " + e.message);
    }
  }
  
  var folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  
  var newFolder = DriveApp.createFolder(folderName);
  Logger.log("Created new Google Drive Master Cache folder: " + folderName);
  return newFolder;
}

/**
 * Saves/replaces a Master JSON file in Google Drive Cache folder
 * @param {Folder} folder Google Drive Folder instance
 * @param {string} fileName Name of JSON file (e.g. se2026_summary.json)
 * @param {string} content Stringified JSON content
 * @return {string} File ID in Google Drive
 */
function saveDriveMasterJson(folder, fileName, content) {
  try {
    var files = folder.getFilesByName(fileName);
    if (files.hasNext()) {
      var existingFile = files.next();
      existingFile.setContent(content);
      Logger.log("Updated Layer 1 Master File: " + fileName + " (" + (content.length / 1024).toFixed(1) + " KB)");
      return existingFile.getId();
    } else {
      var newFile = folder.createFile(fileName, content, MimeType.PLAIN_TEXT);
      Logger.log("Created Layer 1 Master File: " + fileName + " (" + (content.length / 1024).toFixed(1) + " KB)");
      return newFile.getId();
    }
  } catch (e) {
    Logger.log("Error saving Layer 1 Master File " + fileName + ": " + e.message);
    throw new Error("Gagal menyimpan file master di Google Drive: " + e.message);
  }
}

/**
 * Reads content of a Master JSON file from Google Drive
 * @param {string} fileId Google Drive File ID
 * @return {string|null} File content string
 */
function readDriveMasterJson(fileId) {
  try {
    if (!fileId) return null;
    var file = DriveApp.getFileById(fileId);
    return file.getBlob().getDataAsString();
  } catch (e) {
    Logger.log("Error reading Layer 1 Master File ID " + fileId + ": " + e.message);
    return null;
  }
}

// ============================================================================
// LAYER 2 — CacheService (Fast RAM Cache)
// ============================================================================

/**
 * Stores content in RAM Cache (CacheService) with chunking for large strings
 * @param {string} ramKey Key identifier
 * @param {string} jsonString Payload string
 * @param {number} [ttlSec] Time to live in seconds (default 6 hours = 21600)
 */
function putRamCache(ramKey, jsonString, ttlSec) {
  try {
    if (!jsonString) return;
    var ttl = ttlSec || 21600;
    var cache = CacheService.getScriptCache();
    
    // Chunking for RAM Cache (max 100KB per key, 80KB chunks safe)
    var chunkSize = 80000;
    if (jsonString.length <= chunkSize) {
      cache.put(ramKey, jsonString, ttl);
      cache.put(ramKey + "_count", "1", ttl);
    } else {
      var count = Math.ceil(jsonString.length / chunkSize);
      cache.put(ramKey + "_count", String(count), ttl);
      for (var i = 0; i < count; i++) {
        var part = jsonString.substring(i * chunkSize, (i + 1) * chunkSize);
        cache.put(ramKey + "_part_" + i, part, ttl);
      }
    }
  } catch (e) {
    Logger.log("RAM Cache put failed for key " + ramKey + ": " + e.message);
  }
}

/**
 * Retrieves content from RAM Cache (CacheService)
 * @param {string} ramKey Key identifier
 * @return {string|null} Payload string or null if miss
 */
function getRamCache(ramKey) {
  try {
    var cache = CacheService.getScriptCache();
    var countStr = cache.get(ramKey + "_count");
    if (!countStr) return null;
    
    var count = parseInt(countStr, 10);
    if (count === 1) {
      return cache.get(ramKey);
    }
    
    var parts = [];
    for (var i = 0; i < count; i++) {
      var p = cache.get(ramKey + "_part_" + i);
      if (!p) return null; // Incomplete RAM chunk
      parts.push(p);
    }
    return parts.join("");
  } catch (e) {
    Logger.log("RAM Cache get failed for key " + ramKey + ": " + e.message);
    return null;
  }
}

/**
 * Clears all RAM cache entries
 */
function clearRamCache() {
  try {
    var cache = CacheService.getScriptCache();
    var keys = ["metadata", "hierarchy", "summary", "desa_data", "sls_data"];
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      cache.remove(k);
      cache.remove(k + "_count");
      for (var p = 0; p < 20; p++) {
        cache.remove(k + "_part_" + p);
      }
    }
    Logger.log("Layer 2 RAM Cache cleared.");
  } catch (e) {
    Logger.log("Error clearing RAM Cache: " + e.message);
  }
}

/**
 * Total Purge — Clears RAM Cache and ScriptProperties Metadata
 */
function purgeAllCache() {
  clearRamCache();
  try {
    PropertiesService.getScriptProperties().deleteAllProperties();
    Logger.log("Layer 3 Metadata & Layer 2 RAM fully purged.");
  } catch (e) {
    Logger.log("Error purging all cache: " + e.message);
  }
}
