import type { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database.js';
import { buildXlsx } from '../services/reportFormatters/xlsx.js'

import type { AuthRequest } from '../middleware/auth.js';

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
      supplier,
      stockLevel,
      lowStockThreshold,
      expiryDate,
      unitPrice,
      storageLocation,
    } = req.body;
    const id = uuidv4();
    await pool.query(
      `INSERT INTO medicines_inventory (id, medicine_name, supplier, stock_level, low_stock_threshold, expiry_date, unit_price, storage_location)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, medicineName, supplier, stockLevel, lowStockThreshold, expiryDate, unitPrice, storageLocation]
    );
    res.status(201).json({ message: 'Pharmacy item created successfully', id });
  } catch (error) {
    console.error('Create pharmacy item error:', error);
    res.status(500).json({ error: 'Failed to create pharmacy item' });
  }
};

export const updatePharmacyItem = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updates), id];

    await pool.query(
      `UPDATE medicines_inventory SET ${fields} WHERE id = ?`,
      values
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
    const { reportType } = req.query as any;
    const accept = String(req.headers?.['accept'] || '').toLowerCase()
    const queryFormat = String((req.query as any).format || '').toLowerCase()
    const format = accept.includes('application/pdf') ? 'pdf'
      : accept.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') ? 'xlsx'
      : queryFormat || 'json'

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
    const list = rows as any[]
    if (format === 'xlsx') {
      const buf = buildXlsx(String(reportType), list)
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      res.setHeader('Content-Disposition', `attachment; filename="pharmacy_${String(reportType)}.xlsx"`)
      res.send(buf)
      return
    }
    if (format === 'pdf') {
      res.status(501).json({ error: 'PDF reporting is not implemented' })
      return
    }
    if (format === 'csv') {
      const headers = Object.keys(list[0] || {})
      const lines = [headers.join(','), ...list.map((r) => headers.map((h) => String(r[h] ?? '').replace(/,/g, ';')).join(','))]
      res.setHeader('Content-Type', 'text/csv')
      res.send(lines.join('\n'))
      return
    }
    res.json(rows);
  } catch (error) {
    console.error('Generate pharmacy report error:', error);
    res.status(500).json({ error: 'Failed to generate pharmacy report' });
  }
};
