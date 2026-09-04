import * as XLSX from 'xlsx-js-style';
import { DateTime } from 'luxon';
// Rename import to avoid confusion with luxon DateTime
import { DateTime as DateTimeComponent } from '../Column/DefaultTypes.js';

function FileName(fileNameExport, extension = 'txt') {
    let fName = 'Report';

    if (fileNameExport && fileNameExport.length > 0) {
        fName = fileNameExport;
    }

    return `${fName}_${DateTime.local().toFormat('yyyy-MM-dd_HH-mm-ss')}.${extension}`;
}

/**
 * Builds the HTML content string for the exported table.
 * @param {Array<Object>} data - Formatted data rows.
 * @returns {string} Full HTML document string.
 */
function ConvertDataToHtml(data) {
    let tableHTML = '';

    // Add table headers
    tableHTML += '<thead><tr>';
    if (data.length > 0) {
        Object.keys(data[0]).forEach((key) => {
            tableHTML += '<th>' + escapeHtml(key) + '</th>';
        });
    }
    tableHTML += '</tr></thead>';

    // Add table data
    tableHTML += '<tbody>';
    data.forEach((row, rowIndex) => {
        tableHTML += '<tr>';
        Object.values(row).forEach((value) => {
            tableHTML += '<td>' + escapeHtml(String(value ?? '')) + '</td>';
        });
        tableHTML += '</tr>';
    });
    tableHTML += '</tbody>';

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Report</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
    margin: 2rem;
    color: #333;
  }
  h1 {
    font-size: 1.4rem;
    margin-bottom: 1rem;
    color: #1F4E79;
  }
  #report_table {
    border-collapse: collapse;
    width: 100%;
    font-size: 0.85rem;
  }
  #report_table th,
  #report_table td {
    border: 1px solid #c0c0c0;
    padding: 8px 12px;
    text-align: left;
  }
  #report_table thead th {
    background-color: #1F4E79;
    color: #ffffff;
    font-weight: 600;
    text-align: center;
    position: sticky;
    top: 0;
  }
  #report_table tbody tr:nth-child(even) {
    background-color: #E8F0FE;
  }
  #report_table tbody tr:hover {
    background-color: #d2e3fc;
  }
  #report_table td {
    vertical-align: top;
  }
  @media print {
    #report_table { font-size: 0.75rem; }
    #report_table thead th { position: static; }
  }
</style>
</head>
<body>
<h1>Report</h1>
<table id="report_table">
${tableHTML}
</table>
</body>
</html>`;
}

/**
 * Escapes HTML special characters to prevent injection.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Formats data for export and checks if any cell exceeds the character limit.
 * @param {Array} array_data
 * @param {Object} columns
 * @param {number} text_length_limit_in_cell
 * @returns {{data: Array, exceedsLimit: boolean}}
 */
function FormatDataToExport(array_data, columns, text_length_limit_in_cell = 0) {
    let exceedsLimit = false;
    const excelLimit = 32767;

    const data = array_data.map((row) => {
        const newRow = {};

        Object.keys(row).forEach((key) => {
            // Skip hidden columns
            if (columns[key] && columns[key].hidden) {
                return;
            }

            const colConfig = columns[key];
            let value = row[key];

            // Handle DateTime columns
            if (
                colConfig &&
                colConfig.decorator &&
                colConfig.decorator.component &&
                colConfig.decorator.component === DateTimeComponent
            ) {
                let dtLuxon = null;
                if (value instanceof Date) {
                    dtLuxon = DateTime.fromJSDate(value);
                } else if (typeof value === 'string') {
                    // Try ISO first
                    dtLuxon = DateTime.fromISO(value);
                    // If invalid and a format is provided, try that
                    if (!dtLuxon.isValid && colConfig.fromFormat) {
                        dtLuxon = DateTime.fromFormat(value, colConfig.fromFormat);
                    }
                    // Try SQL
                    if (!dtLuxon.isValid) {
                        dtLuxon = DateTime.fromSQL(value);
                    }
                    // Fallback to JS Date
                    if (!dtLuxon.isValid) {
                        const parsedDate = new Date(value);
                        if (!isNaN(parsedDate.getTime())) {
                            dtLuxon = DateTime.fromJSDate(parsedDate);
                        }
                    }
                }

                if (dtLuxon && dtLuxon.isValid) {
                    // Use column format if available, otherwise default
                    const fmt = colConfig.format || 'yyyy-MM-dd HH:mm:ss';
                    value = dtLuxon.toFormat(fmt);
                }
            }
            // Handle Objects/Arrays
            else if (value !== null && typeof value === 'object') {
                value = JSON.stringify(value);
            }

            // Check character limit
            if (typeof value === 'string') {
                if (value.length > excelLimit) {
                    console.warn(
                        `El valor de la columna ${key} es muy largo para Excel (${value.length} chars).`
                    );
                    exceedsLimit = true;
                }

                if (text_length_limit_in_cell > 0 && value.length > text_length_limit_in_cell) {
                    value = value.substring(0, text_length_limit_in_cell);
                }
            }

            // Remove internal hash if present
            if (key !== 'internal_hash_row') {
                newRow[key] = value;
            }
        });

        return newRow;
    });

    return { data, exceedsLimit };
}

/**
 * Applies cell styles to a worksheet for xlsx-js-style.
 * Header row: dark blue background, white bold text, centered.
 * Data rows: alternating white / light blue (zebra).
 * @param {Object} ws - The worksheet object.
 */
function applyWorksheetStyles(ws) {
    const range = XLSX.utils.decode_range(ws['!ref']);

    // Style the header row (row 0)
    for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddr = XLSX.utils.encode_cell({ r: 0, c: col });
        if (ws[cellAddr]) {
            ws[cellAddr].s = {
                font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
                fill: { fgColor: { rgb: '1F4E79' }, patternType: 'solid' },
                alignment: { horizontal: 'center', vertical: 'center' },
                border: {
                    top: { style: 'thin', color: { rgb: 'C0C0C0' } },
                    bottom: { style: 'thin', color: { rgb: 'C0C0C0' } },
                    left: { style: 'thin', color: { rgb: 'C0C0C0' } },
                    right: { style: 'thin', color: { rgb: 'C0C0C0' } }
                }
            };
        }
    }

    // Style data rows with zebra striping
    for (let row = range.s.r + 1; row <= range.e.r; row++) {
        const isEven = (row - 1) % 2 === 1;
        for (let col = range.s.c; col <= range.e.c; col++) {
            const cellAddr = XLSX.utils.encode_cell({ r: row, c: col });
            if (ws[cellAddr]) {
                ws[cellAddr].s = {
                    font: { sz: 10 },
                    fill: isEven
                        ? { fgColor: { rgb: 'E8F0FE' }, patternType: 'solid' }
                        : { fgColor: { rgb: 'FFFFFF' }, patternType: 'solid' },
                    border: {
                        top: { style: 'thin', color: { rgb: 'C0C0C0' } },
                        bottom: { style: 'thin', color: { rgb: 'C0C0C0' } },
                        left: { style: 'thin', color: { rgb: 'C0C0C0' } },
                        right: { style: 'thin', color: { rgb: 'C0C0C0' } }
                    }
                };
            }
        }
    }

    // Auto-fit column widths based on content
    const colWidths = [];
    for (let col = range.s.c; col <= range.e.c; col++) {
        let maxWidth = 8;
        for (let row = range.s.r; row <= range.e.r; row++) {
            const cellAddr = XLSX.utils.encode_cell({ r: row, c: col });
            const cellValue = ws[cellAddr] ? String(ws[cellAddr].v ?? '') : '';
            maxWidth = Math.max(maxWidth, Math.min(cellValue.length + 2, 60));
        }
        colWidths.push({ wch: maxWidth });
    }
    ws['!cols'] = colWidths;
}

export const ExportTableToXlsx = (filteredData, columns, fileNameExport) => {
    try {
        // limit for Excel cells is 32767 characters.
        const { data: FormatedData, exceedsLimit } = FormatDataToExport(filteredData, columns, 0);

        if (FormatedData && FormatedData.length > 0) {
            /* Create a worksheet */
            const ws = XLSX.utils.json_to_sheet(FormatedData);
            /* Apply styles to headers and zebra rows */
            applyWorksheetStyles(ws);
            /* Create a new empty workbook, then add the worksheet */
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Report');

            let ExtensionFile = 'xlsx';
            if (exceedsLimit) {
                ExtensionFile = 'csv';
                console.warn('Data exceeds Excel cell limit, switching to CSV export to preserve full content.');
            }

            const NameFile = FileName(fileNameExport, ExtensionFile);
            const wopts = {
                bookType: ExtensionFile,
                bookSST: false,
                type: 'binary',
                FS: ';'
            };
            XLSX.writeFile(wb, NameFile, wopts);
        }
    } catch (error) {
        console.error(error);
    }
};

export const ExportTableToHTML = (filteredData, columns, fileNameExport) => {
    try {
        const { data: FormatedData } = FormatDataToExport(filteredData, columns);
        const html_content = ConvertDataToHtml(FormatedData);

        const link_download = document.createElement('a');
        link_download.setAttribute('href', 'data:text/html;charset=utf-8,' + encodeURIComponent(html_content));
        link_download.setAttribute('download', FileName(fileNameExport, 'html'));

        link_download.style.display = 'none';
        document.body.appendChild(link_download);
        link_download.click();
        document.body.removeChild(link_download);
    } catch (error) {
        console.error(error);
    }
};
