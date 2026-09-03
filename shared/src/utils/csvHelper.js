/**
 * csvHelper.js
 * Utility functions for exporting and parsing CSV data with UTF-8 BOM support.
 */

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
 * Parses raw CSV text content into an array of objects.
 * Handles quoted fields with embedded commas and line breaks.
 * @param {string} text - Raw CSV text
 * @returns {Array<Object>}
 */
export function parseCsv(text) {
  if (!text || typeof text !== "string") return [];

  const lines = [];
  let currentLine = [];
  let currentField = "";
  let insideQuotes = false;

  const cleanText = text.replace(/^\uFEFF/, ""); // Remove BOM if present

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
    } else if (char === "," && !insideQuotes) {
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
    records.push(record);
  }

  return records;
}

/**
 * Generates and downloads a sample Product Import template CSV.
 */
export function downloadProductTemplate() {
  const columns = [
    { key: "name", label: "Product Name*" },
    { key: "sku", label: "SKU / Barcode" },
    { key: "category", label: "Category" },
    { key: "price", label: "Selling Price (₹)*" },
    { key: "cost", label: "Purchase Cost (₹)" },
    { key: "stock", label: "Initial Stock Qty*" },
    { key: "minStock", label: "Min Stock Alert" },
    { key: "gst", label: "GST Rate (%)" },
    { key: "unit", label: "Unit (Piece/Kg/Box)" },
    { key: "description", label: "Description" },
  ];

  const sampleRows = [
    {
      name: "Sample Wireless Mouse",
      sku: "SKU-WM-001",
      category: "Electronics",
      price: "599.00",
      cost: "350.00",
      stock: "50",
      minStock: "10",
      gst: "18",
      unit: "Piece",
      description: "2.4GHz Optical Wireless Mouse",
    },
    {
      name: "Sample USB-C Fast Cable 1m",
      sku: "SKU-CBL-002",
      category: "Electronics",
      price: "199.00",
      cost: "80.00",
      stock: "100",
      minStock: "20",
      gst: "18",
      unit: "Piece",
      description: "Braided 65W Fast Charging Cable",
    },
  ];

  exportToCsv("SmartBill_Product_Import_Template.csv", columns, sampleRows);
}
