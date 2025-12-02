import ExcelJS from 'exceljs';

export async function buildXlsx(reportName: string, rows: any[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(reportName);

  worksheet.columns = Object.keys(rows[0] || {}).map(key => ({
    header: key,
    key: key,
    width: Math.max(12, key.length)
  }));

  worksheet.addRows(rows);

  // Freeze header
  worksheet.views = [
    { state: 'frozen', ySplit: 1, xSplit: 0, topLeftCell: 'A2' }
  ];

  const buffer = await workbook.xlsx.writeBuffer() as unknown as Buffer;
  return buffer;
}
