import mysql from 'mysql2/promise';
import pool from '../config/database.js'
/**
 * Imports patients from the Ghana Health Service database into the local system,
 * performing upsert based on external patient id mapping.
 */

const dbConfig = {
  host: process.env.GHS_DB_HOST || '',
  port: parseInt(process.env.GHS_DB_PORT || '3306'),
  database: process.env.GHS_DB_NAME || '',
  user: process.env.GHS_DB_USER || '',
  password: process.env.GHS_DB_PASSWORD || '',
};

export const fetchGhanaHealthData = async (): Promise<any> => {
  try {
    const connection = await mysql.createConnection(dbConfig);
    console.log('Connected to Ghana Health Service database');

    // Example query (replace with actual query)
    const [rows] = await connection.execute('SELECT * FROM patients LIMIT 10');

    await connection.end();
    console.log('Disconnected from Ghana Health Service database');

    return rows;
  } catch (error) {
    console.error('Error fetching data from Ghana Health Service database:', error);
    throw new Error('Failed to fetch data from Ghana Health Service database');
  }
};

export const importGhanaPatients = async (): Promise<{ imported: number; updated: number }> => {
  const connection = await mysql.createConnection(dbConfig)
  try {
    const [rows] = await connection.execute('SELECT id, first_name, last_name, age, gender, phone, email, address FROM patients')
    let imported = 0
    let updated = 0
    for (const r of rows as any[]) {
      const [existing] = await pool.query('SELECT id FROM patients WHERE patient_id = ?', [String(r.id)])
      if ((existing as any[]).length > 0) {
        await pool.query(
          `UPDATE patients SET first_name = ?, last_name = ?, age = ?, gender = ?, phone = ?, email = ?, address = ? WHERE patient_id = ?`,
          [r.first_name, r.last_name, r.age, r.gender, r.phone, r.email, r.address, String(r.id)]
        )
        updated += 1
      } else {
        await pool.query(
          `INSERT INTO patients (patient_id, first_name, last_name, age, gender, phone, email, address, status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
          [String(r.id), r.first_name, r.last_name, r.age, r.gender, r.phone, r.email, r.address]
        )
        imported += 1
      }
    }
    return { imported, updated }
  } catch (error) {
    console.error('Error importing Ghana Health patients:', error)
    throw new Error('Failed to import Ghana Health patients')
  } finally {
    await connection.end()
  }
}
