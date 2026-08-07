/**
 * TEST DEBUG — Jalankan function ini dari editor GAS untuk diagnosa masalah
 * Pilih "testKoneksi" di dropdown → klik ▶️ Jalankan → lihat Log eksekusi
 */

function testKoneksi() {
  Logger.log("=== MULAI TEST KONEKSI ===");
  
  // Test 1: Cek CONFIG
  Logger.log("Test 1 — CONFIG.SPREADSHEET_ID = '" + CONFIG.SPREADSHEET_ID + "'");
  if (!CONFIG.SPREADSHEET_ID || CONFIG.SPREADSHEET_ID.trim() === "") {
    Logger.log("❌ GAGAL: SPREADSHEET_ID kosong! Isi di Config.gs");
    return;
  }
  Logger.log("✅ SPREADSHEET_ID terisi");

  // Test 2: Cek bisa buka Spreadsheet
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    Logger.log("Test 2 — Spreadsheet terbuka: " + ss.getName());
    Logger.log("✅ Koneksi Spreadsheet berhasil");
  } catch (e) {
    Logger.log("❌ GAGAL buka Spreadsheet: " + e.message);
    Logger.log("Cek: 1) ID benar? 2) Akun punya akses?");
    return;
  }

  // Test 3: Cek sheet yang ada
  var sheets = ss.getSheets();
  Logger.log("Test 3 — Jumlah sheet: " + sheets.length);
  for (var i = 0; i < sheets.length; i++) {
    Logger.log("  Sheet " + i + ": '" + sheets[i].getName() + "'");
  }

  // Test 4: Cek baca data dari sheet pertama
  try {
    var firstSheet = sheets[0];
    var data = firstSheet.getRange(1, 1, 5, 5).getValues();
    Logger.log("Test 4 — 5 baris pertama sheet '" + firstSheet.getName() + "':");
    for (var r = 0; r < data.length; r++) {
      Logger.log("  Baris " + (r+1) + ": " + JSON.stringify(data[r]));
    }
    Logger.log("✅ Baca data berhasil");
  } catch (e) {
    Logger.log("❌ GAGAL baca data: " + e.message);
    return;
  }

  // Test 5: Cek getInitialPayloadServer
  try {
    Logger.log("Test 5 — Menjalankan getInitialPayloadServer()...");
    var result = getInitialPayloadServer();
    var parsed = JSON.parse(result);
    Logger.log("Status: " + parsed.status);
    if (parsed.status === "success") {
      var regionCount = Object.keys(parsed.data.regions || {}).length;
      var sheetCount = Object.keys(parsed.data.metadata.sheets || {}).length;
      Logger.log("✅ SUKSES! Regions: " + regionCount + ", Sheets: " + sheetCount);
      Logger.log("Payload size: " + result.length + " bytes");
    } else {
      Logger.log("❌ GAGAL: " + parsed.message);
    }
  } catch (e) {
    Logger.log("❌ GAGAL getInitialPayloadServer: " + e.message);
  }

  Logger.log("=== TEST SELESAI ===");
}
