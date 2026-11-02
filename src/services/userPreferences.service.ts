import { getCookieToken } from "@/contexts/AuthContext";
import { API_ORIGIN } from "@/config/api";

export interface UserPreferencePayload {
  category: string;
  key: string;
  value?: string | null;
}

export const getUserPreferences = async (): Promise<Record<string, Record<string, string | null>>> => {
  const token = getCookieToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_ORIGIN}/user-preferences`, {
    method: 'GET',
    headers,
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to load preferences');
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
  return (await res.json()) as { message: string };
};
