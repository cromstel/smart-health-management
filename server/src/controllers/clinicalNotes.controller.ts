/**
 * Clinical notes controller.
 *
 * Thin layer: express-validator owns the input contract, the service owns
 * the behaviour and the SQL.
 *
 * The author of a note is taken from the authenticated user, never from the
 * request body, so a client cannot write a note in someone else's name.
 */
import type { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import type { AuthRequest } from '../middleware/auth.js';
import { patientBelongsToTenant } from '../middleware/tenant.js';
import * as clinicalNotesService from '../services/clinicalNotes.service.js';

const handleValidation = (req: Request, res: Response): boolean => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ errors: errors.array() });
    return true;
  }
  return false;
};

function resolveUserId(req: AuthRequest, res: Response): number | null {
  const userId = Number(req.user?.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  return userId;
}

/**
 * GET /api/clinical-notes?patientId=
 *
 * The notes of one patient, newest first. `?mine=true` restricts the list to
 * the notes written by the caller.
 */
export const getClinicalNotes = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (handleValidation(req, res)) return;

    const userId = resolveUserId(req, res);
    if (userId === null) return;

    const query = req.query as Record<string, string | undefined>;

    const patientId = await clinicalNotesService.resolvePatientId(String(query.patientId ?? ''));
    if (patientId === null) {
      res.status(404).json({ error: 'Patient not found' });
      return;
    }

    // The note is the patient's, and the patient belongs to a hospital. A
    // patient that belongs to another hospital is not found for this caller.
    if (!(await patientBelongsToTenant(patientId, req.tenant))) {
      res.status(404).json({ error: 'Patient not found' });
      return;
    }

    const result = await clinicalNotesService.listClinicalNotes(patientId, {
      authorId: query.mine === 'true' ? userId : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
      offset: query.offset ? Number(query.offset) : undefined,
    });

    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching clinical notes:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Failed to fetch clinical notes' });
  }
};

/**
 * GET /api/clinical-notes/:id
 */
export const getClinicalNoteById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (handleValidation(req, res)) return;

    const note = await clinicalNotesService.getClinicalNote(Number(req.params.id));

    if (!note) {
      res.status(404).json({ error: 'Clinical note not found' });
      return;
    }

    // The note belongs to a patient, and the patient belongs to a hospital.
    if (!(await patientBelongsToTenant(Number(note.patientId), req.tenant))) {
      res.status(404).json({ error: 'Clinical note not found' });
      return;
    }

    res.status(200).json(note);
  } catch (error) {
    console.error('Error fetching clinical note:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Failed to fetch clinical note' });
  }
};

/**
 * POST /api/clinical-notes
 */
export const createClinicalNote = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (handleValidation(req, res)) return;

    const userId = resolveUserId(req, res);
    if (userId === null) return;

    const body = req.body ?? {};
    const content = clinicalNotesService.sanitizeNoteContent(String(body.content ?? ''));

    if (!content) {
      res.status(400).json({ error: 'Clinical note content cannot be empty' });
      return;
    }

    const patientId = await clinicalNotesService.resolvePatientId(String(body.patientId ?? ''));
    if (patientId === null) {
      res.status(404).json({ error: 'Patient not found' });
      return;
    }

    // A note is written on a patient of the caller's own hospital.
    if (!(await patientBelongsToTenant(patientId, req.tenant))) {
      res.status(404).json({ error: 'Patient not found' });
      return;
    }

    const note = await clinicalNotesService.createClinicalNote({
      patientId,
      authorId: userId,
      authorName: await clinicalNotesService.getAuthorName(userId),
      content,
      tags: clinicalNotesService.sanitizeTags(body.tags),
    });

    res.status(201).json(note);
  } catch (error) {
    console.error('Error creating clinical note:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Failed to create clinical note' });
  }
};

/**
 * PUT /api/clinical-notes/:id
 */
export const updateClinicalNote = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (handleValidation(req, res)) return;

    const body = req.body ?? {};

    const input: { content?: string; tags?: string[] } = {};

    if (body.content !== undefined) {
      const content = clinicalNotesService.sanitizeNoteContent(String(body.content ?? ''));
      if (!content) {
        res.status(400).json({ error: 'Clinical note content cannot be empty' });
        return;
      }
      input.content = content;
    }

    if (body.tags !== undefined) {
      input.tags = clinicalNotesService.sanitizeTags(body.tags);
    }

    const note = await clinicalNotesService.updateClinicalNote(Number(req.params.id), input);

    if (!note) {
      res.status(404).json({ error: 'Clinical note not found' });
      return;
    }

    // The note belongs to a patient of the caller's own hospital.
    if (!(await patientBelongsToTenant(Number(note.patientId), req.tenant))) {
      res.status(404).json({ error: 'Clinical note not found' });
      return;
    }

    res.status(200).json(note);
  } catch (error) {
    console.error('Error updating clinical note:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Failed to update clinical note' });
  }
};

/**
 * DELETE /api/clinical-notes/:id
 */
export const deleteClinicalNote = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (handleValidation(req, res)) return;

    const note = await clinicalNotesService.getClinicalNote(Number(req.params.id));
    if (!note) {
      res.status(404).json({ error: 'Clinical note not found' });
      return;
    }

    // The note belongs to a patient of the caller's own hospital. A note
    // belonging to another hospital is not deleted and is not found.
    if (!(await patientBelongsToTenant(Number(note.patientId), req.tenant))) {
      res.status(404).json({ error: 'Clinical note not found' });
      return;
    }

    const deleted = await clinicalNotesService.deleteClinicalNote(Number(req.params.id));

    if (!deleted) {
      res.status(404).json({ error: 'Clinical note not found' });
      return;
    }

    res.status(200).json({ message: 'Clinical note deleted' });
  } catch (error) {
    console.error('Error deleting clinical note:', error instanceof Error ? error.message : error);
    res.status(500).json({ error: 'Failed to delete clinical note' });
  }
};
