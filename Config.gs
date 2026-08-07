/**
 * CONFIG.gs
 * Centralized Configuration for BPS Sensus Ekonomi Dashboard
 */

var CONFIG = {
  // Application Title & Version
  APP_NAME: "Dashboard Progres Sensus Ekonomi BPS Kebumen",
  APP_VERSION: "2.1.1",
  
  // Multi-Layer Cache Configuration (v2.1.1)
  // Layer 1: Master JSON files in Google Drive
  // Layer 2: CacheService RAM (50ms response)
  // Layer 3: ScriptProperties (Metadata & File IDs only)
  CACHE_VERSION: "v2.1.1",
  CACHE_TIMEOUT_SEC: 86400, // 24 hours
  CACHE_FOLDER_NAME: "BPS_SE_Dashboard_Cache",
  CACHE_FILES: {
    METADATA:   "se2026_metadata.json",
    HIERARCHY:  "se2026_hierarchy.json",
    SUMMARY:    "se2026_summary.json",
    DESA_DATA:  "se2026_desa_data.json",
    SLS_DATA:   "se2026_sls_data.json"
  },

  // Spreadsheet ID — WAJIB diisi jika script bukan Bound Script!
  // Cara mendapatkan ID: buka Google Sheets → lihat URL → ambil bagian setelah /d/ dan sebelum /edit
  // Contoh URL: https://docs.google.com/spreadsheets/d/1ABC123XYZ_ID_ANDA/edit
  SPREADSHEET_ID: "1Y8tZH8LJ_E-NTesPKGSVleXFGZxwtbCy3RwemOUL43s",

  // Standard BPS Sheet Names
  SHEET_NAMES: [
    "PROGRES PENDATAAN",
    "SKALA USAHA",
    "USAHA PERUSAHAAN",
    "USAHA KELUARGA",
    "KESELURUHAN USAHA",
    "PROPORSI USAHA",
    "JARINGAN USAHA",
    "PROPORSI PERTANIAN NON PERTANIA"
  ],

  // Administrative Code Length Mapping
  LEVEL_MAP: {
    4:  { level: 0, name: "Kabupaten" },
    7:  { level: 1, name: "Kecamatan" },
    10: { level: 2, name: "Desa/Kelurahan" },
    14: { level: 3, name: "SLS" },
    16: { level: 4, name: "Sub-SLS" }
  },

  // Color Palette BPS Sensus Ekonomi (Modern Sensus Ekonomi Orange)
  THEME: {
    PRIMARY: "#e65100",       // Vibrant Sensus Ekonomi BPS Orange
    PRIMARY_DARK: "#bf360c",  // Dark Warm Orange
    PRIMARY_LIGHT: "#fff3e0", // Light Soft Orange background
    ACCENT: "#0a3c91",        // Secondary BPS Corporate Blue
    ACCENT_LIGHT: "#e8eaf6",  // Light Blue tint
    SUCCESS: "#2e7d32",       // Green success
    WARNING: "#ed6c02",       // Orange warning
    DANGER: "#d32f2f",        // Red alert
    LIGHT_BG: "#fffbf7",      // Soft warm body background
    TEXT_MAIN: "#212529",    // Dark body text
    TEXT_MUTED: "#6c757d"    // Gray text
  },

  // Google Fonts Configuration
  FONTS: {
    FAMILY: "Inter",
    URL: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
  },

  // Table Configuration
  PAGINATION: {
    DEFAULT_PAGE_SIZE: 25,
    PAGE_SIZE_OPTIONS: [10, 25, 50, 100]
  },

  // Data Quality Audit & Validation Rules
  VALIDATION: {
    MAX_PERCENT: 100.0,
    MIN_PERCENT: 0.0,
    ALLOW_NEGATIVE: false,
    PERCENTAGE_TOLERANCE_EPSILON: 0.05
  },

  // Visualizations Default Config
  CHART: {
    BORDER_WIDTH: 2,
    POINT_RADIUS: 4,
    GRID_COLOR: "rgba(0, 0, 0, 0.05)"
  }
};

