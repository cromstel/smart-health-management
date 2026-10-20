/**
 * Clinical notes tests.
 *
 * Clinical notes are PHI, so the important properties are that they are
 * stored on the server, that the author comes from the session and not from
 * the request, and that the content round-trips unchanged apart from the
 * control characters that are stripped.
 */
import { describe, it, expect, afterAll } from 'vitest';
import pool from '../config/database.js';
import * as clinicalNotesService from '../services/clinicalNotes.service.js';

let dbAvailable = false;

const TEST_EMAIL = `notes-test-${Date.now()}@smarthealth.com`;
let testUserId = 0;
let testPatientId = 0;
let testPatientCode = '';

async function seedFixture(): Promise<void> {
  const [userResult] = await pool.query(
    `INSERT INTO users (email, password, name, status, role_id, hospital_id)
     VALUES (?, 'not-a-real-hash', 'Clinical Notes Tester', 'active', 1, 1)`,
    [TEST_EMAIL]
  );
  testUserId = Number((userResult as any).insertId);

  testPatientCode = `NCP-${Date.now()}`;
  const [patientResult] = await pool.query(
    `INSERT INTO patients (patient_id, first_name, last_name, age, gender, hospital_id, status)
     VALUES (?, 'Note', 'Subject', 51, 'other', 1, 'active')`,
    [testPatientCode]
  );
  testPatientId = Number((patientResult as any).insertId);
}

async function cleanupFixture(): Promise<void> {
  if (testPatientId) {
    await pool.query('DELETE FROM clinical_notes WHERE patient_id = ?', [testPatientId]);
    await pool.query('DELETE FROM patients WHERE id = ?', [testPatientId]);
  }
  if (testUserId) {
    await pool.query('DELETE FROM users WHERE id = ?', [testUserId]);
  }
}

// The database is probed before the suite is collected, not in a beforeAll:
// `it.skip` has to be decided while the file is being collected, and a
// beforeAll runs after that, so a probe there would skip every test.
try {
  await pool.query('SELECT 1 FROM clinical_notes LIMIT 1');
  await seedFixture();
  dbAvailable = true;
} catch (error) {
  console.warn(
    'Clinical notes tests skipped: database not available',
    error instanceof Error ? error.message : String(error)
  );
  dbAvailable = false;
}

const skipIfNoDb = dbAvailable ? it : it.skip;

describe('Clinical notes service', () => {
  afterAll(async () => {
    if (!dbAvailable) return;
    await cleanupFixture();
  });

  describe('sanitizers', () => {
    it('strips control characters but keeps line breaks', () => {
      const cleaned = clinicalNotesService.sanitizeNoteContent('Line one\nLine two\u0000\u0007');
      expect(cleaned).toBe('Line one\nLine two');
    });

    it('does not HTML-escape clinical text', () => {
      // Escaping here would store "AT&amp;T" in the record.
      expect(clinicalNotesService.sanitizeNoteContent('AT&T <3')).toBe('AT&T <3');
    });

    it('keeps only unique, non-empty tags', () => {
      expect(clinicalNotesService.sanitizeTags(['Cardiology', 'cardiology', '  ', 'Post-Op'])).toEqual([
        'Cardiology',
        'Post-Op',
      ]);
      expect(clinicalNotesService.sanitizeTags('not an array')).toEqual([]);
    });
  });

  skipIfNoDb('resolves a patient by primary key and by public code', async () => {
    expect(await clinicalNotesService.resolvePatientId(String(testPatientId))).toBe(testPatientId);
    expect(await clinicalNotesService.resolvePatientId(testPatientCode)).toBe(testPatientId);
    expect(await clinicalNotesService.resolvePatientId('NOPE-999')).toBeNull();
  });

  skipIfNoDb('stores a note with the author taken from the session', async () => {
    const note = await clinicalNotesService.createClinicalNote({
      patientId: testPatientId,
      authorId: testUserId,
      authorName: 'Clinical Notes Tester',
      content: 'Patient reports mild cough for three days.',
      tags: ['General Consultation'],
    });

    expect(note.id).toBeTruthy();
    expect(note.patientId).toBe(String(testPatientId));
    expect(note.doctorName).toBe('Clinical Notes Tester');
    expect(note.content).toBe('Patient reports mild cough for three days.');
    expect(note.tags).toEqual(['General Consultation']);

    const [rows] = await pool.query('SELECT author_id FROM clinical_notes WHERE id = ?', [note.id]);
    expect(Number((rows[0] as any).author_id)).toBe(testUserId);
  });

  skipIfNoDb('lists the notes of a patient, newest first', async () => {
    await clinicalNotesService.createClinicalNote({
      patientId: testPatientId,
      authorId: testUserId,
      authorName: 'Clinical Notes Tester',
      content: 'First note',
    });
    await new Promise((resolve) => setTimeout(resolve, 1100));
    await clinicalNotesService.createClinicalNote({
      patientId: testPatientId,
      authorId: testUserId,
      authorName: 'Clinical Notes Tester',
      content: 'Second note',
    });

    const list = await clinicalNotesService.listClinicalNotes(testPatientId);
    expect(list.notes.length).toBeGreaterThanOrEqual(2);
    expect(list.notes[0].content).toBe('Second note');

    const mine = await clinicalNotesService.listClinicalNotes(testPatientId, {
      authorId: testUserId,
    });
    expect(mine.notes.every((note) => note.authorId === String(testUserId))).toBe(true);
  });

  skipIfNoDb('updates and deletes a note', async () => {
    const note = await clinicalNotesService.createClinicalNote({
      patientId: testPatientId,
      authorId: testUserId,
      authorName: 'Clinical Notes Tester',
      content: 'Before',
    });

    const updated = await clinicalNotesService.updateClinicalNote(Number(note.id), {
      content: 'After',
      tags: ['Cardiology Follow-up'],
    });
    expect(updated?.content).toBe('After');
    expect(updated?.tags).toEqual(['Cardiology Follow-up']);

    expect(await clinicalNotesService.deleteClinicalNote(Number(note.id))).toBe(true);
    expect(await clinicalNotesService.getClinicalNote(Number(note.id))).toBeNull();
  });
});
