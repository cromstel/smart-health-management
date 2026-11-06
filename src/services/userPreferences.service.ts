import { getCookieToken } from "@/contexts/AuthContext";
import { API_ORIGIN } from "@/config/api";

export interface UserPreferencePayload {
  category: string;
  key: string;
  value?: string | null;
}

/**
 * A failed preference call must reject. `fetch` resolves on 4xx/5xx, so a
 * missing check here reports a save that never happened as success.
 */
const requireOk = async (res: Response, fallback: string): Promise<void> => {
  if (res.ok) return;
  let detail = '';
  try {
    const body = (await res.json()) as { error?: string; errors?: unknown };
    if (body?.error) detail = body.error;
  } catch {
    // Non-JSON error body: the status is the only information there is.
  }
  throw new Error(detail || `${fallback} (${res.status})`);
};

export const getUserPreferences = async (): Promise<Record<string, Record<string, string | null>>> => {
  const token = getCookieToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_ORIGIN}/user-preferences`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });
  await requireOk(res, 'Could not load preferences');
  return (await res.json()) as Record<string, Record<string, string | null>>;
};

export const saveUserPreference = async (payload: UserPreferencePayload): Promise<{ message: string }> => {
  const token = getCookieToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_ORIGIN}/user-preferences`, {
    method: 'PUT',
    headers,
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  await requireOk(res, 'Could not save preference');
  return (await res.json()) as { message: string };
};

export const deleteUserPreference = async (category: string, key: string): Promise<{ message: string }> => {
  const token = getCookieToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_ORIGIN}/user-preferences/${encodeURIComponent(category)}/${encodeURIComponent(key)}`, {
    method: 'DELETE',
    headers,
    credentials: 'include',
  });
  await requireOk(res, 'Could not remove preference');
  return (await res.json()) as { message: string };
};
