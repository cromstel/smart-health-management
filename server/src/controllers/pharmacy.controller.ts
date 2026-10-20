import type { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database.js';
import { buildXlsx } from '../services/reportFormatters/xlsx.js';
import { buildPDF } from '../services/reportFormatters/pdf.js';

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
    let query = 'SELECT * FROM medicines_inventory WHERE 1=1';
    const params: any[] = [];

    if (lowStock === 'true') {
      query += ' AND stock_level <= low_stock_threshold';
    }

    if (expired === 'true') {
      query += ' AND expiry_date < CURDATE()';
    }

    const [items] = await pool.query(query, params);
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

    await pool.query(
      `UPDATE medicines_inventory SET ${assignments.join(', ')} WHERE id = ?`,
      [...values, id]
    );
    res.json({ message: 'Pharmacy item updated successfully' });
  } catch (error) {
    console.error('Update pharmacy item error:', error);
    res.status(500).json({ error: 'Failed to update pharmacy item' });
  }
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
      const lines = [headers.join(','), ...list.map((r) => headers.map((h) => String(r[h] ?? '').replace(/,/g, ';')).join(','))];
      res.setHeader('Content-Type', 'text/csv');
      res.send(lines.join('\n'));
      return;
    }
    res.json(rows);
  } catch (error) {
    console.error('Generate pharmacy report error:', error);
    res.status(500).json({ error: 'Failed to generate pharmacy report' });
  }
};
