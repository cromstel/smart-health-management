/**
 * Clinical notes service.
 *
 * Clinical notes used to live in the browser: the voice dictation modal
 * wrote `clinical_notes_<patientId>` into localStorage, which put the note
 * text and the patient's name in plaintext browser storage on a shared
 * workstation. Notes are PHI, so they belong on the server, in the
 * `clinical_notes` table, behind the patient's access permissions.
 *
 * The author of a note is never taken from the request: it comes from the
 * authenticated user.
 */
import pool from '../config/database.js';
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';

export interface ClinicalNoteRecord {
  id: string;
  patientId: string;
  patientName: string;
  /** Display name of the clinician who wrote the note. */
  doctorName: string;
  authorId?: string;
  content: string;
  /** ISO-8601 creation time. */
  timestamp: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
}

export interface ClinicalNoteFilters {
  /** Restrict to notes written by this user. */
  authorId?: number;
  limit?: number;
  offset?: number;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/** A clinical note is text; the column is TEXT (64 KiB). */
export const MAX_NOTE_LENGTH = 20000;

function parseTags(value: unknown): string[] | undefined {
  if (value === null || value === undefined) return undefined;

  if (Array.isArray(value)) {
    const tags = value.filter((tag): tag is string => typeof tag === 'string').map((tag) => tag.trim());
    return tags.length > 0 ? tags : undefined;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        const tags = parsed.filter((tag): tag is string => typeof tag === 'string').map((tag) => tag.trim());
        return tags.length > 0 ? tags : undefined;
      }
    } catch {
      return undefined;
    }
  }

  return undefined;
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
  }
  return new Date().toISOString();
}

function mapRow(row: any): ClinicalNoteRecord {
  const createdAt = toIso(row.created_at);
  const patientName =
    row.patient_name ??
    [row.patient_first_name, row.patient_last_name].filter(Boolean).join(' ').trim();

  return {
    id: String(row.id),
    patientId: String(row.patient_id),
    patientName,
    doctorName: row.author_name ?? '',
    authorId: row.author_id === null || row.author_id === undefined ? undefined : String(row.author_id),
    content: row.content ?? '',
    timestamp: createdAt,
    createdAt,
    updatedAt: toIso(row.updated_at),
    tags: parseTags(row.tags),
  };
}

/**
 * Lists the notes of one patient, newest first.
 */
export async function listClinicalNotes(
  patientId: number,
  filters: ClinicalNoteFilters = {}
): Promise<{ notes: ClinicalNoteRecord[]; total: number; limit: number; offset: number }> {
  const clauses: string[] = ['cn.patient_id = ?'];
  const params: any[] = [patientId];

  if (filters.authorId !== undefined) {
    clauses.push('cn.author_id = ?');
    params.push(filters.authorId);
  }

  const where = ` WHERE ${clauses.join(' AND ')}`;
  const limit = Math.min(Math.max(Number(filters.limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const offset = Math.max(Number(filters.offset) || 0, 0);

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT cn.id,
            cn.patient_id,
            cn.author_id,
            cn.author_name,
            cn.content,
            cn.tags,
            cn.created_at,
            cn.updated_at,
            p.first_name AS patient_first_name,
            p.last_name AS patient_last_name
       FROM clinical_notes cn
       JOIN patients p ON p.id = cn.patient_id${where}
      ORDER BY cn.created_at DESC, cn.id DESC
      LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );

  const [countRows] = await pool.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS count FROM clinical_notes cn${where}`,
    params
  );

  return {
    notes: rows.map((row: any) => mapRow(row)),
    total: Number(countRows?.[0]?.count ?? 0),
    limit,
    offset,
  };
}

/**
 * Reads one note.
 */
export async function getClinicalNote(id: number): Promise<ClinicalNoteRecord | null> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT cn.id,
            cn.patient_id,
            cn.author_id,
            cn.author_name,
            cn.content,
            cn.tags,
            cn.created_at,
            cn.updated_at,
            p.first_name AS patient_first_name,
            p.last_name AS patient_last_name
       FROM clinical_notes cn
       JOIN patients p ON p.id = cn.patient_id
      WHERE cn.id = ?
      LIMIT 1`,
    [id]
  );

  if (rows.length === 0) return null;
  return mapRow(rows[0]);
}

/**
 * Creates a note. The author comes from the session, never the request.
 */
export async function createClinicalNote(input: {
  patientId: number;
  authorId: number | null;
  authorName: string | null;
  content: string;
  tags?: string[] | null;
}): Promise<ClinicalNoteRecord> {
  const tags = input.tags && input.tags.length > 0 ? JSON.stringify(input.tags) : null;

  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO clinical_notes (patient_id, author_id, author_name, content, tags)
     VALUES (?, ?, ?, ?, ?)`,
    [input.patientId, input.authorId, input.authorName, input.content, tags]
  );

  const created = await getClinicalNote(result.insertId);
  if (!created) {
    throw new Error('Clinical note could not be read back after creation');
  }
  return created;
}

/**
 * Updates the content and/or the tags of a note.
 */
export async function updateClinicalNote(
  id: number,
  input: { content?: string; tags?: string[] | null }
): Promise<ClinicalNoteRecord | null> {
  const sets: string[] = [];
  const params: any[] = [];

  if (input.content !== undefined) {
    sets.push('content = ?');
    params.push(input.content);
  }
  if (input.tags !== undefined) {
    sets.push('tags = ?');
    params.push(input.tags && input.tags.length > 0 ? JSON.stringify(input.tags) : null);
  }

  if (sets.length === 0) return getClinicalNote(id);

  const [result] = await pool.query<ResultSetHeader>(
    `UPDATE clinical_notes SET ${sets.join(', ')} WHERE id = ?`,
    [...params, id]
  );

  if (result.affectedRows === 0) return null;
  return getClinicalNote(id);
}

/**
 * Deletes a note.
 */
export async function deleteClinicalNote(id: number): Promise<boolean> {
  const [result] = await pool.query<ResultSetHeader>('DELETE FROM clinical_notes WHERE id = ?', [id]);
  return result.affectedRows > 0;
}

/**
 * True when the patient exists. Used to answer 404 instead of a foreign key
 * error when a note is created for an unknown patient.
 */
export async function patientExists(patientId: number): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT id FROM patients WHERE id = ? LIMIT 1', [
    patientId,
  ]);
  return rows.length > 0;
}

/**
 * Resolves the patient a note belongs to.
 *
 * The browser identifies patients by their public code ("PAT-001"), while
 * the table is keyed by the numeric primary key. Both are accepted so the
 * client does not have to know which one the API stores.
 */
export async function resolvePatientId(value: string | number): Promise<number | null> {
  const asString = String(value ?? '').trim();
  if (!asString) return null;

  if (/^\d+$/.test(asString)) {
    const numeric = Number(asString);
    const [primaryKeyRows] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM patients WHERE id = ? LIMIT 1',
      [numeric]
    );
    if (primaryKeyRows.length > 0) return Number(primaryKeyRows[0].id);
  }

  const [codeRows] = await pool.query<RowDataPacket[]>(
    'SELECT id FROM patients WHERE patient_id = ? LIMIT 1',
    [asString]
  );
  if (codeRows.length > 0) return Number(codeRows[0].id);

  return null;
}

/**
 * The display name of a user, used as the note author.
 */
export async function getAuthorName(userId: number): Promise<string | null> {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT name FROM users WHERE id = ? LIMIT 1', [
    userId,
  ]);
  return rows[0]?.name ?? null;
}

/**
 * Removes control characters from free text.
 *
 * Implemented by code point rather than a regular expression so the intent
 * is explicit and the linter's control-character rule does not apply. Line
 * breaks and tabs survive because a clinical note is read as prose.
 */
export function stripControlCharacters(value: string, keepLineBreaks = false): string {
  let result = '';

  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code === 127) continue;
    if (code < 32) {
      if (keepLineBreaks && (code === 9 || code === 10)) result += character;
      continue;
    }
    result += character;
  }

  return result;
}

/**
 * Normalises free text written by a clinician.
 *
 * Control characters are stripped (line breaks and tabs are kept, because a
 * clinical note is read as prose) and the result is trimmed. HTML is NOT
 * escaped: the note is stored and rendered as text, and escaping it here
 * would corrupt the record (an ampersand in a drug name would be stored as
 * "&amp;"). React escapes on render.
 */
export function sanitizeNoteContent(value: string): string {
  return stripControlCharacters(value, true).trim();
}

/**
 * Normalises the optional tag list.
 */
export function sanitizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const tags: string[] = [];

  for (const raw of value) {
    if (typeof raw !== 'string') continue;
    const tag = stripControlCharacters(raw).trim().slice(0, 64);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length >= 20) break;
  }

  return tags;
}
