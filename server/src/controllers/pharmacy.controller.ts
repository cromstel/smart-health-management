import type { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database.js';
import { createAuditLog } from '../services/auditLog.service.js';
import type { RowDataPacket } from 'mysql2/promise';
import { buildXlsx } from '../services/reportFormatters/xlsx.js';
import { buildPDF } from '../services/reportFormatters/pdf.js';
import { readPage, setPageHeaders } from '../utils/pagination.js';

import type { AuthRequest } from '../middleware/auth.js';

/**
 * Columns a client may write on `medicines_inventory`.
 *
 * The request body is never used to build the SET clause directly -- any key
 * a client sends would otherwise become a column name. `id` is the primary
 * key and is never updatable.
 */
const PHARMACY_ITEM_UPDATE_FIELDS: Record<string, string> = {
  medicine_name: 'medicine_name',
  medicineName: 'medicine_name',
  category: 'category',
  supplier: 'supplier',
  supplier_id: 'supplier_id',
  supplierId: 'supplier_id',
  stock_level: 'stock_level',
  stockLevel: 'stock_level',
  low_stock_threshold: 'low_stock_threshold',
  lowStockThreshold: 'low_stock_threshold',
  unit_price: 'unit_price',
  unitPrice: 'unit_price',
  expiry_date: 'expiry_date',
  expiryDate: 'expiry_date',
  storage_location: 'storage_location',
  storageLocation: 'storage_location',
};

/** Human readable titles for the generated reports. */
const REPORT_TITLES: Record<string, string> = {
  stock_levels: 'Stock Levels',
  expiry_dates: 'Expiry Dates',
  low_stock: 'Low Stock',
};

/**
 * Coerces a form value that may arrive as a string into a number, or null
 * when it is absent/blank. Blank strings are a normal artefact of the
 * pharmacy form and mean "not supplied", not zero.
 */
const toNumberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toTextOrNull = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
};

export const getPharmacyItems = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { lowStock, expired } = req.query;
    // The list used to answer with every row in the table, so one request
    // carried the whole catalogue of the installation with it. It is now a
    // page with a default and a ceiling, and the number of rows that exist
    // is reported alongside the page so a client can ask for the rest.
    const { limit, offset } = readPage(req.query);

    let where = '';
    const params: any[] = [];

    if (lowStock === 'true') {
      where += ' AND stock_level <= low_stock_threshold';
    }

    if (expired === 'true') {
      where += ' AND expiry_date < CURDATE()';
    }

    // The order is fixed so that a page is a page: an offset without a
    // total order repeats and skips rows from one page to the next.
    const [items] = await pool.query(
      `SELECT * FROM medicines_inventory WHERE 1=1${where}
        ORDER BY medicine_name ASC, id ASC
        LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    // The number of rows that exist, so that a client knows there is more to
    // ask for. It is counted with the same filter as the page, so the two
    // numbers describe the same set.
    const [countRows] = await pool.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS count FROM medicines_inventory WHERE 1=1${where}`,
      params
    );
    const total = Number(countRows?.[0]?.count ?? 0);

    // The body is still the array of medicines: the browser reads this
    // endpoint as a list, and changing the shape of the answer is not part of
    // this change. The page is reported in the headers instead, which is
    // where a client that has to page an array-shaped answer looks for it.
    setPageHeaders(res, { total, limit, offset });

    res.json(items);
  } catch (error) {
    console.error('Get pharmacy items error:', error);
    res.status(500).json({ error: 'Failed to fetch pharmacy items' });
  }
};

export const getPharmacyItemById = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const [items] = await pool.query('SELECT * FROM medicines_inventory WHERE id = ?', [id]);
    const item = (items as any[])[0];

    if (!item) {
      return res.status(404).json({ error: 'Pharmacy item not found' });
    }
    res.json(item);
  } catch (error) {
    console.error('Get pharmacy item by ID error:', error);
    res.status(500).json({ error: 'Failed to fetch pharmacy item' });
  }
};

export const createPharmacyItem = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const {
      medicineName,
      medicine_name,
      category,
      supplier,
      supplierId,
      supplier_id,
      stockLevel,
      stock_level,
      lowStockThreshold,
      low_stock_threshold,
      expiryDate,
      expiry_date,
      unitPrice,
      unit_price,
      storageLocation,
      storage_location,
    } = req.body ?? {};

    const name = toTextOrNull(medicineName ?? medicine_name);
    if (!name) {
      return res.status(400).json({ error: 'Medicine name is required' });
    }

    const id = uuidv4();
    const stock = toNumberOrNull(stockLevel ?? stock_level) ?? 0;
    const threshold = toNumberOrNull(lowStockThreshold ?? low_stock_threshold) ?? 0;
    const price = toNumberOrNull(unitPrice ?? unit_price) ?? 0;

    // `category` and `supplier_id` are what the prescription contraindication
    // check and the low stock re-order job rely on, so they are persisted
    // instead of being dropped on the floor.
    await pool.query(
      `INSERT INTO medicines_inventory
         (id, medicine_name, category, supplier, supplier_id, stock_level, low_stock_threshold, expiry_date, unit_price, storage_location)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        name,
        toTextOrNull(category),
        toTextOrNull(supplier),
        toNumberOrNull(supplierId ?? supplier_id),
        stock,
        threshold,
        toTextOrNull(expiryDate ?? expiry_date),
        price,
        toTextOrNull(storageLocation ?? storage_location),
      ]
    );

    res.status(201).json({
      message: 'Pharmacy item created successfully',
      id,
      medicine_name: name,
      category: toTextOrNull(category),
    });
  } catch (error) {
    console.error('Create pharmacy item error:', error);
    res.status(500).json({ error: 'Failed to create pharmacy item' });
  }
};

export const updatePharmacyItem = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const updates = (req.body ?? {}) as Record<string, unknown>;

    const assignments: string[] = [];
    const values: any[] = [];
    const usedColumns = new Set<string>();

    for (const [key, column] of Object.entries(PHARMACY_ITEM_UPDATE_FIELDS)) {
      if (!(key in updates) || updates[key] === undefined) continue;
      if (usedColumns.has(column)) continue; // camelCase alias already applied
      usedColumns.add(column);

      let value: unknown = updates[key];
      if (column === 'stock_level' || column === 'low_stock_threshold') {
        value = toNumberOrNull(value) ?? 0;
      } else if (column === 'unit_price') {
        value = toNumberOrNull(value) ?? 0;
      } else if (column === 'supplier_id') {
        value = toNumberOrNull(value);
      } else if (column === 'expiry_date') {
        value = toTextOrNull(value);
      } else {
        value = toTextOrNull(value);
      }

      assignments.push(`${column} = ?`);
      values.push(value);
    }

    if (assignments.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // A stock level that is changed by hand is a correction of a count, and a
    // correction is exactly the kind of thing that has to be on the record.
    // Every other movement of the stock -- a recall, a dispensing sign-off --
    // is written to the audit trail; a hand-written one that was not was a
    // way for the number on the shelf and the number in the system to part
    // company without anybody noticing.
    const stockChanged = usedColumns.has('stock_level');
    let previousStock: number | null = null;
    if (stockChanged) {
      const [before] = await pool.query('SELECT stock_level FROM medicines_inventory WHERE id = ?', [id]);
      previousStock = toNumberOrNull((before as any[])[0]?.stock_level) ?? null;
    }

    await pool.query(
      `UPDATE medicines_inventory SET ${assignments.join(', ')} WHERE id = ?`,
      [...values, id]
    );

    if (stockChanged) {
      const newStock = toNumberOrNull(updates.stockLevel ?? updates.stock_level) ?? 0;
      await createAuditLog({
        userId: Number(req.user?.id ?? 0),
        userName: req.user?.email ?? null,
        action: 'stock-adjustment',
        module: 'pharmacy',
        recordId: String(id),
        oldValue: previousStock === null ? null : String(previousStock),
        newValue: String(newStock),
        ipAddress: req.ip ?? null,
        userAgent: req.get('user-agent') ?? null,
      }).catch(() => {
        // The adjustment has already been written. A failure to record it is
        // worth knowing about, but it must not fail a correction the clerk
        // has already made.
        console.error('Pharmacy stock adjustment could not be written to the audit trail');
      });
    }

    res.json({ message: 'Pharmacy item updated successfully' });
  } catch (error) {
    console.error('Update pharmacy item error:', error);
    res.status(500).json({ error: 'Failed to update pharmacy item' });
  }
};

/**
 * One cell of a spreadsheet.
 *
 * A value that begins with `=`, `+`, `-` or `@` is a formula when the file
 * is opened, and a medicine named "=1+1" would be run as a formula by the
 * spreadsheet of whoever opened the report. A value that begins with one of
 * those is written with a leading apostrophe, which makes the spreadsheet
 * read it as text.
 *
 * The value is also quoted, and the quotes inside it are doubled, so that a
 * comma, a quote or a line break in the data cannot change the shape of the
 * file.
 */
const BYTE_ORDER_MARK = String.fromCharCode(0xfeff);

const csvCell = (value: string): string => {
  const needsGuard = /^[=+\-@\t\r]/.test(value);
  const guarded = needsGuard ? `'${value}` : value;
  return `"${guarded.replace(/"/g, '""')}"`;
};

export const deletePharmacyItem = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM medicines_inventory WHERE id = ?', [id]);
    res.json({ message: 'Pharmacy item deleted successfully' });
  } catch (error) {
    console.error('Delete pharmacy item error:', error);
    res.status(500).json({ error: 'Failed to delete pharmacy item' });
  }
};

export const generatePharmacyReport = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    // Accept both spellings. The client and the mock API both send ?type=,
    // while this handler only read ?reportType=, so every report request fell
    // through to the default branch and answered 400 "Invalid report type".
    const reportType = String(
      (req.query as any).type ?? (req.query as any).reportType ?? ''
    );
    const accept = String(req.headers?.['accept'] || '').toLowerCase();
    const queryFormat = String((req.query as any).format || '').toLowerCase();
    const format = accept.includes('application/pdf') ? 'pdf'
      : accept.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') ? 'xlsx'
      : queryFormat || 'json';

    let query = '';
    const params: any[] = [];

    switch (reportType) {
      case 'stock_levels':
        query = 'SELECT medicine_name, stock_level, unit_price FROM medicines_inventory ORDER BY stock_level DESC';
        break;
      case 'expiry_dates':
        query = 'SELECT medicine_name, expiry_date, stock_level FROM medicines_inventory WHERE expiry_date < DATE_ADD(CURDATE(), INTERVAL 30 DAY) ORDER BY expiry_date ASC';
        break;
      case 'low_stock':
        query = 'SELECT medicine_name, stock_level, low_stock_threshold FROM medicines_inventory WHERE stock_level <= low_stock_threshold ORDER BY stock_level ASC';
        break;
      default:
        res.status(400).json({ error: 'Invalid report type' });
        return;
    }

    const [rows] = await pool.query(query, params);
    const list = rows as any[];
    if (format === 'xlsx') {
      const buf = await buildXlsx(list, String(reportType));
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="pharmacy_${String(reportType)}.xlsx"`);
      res.send(buf);
      return;
    }
    if (format === 'pdf') {
      const title = REPORT_TITLES[reportType] ?? reportType;
      const doc = buildPDF(title, list);
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(chunks);
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', `attachment; filename="pharmacy_${String(reportType)}.pdf"`);
          res.send(pdfBuffer);
          resolve();
        });
        doc.on('error', reject);
        doc.end();
      });
      return;
    }
    if (format === 'csv') {
      const headers = Object.keys(list[0] || {});
      const lines = [
        headers.map((h) => csvCell(h)).join(','),
        ...list.map((r) => headers.map((h) => csvCell(String(r[h] ?? ''))).join(',')),
      ];
      // The byte-order mark is what makes a spreadsheet read the file as
      // UTF-8 rather than as the system's own encoding.
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.send(BYTE_ORDER_MARK + lines.join('\r\n'));
      return;
    }
    res.json(rows);
  } catch (error) {
    console.error('Generate pharmacy report error:', error);
    res.status(500).json({ error: 'Failed to generate pharmacy report' });
  }
};
