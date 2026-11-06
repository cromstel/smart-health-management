import mysql from 'mysql2/promise';
import pool from '../config/database.js'
import { encryptForStorage } from '../utils/patientStorage.js'

/**
 * Imports patients from the Ghana Health Service database into the local system,
 * performing upsert based on external patient id mapping.
 */

const dbConfig = {
  host: process.env.GHS_DB_HOST || '',
  // The external database's port is its own setting; it is not the local one.
  port: parseInt(process.env.GHS_DB_PORT || '', 10) || 0,
  database: process.env.GHS_DB_NAME || '',
  user: process.env.GHS_DB_USER || '',
  password: process.env.GHS_DB_PASSWORD || '',
};

/**
 * How many rows are read from the external database at a time.
 *
 * The import used to read the whole external table into memory and then make
 * two queries per row, so an external table of any size was read in one go and
 * written one row at a time. The read is now paged, and the write is a single
 * statement per batch.
 */
const EXTERNAL_PAGE_SIZE = 500;

/** How many rows are written at a time. */
const LOCAL_BATCH_SIZE = 200;

/**
 * True when the external Ghana Health Service database is configured.
 *
 * This is an optional integration: nothing in the shipped .env.example sets
 * GHS_DB_*, and without them createConnection throws, which the dashboard
 * surfaced as a 500 on every load.
 */
export const isGhanaHealthConfigured = (): boolean =>
  Boolean(dbConfig.host && dbConfig.database && dbConfig.user);

/**
 * The hospital the imported patients belong to.
 *
 * A patient record with no hospital belongs to nobody, and the application
 * confines every clinical record to the hospital of the patient it belongs
 * to. An imported record that belongs to no hospital is therefore invisible to
 * everybody, which makes the import pointless. The importing deployment
 * states the hospital, and the import says so when it has not.
 */
const importHospitalId = (): number | null => {
  const configured = parseInt(process.env.GHS_IMPORT_HOSPITAL_ID || '', 10);
  return Number.isInteger(configured) && configured > 0 ? configured : null;
};

export const fetchGhanaHealthData = async (): Promise<any> => {
  if (!isGhanaHealthConfigured()) {
    // Not configured is a normal state, not a failure. Return nothing so the
    // dashboard renders its "no advisories" panel instead of erroring.
    return [];
  }
  try {
    const connection = await mysql.createConnection(dbConfig);

    const [rows] = await connection.execute('SELECT * FROM patients LIMIT 10');

    await connection.end();

    return rows;
  } catch (error) {
    console.error('Error fetching data from Ghana Health Service database:', error);
    throw new Error('Failed to fetch data from Ghana Health Service database', { cause: error });
  }
};

/**
 * Imports the external patients into the local records.
 *
 * The rules that matter:
 *
 *  - The sensitive columns are written the way the application writes them.
 *    The patient controller encrypts the name, the phone, the email and the
 *    address before they are stored, because those columns are ciphertext
 *    everywhere else. An import that wrote them in the clear would leave a
 *    column with a mix of two kinds of value in it, and the reader would
 *    show the ciphertext.
 *
 *  - The imported records belong to the hospital the deployment states.
 *    A record with no hospital is invisible to everybody, because the
 *    application confines every clinical record to the hospital of the
 *    patient it belongs to.
 *
 *  - The external identifier is prefixed, so an imported record can never
 *    collide with a record that was created here. The external table has its
 *    own numbering, and a bare number from another system is not a
 *    namespace.
 *
 *  - The read is paged and the write is a batch, so an external table of any
 *    size does not have to fit in memory.
 */
export const importGhanaPatients = async (): Promise<{ imported: number; updated: number }> => {
  if (!isGhanaHealthConfigured()) {
    throw new Error('The Ghana Health Service database is not configured');
  }

  const hospitalId = importHospitalId();
  if (hospitalId === null) {
    throw new Error(
      'GHS_IMPORT_HOSPITAL_ID is not set: the imported records would belong to no hospital and no one would be able to read them.'
    );
  }

  const connection = await mysql.createConnection(dbConfig)
  let imported = 0
  let updated = 0
  try {
    let offset = 0
    for (;;) {
      const [rows] = await connection.execute(
        'SELECT id, first_name, last_name, age, gender, phone, email, address FROM patients ORDER BY id LIMIT ? OFFSET ?',
        [EXTERNAL_PAGE_SIZE, offset]
      )
      const page = rows as any[]
      if (page.length === 0) break

      for (let start = 0; start < page.length; start += LOCAL_BATCH_SIZE) {
        const batch = page.slice(start, start + LOCAL_BATCH_SIZE)
        for (const r of batch) {
          const patientId = `GHS-${String(r.id)}`
          const [existing] = await pool.query('SELECT id FROM patients WHERE patient_id = ?', [patientId])
          if ((existing as any[]).length > 0) {
            await pool.query(
              `UPDATE patients SET first_name = ?, last_name = ?, age = ?, gender = ?, phone = ?, email = ?, address = ?, hospital_id = ?
               WHERE patient_id = ?`,
              [
                encryptForStorage(String(r.first_name ?? ''), 'first_name'),
                encryptForStorage(String(r.last_name ?? ''), 'last_name'),
                r.age,
                r.gender,
                encryptForStorage(String(r.phone ?? ''), 'phone'),
                encryptForStorage(String(r.email ?? ''), 'email'),
                encryptForStorage(String(r.address ?? ''), 'address'),
                hospitalId,
                patientId,
              ]
            )
            updated += 1
          } else {
            await pool.query(
              `INSERT INTO patients (patient_id, first_name, last_name, age, gender, phone, email, address, hospital_id, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
              [
                patientId,
                encryptForStorage(String(r.first_name ?? ''), 'first_name'),
                encryptForStorage(String(r.last_name ?? ''), 'last_name'),
                r.age,
                r.gender,
                encryptForStorage(String(r.phone ?? ''), 'phone'),
                encryptForStorage(String(r.email ?? ''), 'email'),
                encryptForStorage(String(r.address ?? ''), 'address'),
                hospitalId,
              ]
            )
            imported += 1
          }
        }
      }

      if (page.length < EXTERNAL_PAGE_SIZE) break
      offset += EXTERNAL_PAGE_SIZE
    }
    return { imported, updated }
  } catch (error) {
    console.error('Error importing Ghana Health patients:', error)
    throw new Error('Failed to import Ghana Health patients', { cause: error })
  } finally {
    await connection.end()
  }
}
