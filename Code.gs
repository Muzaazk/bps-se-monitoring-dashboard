/**
 * CODE.gs — Controller API & Web App Request Router for BPS SE Dashboard
 */

/**
 * Serves the HTML web app pages
 * @param {Object} e HTTP request parameters
 * @return {HtmlOutput}
 */
function doGet(e) {
  try {
    var template = HtmlService.createTemplateFromFile("Index");
    
    // Set configuration attributes in template
    template.appName = CONFIG.APP_NAME || "Dashboard Progres Sensus Ekonomi BPS Kebumen";
    template.appVersion = CONFIG.APP_VERSION || "2.0.0";
    template.theme = CONFIG.THEME;
    template.fonts = CONFIG.FONTS;
    
    // Evaluate template to allow HTML inclusions
    var output = template.evaluate()
      .setTitle(CONFIG.APP_NAME)
      .addMetaTag("viewport", "width=device-width, initial-scale=1, shrink-to-fit=no")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
      
    return output;
  } catch (e) {
    Logger.log("Fatal Error in doGet: " + e.message);
    return HtmlService.createHtmlOutput(
      "<div style='font-family:sans-serif; padding:40px; text-align:center; color:#721c24; background:#f8d7da; border-radius:8px; margin:20px;'>" +
      "<h2>Terjadi Kesalahan Saat Memuat Aplikasi</h2>" +
      "<p>" + e.message + "</p>" +
      "<p><small>Silakan periksa konfigurasi SPREADSHEET_ID dan izin Google Drive Anda.</small></p>" +
      "</div>"
    );
  }
}

/**
 * Endpoint to load metadata, regions level 0-2 (Kabupaten, Kecamatan), and audit warnings.
 * Reads from Layer 1 Google Drive Master JSON / Layer 2 RAM.
 * @return {string} Serialized JSON payload
 */
function getInitialPayloadServer() {
  try {
    var payload = getInitialPayload();
    return JSON.stringify({
      status: "success",
      data: payload
    });
  } catch (e) {
    Logger.log("Error in getInitialPayloadServer: " + e.message);
    return JSON.stringify({
      status: "error",
      message: "Gagal mengambil data awal: " + e.message
    });
  }
}

/**
 * Endpoint to fetch Desa (Level 2) cell data for all Desas under a Kecamatan, lazily.
 * Reads from Google Drive Master JSON (desa_data.json) / RAM Cache.
 * @param {string} kecCode 7-digit Kecamatan code
 * @return {string} Serialized JSON payload
 */
function getDesaDataServer(kecCode) {
  try {
    if (!kecCode) {
      return JSON.stringify({ status: "error", message: "Kode Kecamatan tidak boleh kosong." });
    }
    var data = getDesaDataForKecamatan(kecCode);
    return JSON.stringify({
      status: "success",
      data: data
    });
  } catch (e) {
    Logger.log("Error in getDesaDataServer for Kec " + kecCode + ": " + e.message);
    return JSON.stringify({
      status: "error",
      message: "Gagal mengambil data Desa untuk Kecamatan " + kecCode + ": " + e.message
    });
  }
}

/**
 * Endpoint to fetch SLS/Sub-SLS (Level 3-4) regions under a specific Desa code dynamically.
 * @param {string} desaCode 10-digit Desa code
 * @return {string} Serialized JSON payload
 */
function getSLSDataServer(desaCode) {
  try {
    if (!desaCode) {
      return JSON.stringify({ status: "error", message: "Kode Desa tidak boleh kosong." });
    }
    var data = getSLSDataForDesa(desaCode);
    return JSON.stringify({
      status: "success",
      data: data
    });
  } catch (e) {
    Logger.log("Error in getSLSDataServer for Desa " + desaCode + ": " + e.message);
    return JSON.stringify({
      status: "error",
      message: "Gagal mengambil data SLS untuk Desa " + desaCode + ": " + e.message
    });
  }
}

/**
 * Endpoint to force rebuild Master JSON Cache in Google Drive from Spreadsheet.
 * Triggered manually by user ("Segarkan Data Cache" button).
 * @return {string} Serialized JSON status
 */
function triggerRefreshCacheServer() {
  try {
    var result = refreshDataCache(true);
    return JSON.stringify({
      status: "success",
      message: "Master JSON Cache di Google Drive berhasil diperbarui dalam " + result.elapsedSec + " detik! (" + result.regionsCount + " wilayah tersimpan)",
      data: result
    });
  } catch (e) {
    Logger.log("Error in triggerRefreshCacheServer: " + e.message);
    return JSON.stringify({
      status: "error",
      message: "Gagal menyegarkan data dari Spreadsheet: " + e.message
    });
  }
}
