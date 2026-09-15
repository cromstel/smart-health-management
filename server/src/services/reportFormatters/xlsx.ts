import ExcelJS from 'exceljs';

/**
 * Build an .xlsx workbook buffer from an array of row objects using exceljs.
 * Replaces the legacy `xlsx` (SheetJS) package, which has no npm fix for its
 * high-severity advisories.
 *
 * @param rows - Array of flat objects; keys become the header row.
 * @param sheetName - Worksheet name (exceljs limits: 31 chars, no \ / ? * [ ] :).
 */
export async function buildXlsx(rows: Record<string, unknown>[], sheetName = 'Report'): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const safeSheetName = sheetName.replace(/[\\/?*[\]:]/g, '-').slice(0, 31) || 'Report';
  const worksheet = workbook.addWorksheet(safeSheetName);

  const headers = rows.length > 0 ? Object.keys(rows[0]) : ['no_data'];
  worksheet.columns = headers.map((header) => ({ header, key: header, width: 20 }));

  for (const row of rows) {
    worksheet.addRow(row);
  }

  worksheet.getRow(1).font = { bold: true };
  if (headers.length > 1) {
    worksheet.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + headers.length)}1` };
  }

  // exceljs declares its own non-generic Buffer interface; convert explicitly
// to @types/node's Buffer<ArrayBufferLike> (behavior is identical).
const buffer = (await workbook.xlsx.writeBuffer()) as unknown as Buffer;
return buffer;
}