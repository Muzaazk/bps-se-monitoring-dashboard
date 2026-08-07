/**
 * UTILS.gs
 * Helper functions and utilities for BPS SE Dashboard
 */

/**
 * Inclusions for templated HTML files
 * @param {string} filename The name of the HTML file (without extension)
 * @return {string} The content of the HTML file
 */
function include(filename) {
  try {
    return HtmlService.createHtmlOutputFromFile(filename).getContent();
  } catch (e) {
    Logger.log("Error including file: " + filename + ". Error: " + e.message);
    return "<!-- ERROR: HTML file '" + filename + "' not found or could not be loaded. -->";
  }
}

/**
 * Identifies the administrative level of a BPS code based on its length.
 * @param {string} code The BPS region code
 * @return {number} Level index (0 = Kabupaten, 1 = Kecamatan, 2 = Desa, 3 = SLS, 4 = Sub-SLS) or -1 if invalid
 */
function getBpsLevel(code) {
  if (code === undefined || code === null) return -1;
  var codeStr = String(code).trim();
  if (!/^\d+$/.test(codeStr)) return -1; // Must be numeric digits only
  
  switch (codeStr.length) {
    case 4:  return 0; // Kabupaten
    case 7:  return 1; // Kecamatan
    case 10: return 2; // Desa/Kelurahan
    case 14: return 3; // SLS
    case 16: return 4; // Sub-SLS
    default: return -1;
  }
}

/**
 * Returns the human-readable name of the administrative level
 * @param {number} level The level index (0-4)
 * @return {string} The name of the level in Indonesian
 */
function getBpsLevelName(level) {
  switch (level) {
    case 0:  return "Kabupaten";
    case 1:  return "Kecamatan";
    case 2:  return "Desa/Kelurahan";
    case 3:  return "SLS";
    case 4:  return "Sub-SLS";
    default: return "Tidak Diketahui";
  }
}

/**
 * Resolves the parent code of a BPS region code
 * @param {string} code The BPS region code
 * @return {string} The parent region code, or empty string if top level / invalid
 */
function getParentCode(code) {
  if (!code) return "";
  var codeStr = String(code).trim();
  var level = getBpsLevel(codeStr);
  
  switch (level) {
    case 0: // Kabupaten is top level
      return "";
    case 1: // Kecamatan -> Kabupaten
      return codeStr.substring(0, 4);
    case 2: // Desa -> Kecamatan
      return codeStr.substring(0, 7);
    case 3: // SLS -> Desa
      return codeStr.substring(0, 10);
    case 4: // Sub-SLS -> SLS
      return codeStr.substring(0, 14);
    default:
      return "";
  }
}

/**
 * Safely parses numeric cells from spreadsheets (handles comma decimals e.g. "35,19").
 * @param {any} value Raw value
 * @return {number} Clean float or integer value
 */
function safeParseNumber(value) {
  if (value === undefined || value === null || value === "") {
    return 0;
  }
  if (typeof value === "number") {
    return isNaN(value) ? 0 : value;
  }
  // Strip zero-width space, non-breaking space, currency symbols, and replace comma decimal
  var str = String(value)
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")
    .trim()
    .replace(/\s/g, "")
    .replace(/,/g, ".");
  
  var num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

/**
 * Strips zero-width unicode characters and sanitizes text strings
 * @param {any} value Raw string
 * @return {string} Clean string
 */
function stripZeroWidthSpace(value) {
  if (value === undefined || value === null) return "";
  return String(value)
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")
    .trim();
}

/**
 * Checks if a BPS code is a valid numeric BPS code
 * @param {any} code The value to test
 * @return {boolean} True if it is a valid BPS code length and format
 */
function isValidBpsCode(code) {
  if (code === undefined || code === null) return false;
  var codeStr = String(code).trim();
  if (!/^\d+$/.test(codeStr)) return false;
  var len = codeStr.length;
  return len === 4 || len === 7 || len === 10 || len === 14 || len === 16;
}

/**
 * Calculates statistical metrics (Mean, Median, Min, Max, Sum) for an array of numbers
 * @param {number[]} numbers Array of numeric values
 * @return {Object} Summary statistics
 */
function calculateArrayStats(numbers) {
  if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
    return { count: 0, sum: 0, mean: 0, median: 0, min: 0, max: 0 };
  }
  
  var validNums = [];
  var sum = 0;
  for (var i = 0; i < numbers.length; i++) {
    var val = safeParseNumber(numbers[i]);
    validNums.push(val);
    sum += val;
  }
  
  if (validNums.length === 0) {
    return { count: 0, sum: 0, mean: 0, median: 0, min: 0, max: 0 };
  }
  
  validNums.sort(function(a, b) { return a - b; });
  
  var count = validNums.length;
  var mean = sum / count;
  var min = validNums[0];
  var max = validNums[count - 1];
  
  var median = 0;
  var mid = Math.floor(count / 2);
  if (count % 2 === 0) {
    median = (validNums[mid - 1] + validNums[mid]) / 2;
  } else {
    median = validNums[mid];
  }
  
  return {
    count: count,
    sum: Math.round(sum * 100) / 100,
    mean: Math.round(mean * 100) / 100,
    median: Math.round(median * 100) / 100,
    min: min,
    max: max
  };
}

