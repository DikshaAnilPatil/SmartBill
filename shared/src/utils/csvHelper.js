/**
 * csvHelper.js
 * Utility functions for exporting, importing, and parsing Excel (.xlsx, .xls) and CSV data
 * with UTF-8 BOM support, smart fuzzy column mapping, data cleaning, and upsert handling.
 */
import * as XLSX from "xlsx";

/**
 * Escapes a cell value for standard CSV compatibility.
 */
function escapeCsvCell(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Exports data to a CSV file and triggers browser download.
 * @param {string} filename - Name of the downloaded file (e.g. 'products.csv')
 * @param {Array<{ key: string, label: string }>} columns - Column definitions
 * @param {Array<Object>} rows - Data objects
 */
export function exportToCsv(filename, columns, rows) {
  if (!rows || !columns) return;

  const headerLine = columns.map((col) => escapeCsvCell(col.label || col.key)).join(",");
  const dataLines = rows.map((row) =>
    columns
      .map((col) => {
        const val = typeof col.accessor === "function" ? col.accessor(row) : row[col.key];
        return escapeCsvCell(val);
      })
      .join(",")
  );

  const csvContent = "\uFEFF" + [headerLine, ...dataLines].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename.endsWith(".csv") ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports data to an Excel (.xlsx) file with auto-sized columns and styled header.
 * @param {string} filename - Name of the downloaded file (e.g. 'products.xlsx')
 * @param {string} sheetName - Worksheet title
 * @param {Array<{ key: string, label: string }>} columns - Column definitions
 * @param {Array<Object>} rows - Data objects
 */
export function exportToExcel(filename, sheetName = "Sheet1", columns, rows) {
  if (!rows || !columns) return;

  const header = columns.map((col) => col.label || col.key);
  const data = rows.map((row) =>
    columns.map((col) => {
      if (typeof col.accessor === "function") return col.accessor(row);
      const val = row[col.key];
      return val !== undefined && val !== null ? val : "";
    })
  );

  const aoa = [header, ...data];
  const worksheet = XLSX.utils.aoa_to_sheet(aoa);

  // Set column widths based on maximum content length
  const colWidths = columns.map((col, cIdx) => {
    let maxLen = String(col.label || col.key).length;
    for (const row of data) {
      const cellLen = String(row[cIdx] ?? "").length;
      if (cellLen > maxLen) maxLen = cellLen;
    }
    return { wch: Math.min(Math.max(maxLen + 4, 12), 40) };
  });
  worksheet["!cols"] = colWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const cleanFilename = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  const wbout = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const blob = new Blob([wbout], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", cleanFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Parses raw CSV text content into an array of objects.
 * Handles quoted fields with embedded commas, semicolons, tabs, and line breaks.
 * @param {string} text - Raw CSV text
 * @returns {Array<Object>}
 */
export function parseCsv(text) {
  if (!text || typeof text !== "string") return [];

  const cleanText = text.replace(/^\uFEFF/, "").trim(); // Remove BOM if present
  if (!cleanText) return [];

  // Detect delimiter from first line (comma, semicolon, or tab)
  const firstLine = cleanText.split(/\r?\n/)[0] || "";
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;

  let delimiter = ",";
  if (semiCount > commaCount && semiCount >= tabCount) delimiter = ";";
  else if (tabCount > commaCount && tabCount > semiCount) delimiter = "\t";

  const lines = [];
  let currentLine = [];
  let currentField = "";
  let insideQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++; // Skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === delimiter && !insideQuotes) {
      currentLine.push(currentField.trim());
      currentField = "";
    } else if ((char === "\r" || char === "\n") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") i++;
      currentLine.push(currentField.trim());
      if (currentLine.some((field) => field.length > 0)) {
        lines.push(currentLine);
      }
      currentLine = [];
      currentField = "";
    } else {
      currentField += char;
    }
  }

  // Last field and line
  if (currentField || currentLine.length > 0) {
    currentLine.push(currentField.trim());
    if (currentLine.some((field) => field.length > 0)) {
      lines.push(currentLine);
    }
  }

  if (lines.length < 2) return [];

  const rawHeaders = lines[0].map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const records = [];

  for (let l = 1; l < lines.length; l++) {
    const values = lines[l];
    const record = {};
    for (let c = 0; c < rawHeaders.length; c++) {
      const headerKey = rawHeaders[c];
      if (headerKey) {
        record[headerKey] = values[c] !== undefined ? values[c] : "";
      }
    }
    // Positional column fallbacks
    for (let c = 0; c < values.length; c++) {
      record[`_col${c}`] = values[c] !== undefined ? values[c] : "";
    }
    records.push(record);
  }

  return records;
}

/**
 * Parses an Excel (.xlsx, .xls) or CSV file directly into an array of row objects.
 * @param {File} file
 * @returns {Promise<Array<Object>>}
 */
export async function parseExcelOrCsvFile(file) {
  if (!file) return [];
  const fileName = file.name.toLowerCase();
  const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");

  if (isExcel) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return [];
    const worksheet = workbook.Sheets[sheetName];
    // Return row objects with raw column headers as keys
    const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: "", blankrows: false, raw: false });
    return rawRows;
  } else {
    const text = await file.text();
    return parseCsv(text);
  }
}

/**
 * Cleans and converts any number value (handles currency symbols, commas, percentages, trailing text).
 */
export function cleanImportNumber(val, defaultVal = 0) {
  if (val === undefined || val === null || val === "") return defaultVal;
  if (typeof val === "number") return isNaN(val) ? defaultVal : val;
  const str = String(val)
    .replace(/[₹$,€£%]/g, "")
    .replace(/,/g, "")
    .trim();
  const match = str.match(/^-?\d+(\.\d+)?/);
  if (match) {
    const num = parseFloat(match[0]);
    return isNaN(num) ? defaultVal : num;
  }
  return defaultVal;
}

/**
 * Formats SKU or Barcode string cleanly (prevents scientific notation from Excel).
 */
export function cleanImportSku(val) {
  if (val === undefined || val === null) return "";
  let str = String(val).trim();
  if (str.startsWith("'")) str = str.slice(1);
  return str.trim();
}

/**
 * Standardizes unit strings to system-recognized unit standards.
 */
export function standardizeUnit(val) {
  if (!val) return "Piece";
  const s = String(val).trim().toLowerCase();
  if (["pc", "pcs", "piece", "pieces", "nos", "number", "numbers", "unit", "units"].includes(s))
    return "Piece";
  if (["kg", "kgs", "kilogram", "kilograms", "kilo"].includes(s)) return "Kg";
  if (["gm", "g", "gram", "grams"].includes(s)) return "Gram";
  if (["l", "ltr", "litre", "litres", "liter", "liters"].includes(s)) return "Litre";
  if (["ml", "millilitre", "milliliter"].includes(s)) return "Ml";
  if (["box", "boxes", "pkt", "packet", "packets", "pack", "packs"].includes(s)) return "Box";
  if (["doz", "dozen", "dozens"].includes(s)) return "Dozen";
  if (["m", "mtr", "metre", "metres", "meter", "meters"].includes(s)) return "Metre";
  if (["roll", "rolls"].includes(s)) return "Roll";
  if (["set", "sets"].includes(s)) return "Set";
  return String(val).trim();
}

/**
 * Normalizes imported raw rows into structured product records with validation,
 * smart alias matching, and comparison against existing catalog items.
 *
 * @param {Array<Object>} rawRows - Raw parsed row objects
 * @param {Array<Object>} existingProducts - Current active products list for upsert tagging
 * @returns {{ valid: Array<Object>, errors: Array<string>, summary: { total: number, newCount: number, updateCount: number, errorCount: number } }}
 */
export function normalizeProductImportRows(rawRows = [], existingProducts = []) {
  if (!rawRows || rawRows.length === 0) {
    return {
      valid: [],
      errors: ["The uploaded file is empty or no valid rows could be read."],
      summary: { total: 0, newCount: 0, updateCount: 0, errorCount: 1 },
    };
  }

  // Pre-build lookup maps for existing products by SKU and Name
  const existingSkuMap = new Map();
  const existingNameMap = new Map();
  (existingProducts || []).forEach((p) => {
    if (p.sku) existingSkuMap.set(String(p.sku).trim().toLowerCase(), p);
    if (p.name) existingNameMap.set(String(p.name).trim().toLowerCase(), p);
  });

  const valid = [];
  const errors = [];
  const seenSkusInFile = new Map();

  rawRows.forEach((row, idx) => {
    const rowNum = idx + 2; // 1-based index including header row

    // Build normalized lowercase alphanumeric lookup dictionary for this row
    const cleanDict = {};
    for (const [k, v] of Object.entries(row)) {
      const cleanK = String(k).toLowerCase().replace(/[^a-z0-9]/g, "");
      if (cleanK) {
        cleanDict[cleanK] = v;
      }
    }

    const getVal = (...keys) => {
      for (const k of keys) {
        const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (cleanDict[cleanK] !== undefined && String(cleanDict[cleanK]).trim() !== "") {
          return cleanDict[cleanK];
        }
      }
      return "";
    };

    // Smart multi-alias lookups
    const rawName = getVal(
      "productname",
      "name",
      "itemname",
      "item",
      "product",
      "title",
      "itemdescription",
      "description",
      "particulars",
      "_col0"
    );

    const rawSku = getVal(
      "sku",
      "skubarcode",
      "barcode",
      "barcodesku",
      "itemcode",
      "productcode",
      "code",
      "hsn",
      "hsncode",
      "hsnsac",
      "upc",
      "ean",
      "_col1"
    );

    const rawCategory = getVal(
      "category",
      "itemcategory",
      "productcategory",
      "group",
      "itemgroup",
      "department",
      "type",
      "_col2"
    );

    const rawSupplier = getVal(
      "supplier",
      "suppliername",
      "vendor",
      "vendorname",
      "distributor",
      "manufacturer",
      "_col3"
    );

    const rawPrice = getVal(
      "sellingprice",
      "price",
      "saleprice",
      "salesprice",
      "mrp",
      "rate",
      "unitprice",
      "retailprice",
      "standardprice",
      "_col4"
    );

    const rawCost = getVal(
      "purchasecost",
      "cost",
      "costprice",
      "buyprice",
      "purchaseprice",
      "unitcost",
      "_col5"
    );

    const rawWholesale = getVal("wholesaleprice", "wholesalerate", "wholesale", "bulkprice", "dealerprice");
    const rawMinPrice = getVal("minprice", "minimumprice", "minsellingprice", "minsaleprice", "floorprice");

    const rawStock = getVal(
      "initialstockqty",
      "initialstock",
      "stock",
      "quantity",
      "stockquantity",
      "qty",
      "openingstock",
      "currentstock",
      "stockqty",
      "availablestock",
      "inventory",
      "onhand",
      "_col6"
    );

    const rawMinStock = getVal(
      "minstockalert",
      "minstock",
      "minstocklevel",
      "minimumstock",
      "reorderlevel",
      "reorderpoint",
      "alertqty",
      "lowstockalert",
      "_col7"
    );

    const rawGst = getVal("gstrate", "gst", "gstpercent", "tax", "taxrate", "taxpercent", "vat", "_col8");
    const rawUnit = getVal("unitpiecekgbox", "unit", "uom", "measurementunit", "unitofmeasure", "packing", "_col9");
    const rawStatus = getVal("status", "active", "itemstatus");

    const name = String(rawName || "").trim();
    if (!name) {
      errors.push(`Row ${rowNum}: Product Name is missing.`);
      return;
    }

    const price = cleanImportNumber(rawPrice, 0);
    const cost = cleanImportNumber(rawCost, 0);
    const wholesalePrice = cleanImportNumber(rawWholesale, 0);
    const minPrice = cleanImportNumber(rawMinPrice, 0);
    const stock = cleanImportNumber(rawStock, 0);
    const minStock = cleanImportNumber(rawMinStock, 10);
    const gst = cleanImportNumber(rawGst, 0);
    const category = String(rawCategory || "General").trim() || "General";
    const supplier = String(rawSupplier || "").trim();
    const unit = standardizeUnit(rawUnit);
    const status = String(rawStatus || "").toLowerCase() === "inactive" ? "Inactive" : "Active";

    let baseSku = cleanImportSku(rawSku);
    let sku = baseSku;

    // Resolve duplicate SKUs within the same uploaded file
    if (baseSku) {
      const skuKey = baseSku.toLowerCase();
      if (seenSkusInFile.has(skuKey)) {
        const count = seenSkusInFile.get(skuKey) + 1;
        seenSkusInFile.set(skuKey, count);
        sku = `${baseSku}-${count}`;
      } else {
        seenSkusInFile.set(skuKey, 1);
      }
    }

    // Check if this product already exists in current catalog
    const skuLower = sku ? sku.toLowerCase() : "";
    const nameLower = name.toLowerCase();
    const matchedExisting =
      (skuLower && existingSkuMap.get(skuLower)) || existingNameMap.get(nameLower);

    valid.push({
      rowIndex: rowNum,
      name,
      sku: sku || (matchedExisting ? matchedExisting.sku : ""),
      category,
      supplier,
      cost,
      price,
      wholesalePrice,
      minPrice,
      stock,
      minStock,
      gst,
      unit,
      status,
      // Metadata for preview and upsert logic
      isExisting: !!matchedExisting,
      existingId: matchedExisting?._id || matchedExisting?.id || null,
      existingName: matchedExisting?.name || null,
      existingSku: matchedExisting?.sku || null,
      currentStock: matchedExisting ? Number(matchedExisting.stock || 0) : 0,
      currentPrice: matchedExisting ? Number(matchedExisting.price || 0) : 0,
    });
  });

  const newCount = valid.filter((v) => !v.isExisting).length;
  const updateCount = valid.filter((v) => v.isExisting).length;

  return {
    valid,
    errors,
    summary: {
      total: valid.length,
      newCount,
      updateCount,
      errorCount: errors.length,
    },
  };
}

/**
 * Standard Product Import/Export Columns Definition
 */
export const PRODUCT_IMPORT_COLUMNS = [
  { key: "name", label: "Product Name*" },
  { key: "sku", label: "SKU / Barcode" },
  { key: "category", label: "Category" },
  { key: "supplier", label: "Supplier" },
  { key: "price", label: "Selling Price (₹)*" },
  { key: "cost", label: "Purchase Cost (₹)" },
  { key: "wholesalePrice", label: "Wholesale Price (₹)" },
  { key: "minPrice", label: "Min Price (₹)" },
  { key: "stock", label: "Stock Quantity*" },
  { key: "minStock", label: "Min Stock Alert" },
  { key: "gst", label: "GST Rate (%)" },
  { key: "unit", label: "Unit (Piece/Kg/Box/Litre)" },
  { key: "status", label: "Status (Active/Inactive)" },
];

/**
 * Sample dataset for Excel and CSV import templates
 */
export const SAMPLE_TEMPLATE_PRODUCTS = [
  {
    name: "Wireless Optical Mouse",
    sku: "EL-WM-001",
    category: "Electronics",
    supplier: "TechVision Pvt Ltd",
    price: 599.0,
    cost: 350.0,
    wholesalePrice: 480.0,
    minPrice: 500.0,
    stock: 50,
    minStock: 10,
    gst: 18,
    unit: "Piece",
    status: "Active",
  },
  {
    name: "Fast Charging Cable Type-C 65W",
    sku: "EL-CBL-002",
    category: "Electronics",
    supplier: "TechVision Pvt Ltd",
    price: 249.0,
    cost: 110.0,
    wholesalePrice: 180.0,
    minPrice: 200.0,
    stock: 120,
    minStock: 25,
    gst: 18,
    unit: "Piece",
    status: "Active",
  },
  {
    name: "Bluetooth Wireless Earbuds",
    sku: "EL-EBD-003",
    category: "Electronics",
    supplier: "TechVision Pvt Ltd",
    price: 1499.0,
    cost: 850.0,
    wholesalePrice: 1150.0,
    minPrice: 1250.0,
    stock: 40,
    minStock: 8,
    gst: 18,
    unit: "Piece",
    status: "Active",
  },
  {
    name: "Premium Cotton Casual Shirt (L)",
    sku: "CL-SHT-004",
    category: "Clothing",
    supplier: "FabWorld Exports",
    price: 899.0,
    cost: 450.0,
    wholesalePrice: 650.0,
    minPrice: 750.0,
    stock: 75,
    minStock: 15,
    gst: 5,
    unit: "Piece",
    status: "Active",
  },
  {
    name: "Slim Fit Stretch Denim Jeans (32)",
    sku: "CL-JNS-005",
    category: "Clothing",
    supplier: "FabWorld Exports",
    price: 1299.0,
    cost: 650.0,
    wholesalePrice: 950.0,
    minPrice: 1050.0,
    stock: 60,
    minStock: 10,
    gst: 5,
    unit: "Piece",
    status: "Active",
  },
  {
    name: "Organic Basmati Rice 5kg",
    sku: "GR-RCE-006",
    category: "Groceries",
    supplier: "AgriLink Wholesale",
    price: 480.0,
    cost: 340.0,
    wholesalePrice: 410.0,
    minPrice: 440.0,
    stock: 85,
    minStock: 20,
    gst: 0,
    unit: "Kg",
    status: "Active",
  },
  {
    name: "Refined Pure Sunflower Oil 1L",
    sku: "GR-OIL-007",
    category: "Groceries",
    supplier: "AgriLink Wholesale",
    price: 145.0,
    cost: 115.0,
    wholesalePrice: 128.0,
    minPrice: 135.0,
    stock: 150,
    minStock: 30,
    gst: 5,
    unit: "Litre",
    status: "Active",
  },
  {
    name: "Heavy Duty Impact Drill 650W",
    sku: "HW-DRL-008",
    category: "Hardware",
    supplier: "Metro Hardware Hub",
    price: 2499.0,
    cost: 1650.0,
    wholesalePrice: 1950.0,
    minPrice: 2100.0,
    stock: 25,
    minStock: 5,
    gst: 18,
    unit: "Piece",
    status: "Active",
  },
  {
    name: "Precision Screwdriver Set 8pc",
    sku: "HW-SCD-009",
    category: "Hardware",
    supplier: "Metro Hardware Hub",
    price: 349.0,
    cost: 180.0,
    wholesalePrice: 240.0,
    minPrice: 280.0,
    stock: 90,
    minStock: 15,
    gst: 18,
    unit: "Box",
    status: "Active",
  },
  {
    name: "Executive Hardcover Notebook A5",
    sku: "ST-NBK-010",
    category: "Stationery",
    supplier: "Metro Hardware Hub",
    price: 180.0,
    cost: 95.0,
    wholesalePrice: 130.0,
    minPrice: 150.0,
    stock: 110,
    minStock: 20,
    gst: 12,
    unit: "Piece",
    status: "Active",
  },
];

/**
 * Downloads Product Template as Excel (.xlsx)
 */
export function downloadProductExcelTemplate(existingProducts = []) {
  const rows =
    Array.isArray(existingProducts) && existingProducts.length > 0
      ? existingProducts.map((p) => ({
          name: p.name || "",
          sku: p.sku || "",
          category: p.category || "General",
          supplier: p.supplier || "",
          price: p.price ?? 0,
          cost: p.cost ?? 0,
          wholesalePrice: p.wholesalePrice ?? 0,
          minPrice: p.minPrice ?? 0,
          stock: p.stock ?? 0,
          minStock: p.minStock ?? 10,
          gst: p.gst ?? 0,
          unit: p.unit || "Piece",
          status: p.status || "Active",
        }))
      : SAMPLE_TEMPLATE_PRODUCTS;

  const filename =
    Array.isArray(existingProducts) && existingProducts.length > 0
      ? "SmartBill_My_Catalog_Template.xlsx"
      : "SmartBill_Product_Import_Template.xlsx";

  exportToExcel(filename, "Product Import Template", PRODUCT_IMPORT_COLUMNS, rows);
}

/**
 * Downloads Product Template as CSV (.csv)
 */
export function downloadProductCsvTemplate(existingProducts = []) {
  const rows =
    Array.isArray(existingProducts) && existingProducts.length > 0
      ? existingProducts.map((p) => ({
          name: p.name || "",
          sku: p.sku || "",
          category: p.category || "General",
          supplier: p.supplier || "",
          price: String(p.price ?? 0),
          cost: String(p.cost ?? 0),
          wholesalePrice: String(p.wholesalePrice ?? 0),
          minPrice: String(p.minPrice ?? 0),
          stock: String(p.stock ?? 0),
          minStock: String(p.minStock ?? 10),
          gst: String(p.gst ?? 0),
          unit: p.unit || "Piece",
          status: p.status || "Active",
        }))
      : SAMPLE_TEMPLATE_PRODUCTS;

  const filename =
    Array.isArray(existingProducts) && existingProducts.length > 0
      ? "SmartBill_My_Catalog_Template.csv"
      : "SmartBill_Product_Import_Template.csv";

  exportToCsv(filename, PRODUCT_IMPORT_COLUMNS, rows);
}

/**
 * Universal Template Downloader supporting both formats
 * @param {Array<Object>} [existingProducts]
 * @param {'xlsx'|'csv'} [format]
 */
export function downloadProductTemplate(existingProducts = [], format = "xlsx") {
  if (format === "csv") {
    downloadProductCsvTemplate(existingProducts);
  } else {
    downloadProductExcelTemplate(existingProducts);
  }
}

/**
 * Purchase Bill / Inward Invoice Columns
 */
export const PURCHASE_IMPORT_COLUMNS = [
  { key: "product", label: "Product Name*" },
  { key: "qty", label: "Quantity*" },
  { key: "rate", label: "Purchase Rate (₹)*" },
  { key: "gstRate", label: "GST Rate (%)" },
  { key: "unit", label: "Unit (Piece/Kg/Box/Litre)" },
  { key: "discount", label: "Discount (₹)" },
  { key: "sku", label: "SKU / Barcode" },
];

export const SAMPLE_PURCHASE_BILL_ITEMS = [
  {
    product: "Wireless Optical Mouse",
    qty: 30,
    rate: 350.0,
    gstRate: 18,
    unit: "Piece",
    discount: 0,
    sku: "EL-WM-001",
  },
  {
    product: "Fast Charging Cable Type-C 65W",
    qty: 50,
    rate: 110.0,
    gstRate: 18,
    unit: "Piece",
    discount: 50,
    sku: "EL-CBL-002",
  },
  {
    product: "Bluetooth Wireless Earbuds",
    qty: 20,
    rate: 850.0,
    gstRate: 18,
    unit: "Piece",
    discount: 100,
    sku: "EL-EBD-003",
  },
];

/**
 * Downloads a Purchase Bill Excel or CSV template
 */
export function downloadPurchaseInvoiceTemplate(format = "xlsx") {
  if (format === "csv") {
    exportToCsv("SmartBill_Purchase_Bill_Template.csv", PURCHASE_IMPORT_COLUMNS, SAMPLE_PURCHASE_BILL_ITEMS);
  } else {
    exportToExcel("SmartBill_Purchase_Bill_Template.xlsx", "Purchase Items", PURCHASE_IMPORT_COLUMNS, SAMPLE_PURCHASE_BILL_ITEMS);
  }
}

/**
 * Normalizes raw rows from an uploaded Supplier Bill/Invoice into purchase item rows
 * @param {Array<Object>} rawRows
 * @param {Array<Object>} existingProducts
 * @returns {{ items: Array<Object>, errors: Array<string> }}
 */
export function normalizePurchaseInvoiceRows(rawRows = [], existingProducts = []) {
  if (!rawRows || rawRows.length === 0) {
    return { items: [], errors: ["The file is empty or no valid items found."] };
  }

  const existingSkuMap = new Map();
  const existingNameMap = new Map();
  (existingProducts || []).forEach((p) => {
    if (p.sku) existingSkuMap.set(String(p.sku).trim().toLowerCase(), p);
    if (p.name) existingNameMap.set(String(p.name).trim().toLowerCase(), p);
  });

  const items = [];
  const errors = [];

  rawRows.forEach((row, idx) => {
    const rowNum = idx + 2;
    const cleanDict = {};
    for (const [k, v] of Object.entries(row)) {
      const cleanK = String(k).toLowerCase().replace(/[^a-z0-9]/g, "");
      if (cleanK) cleanDict[cleanK] = v;
    }

    const getVal = (...keys) => {
      for (const k of keys) {
        const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, "");
        if (cleanDict[cleanK] !== undefined && String(cleanDict[cleanK]).trim() !== "") {
          return cleanDict[cleanK];
        }
      }
      return "";
    };

    const rawName = getVal("productname", "product", "itemname", "item", "title", "description", "particulars", "_col0");
    const rawQty = getVal("quantity", "qty", "count", "units", "billedqty", "_col1");
    const rawRate = getVal("purchaserate", "rate", "cost", "unitrate", "price", "unitprice", "costprice", "_col2");
    const rawGst = getVal("gstrate", "gst", "gstpercent", "tax", "taxrate", "_col3");
    const rawUnit = getVal("unit", "uom", "measurementunit", "_col4");
    const rawDiscount = getVal("discount", "disc", "discountamount", "_col5");
    const rawSku = getVal("sku", "barcode", "itemcode", "productcode", "_col6");

    const name = String(rawName || "").trim();
    if (!name) {
      errors.push(`Row ${rowNum}: Product Name is missing.`);
      return;
    }

    const qty = cleanImportNumber(rawQty, 1);
    const rate = cleanImportNumber(rawRate, 0);
    const gstRate = cleanImportNumber(rawGst, 18);
    const discount = cleanImportNumber(rawDiscount, 0);
    const unit = standardizeUnit(rawUnit);

    const skuLower = rawSku ? String(rawSku).trim().toLowerCase() : "";
    const nameLower = name.toLowerCase();
    const matched = (skuLower && existingSkuMap.get(skuLower)) || existingNameMap.get(nameLower);

    const baseAmount = Math.max(0, qty * rate - discount);
    const gstAmount = baseAmount * (gstRate / 100);

    items.push({
      productId: matched?._id || matched?.id || null,
      product: matched?.name || name,
      qty: Math.max(1, qty),
      unit: matched?.unit || unit || "Piece",
      rate: rate > 0 ? rate : Number(matched?.cost || matched?.price || 0),
      gstRate: gstRate,
      discount: discount,
      amount: baseAmount,
      gstAmount: gstAmount,
      isExisting: !!matched,
    });
  });

  return { items, errors };
}

