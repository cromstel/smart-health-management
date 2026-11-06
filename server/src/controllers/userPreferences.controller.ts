import type { Response } from 'express';
import pool from '../config/database.js';
import type { AuthRequest } from '../middleware/auth.js';

/**
 * The most preference rows one account may hold.
 *
 * The key space is chosen by the client, so without a ceiling an authenticated
 * account could write rows without bound — the table only ever grows and the
 * read that hydrates the browser returns all of them. The limit is generous
 * for real use (a few settings per surface) and is refused as a client error,
 * not as a failure of the service.
 */
const MAX_PREFERENCES_PER_ACCOUNT = 200;

export interface UserPreference {
  id: number;
  user_id: number;
  category: string;
  preference_key: string;
  preference_value: string | null;
  updated_at: string;
  created_at: string;
}

export const getPreferences = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const [rows] = await pool.query(
      'SELECT * FROM user_preferences WHERE user_id = ? ORDER BY category, preference_key',
      [userId]
    );
    const grouped: Record<string, Record<string, string | null>> = {};
    for (const row of rows as UserPreference[]) {
      if (!grouped[row.category]) grouped[row.category] = {};
      grouped[row.category][row.preference_key] = row.preference_value;
    }
    res.status(200).json(grouped);
  } catch (error) {
    console.error('Get preferences error:', error);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
};

export const setPreference = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const { category, key, value } = req.body as { category?: string; key?: string; value?: string | null };
    if (!category || !key) {
      res.status(400).json({ error: 'Missing category or key' });
      return;
    }

    // Replacing an existing preference is always allowed; only a new row can
    // push the account over its ceiling.
    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total,
              SUM(category = ? AND preference_key = ?) AS existing
       FROM user_preferences
       WHERE user_id = ?`,
      [category, key, userId]
    );
    const counts = (countRows as Array<{ total: number | string; existing: number | string | null }>)[0];
    const total = Number(counts?.total ?? 0);
    const existing = Number(counts?.existing ?? 0);
    if (total >= MAX_PREFERENCES_PER_ACCOUNT && existing === 0) {
      res.status(400).json({
        error: `This account already holds the maximum of ${MAX_PREFERENCES_PER_ACCOUNT} preferences`,
      });
      return;
    }

    await pool.query(
      `INSERT INTO user_preferences (user_id, category, preference_key, preference_value)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE preference_value = ?`,
      [userId, category, key, value, value]
    );
    res.status(200).json({ message: 'Preference saved' });
  } catch (error) {
    console.error('Set preference error:', error);
    res.status(500).json({ error: 'Failed to save preference' });
  }
};

export const deletePreference = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    const { category, key } = req.params as { category?: string; key?: string };
    if (!category || !key) {
      res.status(400).json({ error: 'Missing category or key' });
      return;
    }
    await pool.query(
      'DELETE FROM user_preferences WHERE user_id = ? AND category = ? AND preference_key = ?',
      [userId, category, key]
    );
    res.status(200).json({ message: 'Preference removed' });
  } catch (error) {
    console.error('Delete preference error:', error);
    res.status(500).json({ error: 'Failed to delete preference' });
  }
};
