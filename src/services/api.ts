import type { User } from "@/contexts/AuthContext";
import * as apiConfig from '@/config/api';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON
} from '@simplewebauthn/browser';

// Re-exported so existing consumers keep importing the origin from the API
// service. The value itself is resolved in `src/config/api.ts`.
export const { API_ORIGIN } = apiConfig;


interface SystemHealthResponse { status: string; }

export interface DemoRequestPayload {
  name: string;
  email: string;
  organization: string;
  role: string;
  organizationSize: '1-50' | '51-200' | '201-500' | '501-1000' | '1000+';
  preferredContact: 'email' | 'phone';
  phone?: string;
  message?: string;
  website?: string;
}

/** A passkey registered to the current user (server mirror of webauthn_credentials). */
export interface WebAuthnCredentialRecord {
  id: number;
  credential_id: string;
  device_name: string;
  created_at: string;
  last_used_at: string | null;
}

/**
 * Collection endpoints in this API answer with a named wrapper
 * (`{ hospitals: [...] }`), not a bare array.
 *
 * handleResponse<T> is an unchecked assertion -- `response.json()` is typed
 * `any` and cast to `T` -- so a wrapper where a bare array was declared
 * passed type-check silently and only surfaced at runtime as
 * "hospitals.map is not a function" behind the module error boundary. Every
 * collection call site now unwraps through here, and a non-array payload is
 * reported as such instead of crashing three components downstream.
 */
function unwrapCollection<T>(data: unknown, key: string): T[] {
  if (Array.isArray(data)) return data as T[];
  const wrapped = (data as Record<string, unknown> | null)?.[key];
  if (Array.isArray(wrapped)) return wrapped as T[];
  throw new Error(
    `Expected an array or { ${key}: [] } from the API, received ${describe(data)}. ` +
      'If this endpoint changed shape, update its client method and the matching page.'
  );
}

function describe(data: unknown): string {
  if (data === null || data === undefined) return String(data);
  if (typeof data === 'object') {
    const keys = Object.keys(data as object);
    return keys.length ? `{ ${keys.slice(0, 5).join(', ')} }` : '{}';
  }
  return typeof data;
}

/** Super-admin hospital overview record (GET /super-admin/hospitals). */
export interface SuperAdminHospital {
  id: string;
  hospital_id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  status: 'active' | 'inactive';
  beds: number;
  occupancy: number;
  departments: number;
  staff_count: number;
}

/** Super-admin user management record (GET /super-admin/users). */
export interface SuperAdminUser {
  id: string;
  email: string;
  name: string;
  status: 'active' | 'inactive' | 'locked';
  last_login: string | null;
  created_at: string;
  role_name: string;
  role_description: string;
}

/** Super-admin system setting (GET /super-admin/settings). */
export interface SuperAdminSetting {
  id: string;
  setting_key: string;
  setting_value: string;
  category: string;
}

/** Super-admin backup record (GET /super-admin/backups). */
export interface SuperAdminBackup {
  id: string;
  name: string;
  size: string;
  createdAt: string;
}

// The API base URL is resolved in one place (`src/config/api.ts`) from the
// environment, so a change to the rule cannot leave a stale copy behind in
// one of the modules that talks to the API.
const { API_BASE_URL } = apiConfig;

class ApiService {
  private cache: { [url: string]: any } = {};

  /**
   * The patient list used to be written to localStorage as a fallback for
   * offline use. That is a plaintext copy of the patient roster -- names,
   * contact details and addresses -- readable by any script on the origin and
   * surviving the browser cache being cleared. The in-memory cache below is
   * used instead: it lasts for the session and disappears with the tab.
   */
  getPatientsFromLocalStorage(): any[] | null {
    return this.cache['__patients__'] ?? null;
  }

  savePatientsToLocalStorage(patients: any[]): void {
    this.cache['__patients__'] = patients;
  }

  generateOfflineId(): string {
    return 'offline-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
  }

  /**
   * The CSRF token for unauthenticated state-changing requests.
   *
   * The server's double-submit check (server/src/middleware/csrf.ts) rejects
   * any non-GET without a matching x-xsrf-token unless a Bearer credential is
   * present, so login and the other pre-auth POSTs need one.
   *
   * It cannot come from document.cookie here: the API is a different origin
   * from the app, so the XSRF-TOKEN cookie is not visible to the app page at
   * all. The server therefore also returns the token in the
   * X-XSRF-Token response header, which CORS exposes. Cookie is kept as a
   * fallback for same-origin deployments.
   */
  private csrfToken: string | null = null;

  private async ensureCsrfToken(): Promise<void> {
    if (this.csrfToken) return;
    if (typeof window === 'undefined') return;
    try {
      const res = await fetch(`${API_BASE_URL}/auth/csrf`, { credentials: 'include' });
      const header = res.headers.get('x-xsrf-token');
      if (header) {
        this.csrfToken = header;
        return;
      }
    } catch {
      // fall through to the cookie path
    }
    if (typeof document !== 'undefined') {
      const prefix = 'XSRF-TOKEN=';
      for (const part of document.cookie.split(';')) {
        const entry = part.trim();
        if (entry.startsWith(prefix)) {
          this.csrfToken = decodeURIComponent(entry.slice(prefix.length));
          return;
        }
      }
    }
  }

  private getHeaders(includeAuth = true): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (includeAuth) {
      const token = localStorage.getItem('token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`; // Include auth header only if token exists
      }
    }

    // Only needed when there is no Bearer credential: the server skips the
    // check for authenticated requests, since a header cannot ride along
    // cross-origin on its own.
    if (!localStorage.getItem('token') && this.csrfToken) {
      headers['x-xsrf-token'] = this.csrfToken;
    }

    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || 'Request failed');
    }
    return response.json();
  }

  // Auth endpoints
  async login(email: string, password: string) {
    await this.ensureCsrfToken();
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      // The API is a different origin from the app (VITE_API_URL points at the
      // API host, the app is served from its own), so the session cookie has
      // to be replayed explicitly for the double-submit check to have a
      // session to match.
      credentials: 'include',
      headers: this.getHeaders(false),
      body: JSON.stringify({ email, password }),
    });
    return this.handleResponse(response);
  }

  async register(data: { email: string; password: string; name: string; roleId?: string; hospital?: string; department?: string }) {
    await this.ensureCsrfToken();
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      credentials: 'include',
      headers: this.getHeaders(false),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async requestDemo(data: DemoRequestPayload): Promise<{ message: string }> {
    // /api/demo-requests is on the server's CSRF exemption list (it accepts
    // anonymous submissions and has no session to protect), so no token is
    // needed. credentials is still set for consistency with the other
    // cross-origin calls.
    const response = await fetch(`${API_BASE_URL}/demo-requests`, {
      method: 'POST',
      headers: this.getHeaders(false),
      credentials: 'include',
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async forgotPassword(email: string) {
    await this.ensureCsrfToken();
    const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      credentials: 'include',
      headers: this.getHeaders(false),
      body: JSON.stringify({ email }),
    });
    return this.handleResponse(response);
  }

  async resetPassword(token: string, password: string) {
    await this.ensureCsrfToken();
    const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
      method: 'POST',
      credentials: 'include',
      headers: this.getHeaders(false),
      body: JSON.stringify({ token, password }),
    });
    return this.handleResponse(response);
  }

  async verifyTwoFactor(code: string, mfaToken?: string) {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    let hasBearer = false;
    if (mfaToken) {
      headers['Authorization'] = `Bearer ${mfaToken}`;
      hasBearer = true;
    } else {
      const token = localStorage.getItem('token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        hasBearer = true;
      }
    }
    // The server exempts Bearer requests from the CSRF check. Without one it
    // applies, so the token has to be present.
    if (!hasBearer) await this.ensureCsrfToken();
    const response = await fetch(`${API_BASE_URL}/auth/verify-2fa`, {
      method: 'POST',
      credentials: 'include',
      headers: hasBearer ? headers : { ...headers, 'x-xsrf-token': this.csrfToken ?? '' },
      body: JSON.stringify({ code }),
    });
    return this.handleResponse(response);
  }

  /** Verify a single-use offline recovery code issued at TOTP setup (backup login). */
  async verifyRecovery(code: string, mfaToken?: string) {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (mfaToken) {
      headers['Authorization'] = `Bearer ${mfaToken}`;
    } else {
      const token = localStorage.getItem('token');
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(`${API_BASE_URL}/auth/verify-recovery`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ code }),
    });
    return this.handleResponse(response);
  }

  /** Generate a fresh TOTP secret for authenticator pairing (stateless; persists only on confirm). */
  async totpEnroll(): Promise<{ secret: string; otpauthUrl: string }> {
    const response = await fetch(`${API_BASE_URL}/auth/totp/enroll`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  /** Verify a code against a secret and persist it (enables 2FA or rotates the key). */
  async totpConfirm(secret: string, code: string): Promise<{ enabled: boolean; recoveryCodes: string[] }> {
    const response = await fetch(`${API_BASE_URL}/auth/totp/confirm`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ secret, code }),
    });
    return this.handleResponse(response);
  }

  /** Verify a current code against the stored secret and remove it (disables 2FA). */
  async totpDisable(code: string): Promise<{ enabled: boolean }> {
    const response = await fetch(`${API_BASE_URL}/auth/totp/disable`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ code }),
    });
    return this.handleResponse(response);
  }

  async changePassword(currentPassword: string, newPassword: string) {
    const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    return this.handleResponse(response);
  }

  async postponePasswordChange() {
    const response = await fetch(`${API_BASE_URL}/auth/postpone-password-change`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async getMe(): Promise<{ user: User }> {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async getMfaEvents() {
    const response = await fetch(`${API_BASE_URL}/auth/mfa-events`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  /**
   * End the session on the server.
   *
   * The server records the token as revoked, so the session is genuinely
   * finished rather than merely forgotten by the browser.
   */
  async logout(): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    await this.handleResponse(response);
  }

  // ── WebAuthn passkeys ──────────────────────────────────────────────────────
  // Real browser attestation/assertion. The backend signs the ceremony
  // challenge into a short-lived token that is returned with the verify call.

  /** Start a passkey registration ceremony (authenticated). */
  async webauthnRegisterOptions(): Promise<{ options: PublicKeyCredentialCreationOptionsJSON; challengeToken: string }> {
    const response = await fetch(`${API_BASE_URL}/auth/webauthn/register/options`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  /** Verify + persist the credential returned by the browser ceremony. */
  async webauthnRegisterVerify(registration: RegistrationResponseJSON, challengeToken: string, deviceName?: string) {
    const response = await fetch(`${API_BASE_URL}/auth/webauthn/register/verify`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ registration, challengeToken, deviceName }),
    });
    return this.handleResponse(response);
  }

  /** Start a passkey login ceremony for the given account (public). */
  async webauthnLoginOptions(email: string): Promise<{ options: PublicKeyCredentialRequestOptionsJSON; challengeToken: string }> {
    await this.ensureCsrfToken();
    const response = await fetch(`${API_BASE_URL}/auth/webauthn/login/options`, {
      method: 'POST',
      credentials: 'include',
      headers: this.getHeaders(false),
      body: JSON.stringify({ email }),
    });
    return this.handleResponse(response);
  }

  /** Verify a passkey assertion and exchange it for a full session (mfa_pending token in header). */
  async webauthnLoginVerify(assertion: AuthenticationResponseJSON, challengeToken: string, mfaToken?: string) {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    let hasBearer = false;
    if (mfaToken) {
      headers['Authorization'] = `Bearer ${mfaToken}`;
      hasBearer = true;
    } else {
      const token = localStorage.getItem('token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        hasBearer = true;
      }
    }
    if (!hasBearer) await this.ensureCsrfToken();
    const response = await fetch(`${API_BASE_URL}/auth/webauthn/login/verify`, {
      method: 'POST',
      credentials: 'include',
      headers: hasBearer ? headers : { ...headers, 'x-xsrf-token': this.csrfToken ?? '' },
      body: JSON.stringify({ assertion, challengeToken }),
    });
    return this.handleResponse(response);
  }

  /** List the caller's registered passkeys. */
  async webauthnListCredentials(): Promise<{ credentials: WebAuthnCredentialRecord[] }> {
    const response = await fetch(`${API_BASE_URL}/auth/webauthn/credentials`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  /** Remove one of the caller's passkeys. */
  async webauthnDeleteCredential(credentialId: number) {
    const response = await fetch(`${API_BASE_URL}/auth/webauthn/credentials/${credentialId}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Patient endpoints
  async getPatients(params?: { search?: string; status?: string; hospital?: string }) {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    const url = API_BASE_URL + '/patients' + queryString;

    try {
      const response = await fetch(url, {
        headers: this.getHeaders(),
      });
      const data = await this.handleResponse(response) as any[];
      this.cache[url] = data;
      // Save to localStorage
      this.savePatientsToLocalStorage(data);
      return data;
    } catch (error) {
      console.warn('Failed to fetch patients from network, trying cache:', error);
      const cachedPatients = this.getPatientsFromLocalStorage();
      if (cachedPatients) {
        let filtered = [...cachedPatients];
        if (params?.search) {
          const s = params.search.toLowerCase();
          filtered = filtered.filter(p => 
            p.name?.toLowerCase().includes(s) || 
            p.id?.toLowerCase().includes(s) ||
            p.email?.toLowerCase().includes(s)
          );
        }
        if (params?.status) {
          filtered = filtered.filter(p => p.status?.toLowerCase() === params.status?.toLowerCase());
        }
        if (params?.hospital) {
          filtered = filtered.filter(p => p.hospital_id === params.hospital || p.hospital_name === params.hospital);
        }
        return filtered;
      }
      throw error;
    }
  }

  async getPatient(id: string) {
    const url = API_BASE_URL + '/patients/' + id;
    if (this.cache[url]) {
      console.log('Returning cached response for ' + url);
      return Promise.resolve(this.cache[url]);
    }
    const response = await fetch(url, {
      headers: this.getHeaders(),
    });
    const data = await this.handleResponse(response);
    this.cache[url] = data;
    return data;
  }

  async createPatient(data: any) {
    try {
      const response = await fetch(`${API_BASE_URL}/patients`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      });
      return this.handleResponse(response);
    } catch (error: any) {
      console.error('Failed to create patient (offline):', error);
      // Generate a temporary ID for offline creation
      const offlineId = this.generateOfflineId();
      const offlinePatient = { ...data, id: offlineId, isOffline: true, offlineAction: 'CREATE', clientUpdatedAt: new Date().toISOString() };
      // Store the patient data in localStorage
      const offlinePatients = JSON.parse(localStorage.getItem('offlinePatients') || '[]') as any[];
      offlinePatients.push(offlinePatient);
      localStorage.setItem('offlinePatients', JSON.stringify(offlinePatients));
      return { message: 'Patient created offline', patient: offlinePatient };
    }
  }

  async updatePatient(id: string, data: any) {
    try {
      const response = await fetch(`${API_BASE_URL}/patients/${id}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      });
      return this.handleResponse(response);
    } catch (error: any) {
      console.error('Failed to update patient (offline):', error);
      // Store the update action in localStorage
      const offlinePatients = JSON.parse(localStorage.getItem('offlinePatients') || '[]') as any[];
      const existingPatientIndex = offlinePatients.findIndex(patient => patient.id === id);
      if (existingPatientIndex !== -1) {
        offlinePatients[existingPatientIndex] = { ...offlinePatients[existingPatientIndex], ...data, offlineAction: 'UPDATE', clientUpdatedAt: new Date().toISOString() };
      } else {
        offlinePatients.push({ id: id, ...data, offlineAction: 'UPDATE', clientUpdatedAt: new Date().toISOString() });
      }
      localStorage.setItem('offlinePatients', JSON.stringify(offlinePatients));
      return { message: 'Patient updated offline', id: id };
    }
  }

  async deletePatient(id: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/patients/${id}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
      return this.handleResponse(response);
    } catch (error: any) {
      console.error('Failed to delete patient (offline):', error);
      // Store the deletion action in localStorage
      const offlinePatients = JSON.parse(localStorage.getItem('offlinePatients') || '[]') as any[];
      const existingPatientIndex = offlinePatients.findIndex(patient => patient.id === id);
      if (existingPatientIndex !== -1) {
        offlinePatients.splice(existingPatientIndex, 1);
      } else {
        offlinePatients.push({ id: id, offlineAction: 'DELETE' });
      }
      localStorage.setItem('offlinePatients', JSON.stringify(offlinePatients));
      return { message: 'Patient deleted offline', id: id };
    }
  }

  /**
   * Drain the offline patient queue.
   *
   * The queue was written on every failed create/update/delete but nothing
   * ever read it, so an edit made while offline was reported as saved and
   * then silently discarded. The operations are now pushed to the server and
   * the entries that the server accepted are removed.
   */
  async syncOfflinePatients(): Promise<{ applied: number; failed: number }> {
    let queued: any[];
    try {
      queued = JSON.parse(localStorage.getItem('offlinePatients') || '[]');
    } catch {
      queued = [];
    }
    if (!Array.isArray(queued) || queued.length === 0) {
      return { applied: 0, failed: 0 };
    }

    const operations = queued.map((entry) => ({
      action: entry.offlineAction ?? 'CREATE',
      id: entry.id,
      patient: entry,
      clientUpdatedAt: entry.clientUpdatedAt ?? null,
    }));

    const response = await fetch(`${API_BASE_URL}/patients/sync`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ operations }),
    });
    const result = (await this.handleResponse(response)) as any;
    const results: any[] = Array.isArray(result?.results) ? result.results : [];

    // Drop the operations the server confirmed. Anything it rejected stays
    // queued so the data is not lost.
    const acceptedIds = new Set(
      results.filter((r) => r?.applied).map((r) => String(r.id))
    );
    const remaining = queued.filter((entry) => !acceptedIds.has(String(entry.id)));

    if (remaining.length !== queued.length) {
      localStorage.setItem('offlinePatients', JSON.stringify(remaining));
    }

    return { applied: acceptedIds.size, failed: queued.length - acceptedIds.size };
  }

  // Dashboard endpoints
  async getDashboardStats() {
    const response = await fetch(`${API_BASE_URL}/dashboard/stats`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }
  async getFinancialForecast() {
    const response = await fetch(`${API_BASE_URL}/dashboard/financial-forecast`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }
  async getResourceOptimization() {
    const response = await fetch(`${API_BASE_URL}/dashboard/resource-optimization`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }
  async importGhanaHealthData() {
    const response = await fetch(`${API_BASE_URL}/dashboard/ghana-health-import`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Appointment endpoints
  async getAppointments(params?: { date?: string; status?: string; doctorId?: string; patientId?: string; hospital?: string }) {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    const url = API_BASE_URL + '/appointments' + queryString;
    if (this.cache[url]) {
      console.log('Returning cached response for ' + url);
      return Promise.resolve(this.cache[url]);
    }
    const response = await fetch(url, {
      headers: this.getHeaders(),
    });
    const data = await this.handleResponse(response);
    this.cache[url] = data;
    return data;
  }

  async getAppointment(id: string) {
    const url = API_BASE_URL + '/appointments/' + id;
    if (this.cache[url]) {
      console.log('Returning cached response for ' + url);
      return Promise.resolve(this.cache[url]);
    }
    const response = await fetch(url, {
      headers: this.getHeaders(),
    });
    const data = await this.handleResponse(response);
    this.cache[url] = data;
    return data;
  }

  async createAppointment(data: {
    patientId: string | number;
    doctorId?: string | number | null;
    departmentId?: string | number | null;
    appointmentDate: string;
    appointmentTime: string;
    type?: string;
    notes?: string;
    sendReminder?: boolean;
    // Tenant scope. The server compares this against the caller's hospital
    // before the appointment is written, so it must be sent as sent.
    hospitalId?: string;
  }) {
    // The body is mandatory: the route validates patientId, appointmentDate
    // and appointmentTime, and the controller writes the row from it. Sending
    // no body made every create fail with 400.
    const response = await fetch(`${API_BASE_URL}/appointments`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  // Super Admin endpoints
  async triggerRestore(backupFileName: string) {
    // The server takes a bare file name, not a path: it rejects anything with
    // a separator in it as a path-traversal attempt. The caller used to pass
    // "backups/<name>", which was always rejected.
    const fileName = backupFileName.split(/[\\/]/).pop() || backupFileName;
    const response = await fetch(`${API_BASE_URL}/super-admin/restore`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ backupFileName: fileName }),
    });
    return this.handleResponse(response);
  }

  async getSystemHealth(): Promise<SystemHealthResponse> {
    const response = await fetch(`${API_BASE_URL}/super-admin/health`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async getBackups(): Promise<SuperAdminBackup[]> {
    const response = await fetch(`${API_BASE_URL}/super-admin/backups`, {
      headers: this.getHeaders(),
    });
    // The API wraps collections in a named key; the caller wants the array.
    const data = await this.handleResponse<{ backups?: SuperAdminBackup[] } | SuperAdminBackup[]>(response);
    return unwrapCollection(data, 'backups');
  }

  async updateAppointment(id: string, data: any) {
    const response = await fetch(`${API_BASE_URL}/appointments/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async deleteAppointment(id: string) {
    const response = await fetch(`${API_BASE_URL}/appointments/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Hospital endpoints
  async getHospitals() {
    const url = API_BASE_URL + '/hospitals';
    if (this.cache[url]) {
      console.log('Returning cached response for ' + url);
      return Promise.resolve(this.cache[url]);
    }
    const response = await fetch(url, {
      headers: this.getHeaders(),
    });
    const data = await this.handleResponse(response);
    this.cache[url] = data;
    return data;
  }

  async createHospital(data: any) {
    const response = await fetch(`${API_BASE_URL}/hospitals`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async updateHospital(id: string, data: any) {
    const response = await fetch(`${API_BASE_URL}/hospitals/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async deleteHospital(id: string) {
    const response = await fetch(`${API_BASE_URL}/hospitals/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async getDepartmentsByHospital(hospitalId: string) {
    const response = await fetch(`${API_BASE_URL}/hospitals/${hospitalId}/departments`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Staff endpoints
  async getStaff() {
    const url = API_BASE_URL + '/staff';
    if (this.cache[url]) {
      console.log('Returning cached response for ' + url);
      return Promise.resolve(this.cache[url]);
    }
    const response = await fetch(url, {
      headers: this.getHeaders(),
    });
    const data = await this.handleResponse(response);
    this.cache[url] = data;
    return data;
  }

  async createStaff(data: any) {
    const response = await fetch(`${API_BASE_URL}/staff`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async updateStaff(id: string, data: any) {
    const response = await fetch(`${API_BASE_URL}/staff/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async deleteStaff(id: string) {
    const response = await fetch(`${API_BASE_URL}/staff/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Document endpoints
  async getDocuments() {
    const url = API_BASE_URL + '/documents';
    if (this.cache[url]) {
      console.log('Returning cached response for ' + url);
      return Promise.resolve(this.cache[url]);
    }
    const response = await fetch(url, {
      headers: this.getHeaders(),
    });
    const data = await this.handleResponse(response);
    this.cache[url] = data;
    return data;
  }

  async createDocument(data: any) {
    const response = await fetch(`${API_BASE_URL}/documents`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async uploadDocument(formData: FormData) {
    const headers: HeadersInit = {};
    const token = localStorage.getItem('token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const response = await fetch(`${API_BASE_URL}/documents`, {
      method: 'POST',
      headers,
      body: formData,
    });
    return this.handleResponse(response);
  }

  async deleteDocument(id: string) {
    const response = await fetch(`${API_BASE_URL}/documents/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }


  /** Fetch a document blob (preview or download) with the auth header attached. */
  async getDocumentBlob(id: string, action: 'preview' | 'download'): Promise<Blob> {
    const response = await fetch(`${API_BASE_URL}/documents/${id}/${action}`, {
      headers: this.getHeaders(),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(text || `Failed to ${action} document`);
    }
    return response.blob();
  }

  async downloadDocument(id: string): Promise<Blob> {
    return this.getDocumentBlob(id, 'download');
  }

  async previewDocument(id: string): Promise<Blob> {
    return this.getDocumentBlob(id, 'preview');
  }

  // Predictions & Ghana Health
  async getPatientLoadPredictions() {
    const response = await fetch(`${API_BASE_URL}/patient-load-predictions`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async getGhanaHealthData(): Promise<any[]> {
    const response = await fetch(`${API_BASE_URL}/dashboard/ghana-health-data`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Financial endpoints
  async getAccounts() {
    const response = await fetch(`${API_BASE_URL}/financial/accounts`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async getTransactions(params?: any) {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    const response = await fetch(`${API_BASE_URL}/financial/transactions${queryString}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async createAccount(data: any) {
    const response = await fetch(`${API_BASE_URL}/financial/accounts`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async updateAccount(id: string, data: any) {
    const response = await fetch(`${API_BASE_URL}/financial/accounts/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async deleteAccount(id: string) {
    const response = await fetch(`${API_BASE_URL}/financial/accounts/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async createTransaction(data: any) {
    const response = await fetch(`${API_BASE_URL}/financial/transactions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async updateTransaction(id: string, data: any) {
    const response = await fetch(`${API_BASE_URL}/financial/transactions/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async deleteTransaction(id: string) {
    const response = await fetch(`${API_BASE_URL}/financial/transactions/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Pharmacy & Inventory endpoints
  async getPharmacyReport(params?: any) {
    const queryString = params ? '?' + new URLSearchParams(params).toString() : '';
    const response = await fetch(`${API_BASE_URL}/pharmacy/reports${queryString}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async getMedicines() {
    const response = await fetch(`${API_BASE_URL}/pharmacy/medicines`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Prescriptions. The backend routes were already registered; the client had
  // no methods for them, so the fulfilment screen kept its own copy of the
  // prescription list in browser storage.
  async getPrescriptions() {
    const response = await fetch(`${API_BASE_URL}/prescriptions`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async getPrescription(id: string) {
    const response = await fetch(`${API_BASE_URL}/prescriptions/${id}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async createPrescription(data: {
    patient_id: string | number;
    doctor_id: string | number;
    medicine_id: string;
    dose: string;
    frequency: string;
    quantity: number;
    notes?: string;
  }) {
    const response = await fetch(`${API_BASE_URL}/prescriptions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async updatePrescription(id: string, data: { dose?: string; frequency?: string; quantity?: number }) {
    const response = await fetch(`${API_BASE_URL}/prescriptions/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async deletePrescription(id: string) {
    const response = await fetch(`${API_BASE_URL}/prescriptions/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // A refill restarts the course: the server resets the prescribed date so
  // the refill tracker works from the record rather than from a copy the
  // browser kept for itself.
  async refillPrescription(id: string) {
    const response = await fetch(`${API_BASE_URL}/prescriptions/${id}/refill`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Dispensing history is written server-side so it survives a cache clear.
  async recordDispensingEvent(data: {
    prescriptionId?: string;
    patientId: number;
    medicineId: string;
    quantity: number;
    notes?: string;
  }) {
    const response = await fetch(`${API_BASE_URL}/dispensing-events`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async getDispensingEvents(params: { patientId?: string | number; medicineId?: string; limit?: number } = {}) {
    const query = new URLSearchParams();
    if (params.patientId) query.set('patientId', String(params.patientId));
    if (params.medicineId) query.set('medicineId', params.medicineId);
    if (params.limit) query.set('limit', String(params.limit));
    const suffix = query.toString();
    const response = await fetch(`${API_BASE_URL}/dispensing-events${suffix ? `?${suffix}` : ''}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Medication administration records (MAR).
  async getMedicationAdministrations(params: { patientId?: string | number; status?: string; date?: string } = {}) {
    const query = new URLSearchParams();
    if (params.patientId) query.set('patientId', String(params.patientId));
    if (params.status) query.set('status', params.status);
    if (params.date) query.set('date', params.date);
    const suffix = query.toString();
    const response = await fetch(`${API_BASE_URL}/medication-administrations${suffix ? `?${suffix}` : ''}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async getMedicationAdministrationOptions() {
    const response = await fetch(`${API_BASE_URL}/medication-administrations/options`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async createMedicationAdministration(data: {
    patientId: number;
    medicineId: string;
    dosage: string;
    scheduledTime: string;
    assignedStaffId?: number | null;
    criticalNotes?: string;
  }) {
    const response = await fetch(`${API_BASE_URL}/medication-administrations`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  // Sign-off is the only path that moves stock. The server decrements the
  // inventory in the same transaction and refuses when the shelf is short.
  async signOffMedicationAdministration(id: string, quantity?: number) {
    const response = await fetch(`${API_BASE_URL}/medication-administrations/${id}/sign-off`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(quantity ? { quantity } : {}),
    });
    return this.handleResponse(response);
  }

  async getPharmacyForecast(params: { surgeMultiplier?: number; lookbackDays?: number; targetCoverDays?: number } = {}) {
    const query = new URLSearchParams();
    if (params.surgeMultiplier) query.set('surgeMultiplier', String(params.surgeMultiplier));
    if (params.lookbackDays) query.set('lookbackDays', String(params.lookbackDays));
    if (params.targetCoverDays) query.set('targetCoverDays', String(params.targetCoverDays));
    const suffix = query.toString();
    const response = await fetch(`${API_BASE_URL}/pharmacy/forecast${suffix ? `?${suffix}` : ''}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Vitals.
  async getVitals(params: { patientId?: string; from?: string; to?: string; limit?: number } = {}) {
    const query = new URLSearchParams();
    if (params.patientId) query.set('patientId', params.patientId);
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    if (params.limit) query.set('limit', String(params.limit));
    const suffix = query.toString();
    const response = await fetch(`${API_BASE_URL}/vitals${suffix ? `?${suffix}` : ''}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async recordVital(data: {
    patientId: string | number;
    systolicBp: number;
    diastolicBp: number;
    heartRate: number;
    temperature: number;
    respiratoryRate?: number;
    oxygenSaturation?: number;
    recordedAt?: string;
    notes?: string;
  }) {
    const response = await fetch(`${API_BASE_URL}/vitals`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  // Notifications.
  async getNotifications(params: { unread?: boolean; limit?: number } = {}) {
    const query = new URLSearchParams();
    if (params.unread) query.set('unread', 'true');
    if (params.limit) query.set('limit', String(params.limit));
    const suffix = query.toString();
    const response = await fetch(`${API_BASE_URL}/notifications${suffix ? `?${suffix}` : ''}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async markNotificationRead(id: string) {
    const response = await fetch(`${API_BASE_URL}/notifications/${id}/read`, {
      method: 'PATCH',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async markAllNotificationsRead() {
    const response = await fetch(`${API_BASE_URL}/notifications/read-all`, {
      method: 'PATCH',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Clinical notes.
  async getClinicalNotes(patientId: string) {
    const response = await fetch(`${API_BASE_URL}/clinical-notes?patientId=${encodeURIComponent(patientId)}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async createClinicalNote(data: { patientId: string | number; content: string; tags?: string[] }) {
    const response = await fetch(`${API_BASE_URL}/clinical-notes`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async deleteClinicalNote(id: string) {
    const response = await fetch(`${API_BASE_URL}/clinical-notes/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Medicine batches (lot / expiry tracking).
  async getBatches(medicineId?: string) {
    const query = medicineId ? `?medicineId=${encodeURIComponent(medicineId)}` : '';
    const response = await fetch(`${API_BASE_URL}/batches${query}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async getBatch(id: string) {
    const response = await fetch(`${API_BASE_URL}/batches/${id}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async createBatch(data: { medicineId: string; batchNumber: string; expiryDate: string; quantity: number }) {
    const response = await fetch(`${API_BASE_URL}/batches`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async updateBatch(id: string, data: { batchNumber?: string; expiryDate?: string; quantity?: number; recalled?: boolean }) {
    const response = await fetch(`${API_BASE_URL}/batches/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async deleteBatch(id: string) {
    const response = await fetch(`${API_BASE_URL}/batches/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async recallBatch(id: string) {
    const response = await fetch(`${API_BASE_URL}/batches/${id}/recall`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async createPharmacyItem(data: any) {
    const response = await fetch(`${API_BASE_URL}/pharmacy/medicines`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async updatePharmacyItem(id: string, data: any) {
    const response = await fetch(`${API_BASE_URL}/pharmacy/medicines/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async getSuppliers() {
    const response = await fetch(`${API_BASE_URL}/suppliers`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async createSupplier(data: any) {
    const response = await fetch(`${API_BASE_URL}/suppliers`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async getPurchaseOrders() {
    const response = await fetch(`${API_BASE_URL}/purchase-orders`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async createPurchaseOrder(data: any) {
    const response = await fetch(`${API_BASE_URL}/purchase-orders`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async updatePurchaseOrder(id: string, data: any) {
    const response = await fetch(`${API_BASE_URL}/purchase-orders/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  // Roles endpoints
  async getRoles() {
    const response = await fetch(`${API_BASE_URL}/roles`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async createRole(data: any) {
    const response = await fetch(`${API_BASE_URL}/roles`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  // Settings endpoints
  async getSettings() {
    const response = await fetch(`${API_BASE_URL}/settings`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async updateSettings(data: any) {
    const response = await fetch(`${API_BASE_URL}/settings`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  // Super Admin endpoints
  async getAuditLogs(limitOrParams?: number | any, offset?: number) {
    let queryString = '';
    if (typeof limitOrParams === 'number') {
      queryString = `?limit=${limitOrParams}${offset !== undefined ? `&offset=${offset}` : ''}`;
    } else if (limitOrParams) {
      queryString = '?' + new URLSearchParams(limitOrParams).toString();
    }
    const response = await fetch(`${API_BASE_URL}/super-admin/audit-logs${queryString}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async getSystemStatus() {
    // The route is /super-admin/system-status. This called /super-admin/status,
    // which does not exist, so the console dashboard rendered
    // "Error loading dashboard — Not found" for every super admin.
    const response = await fetch(`${API_BASE_URL}/super-admin/system-status`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async triggerBackup() {
    const response = await fetch(`${API_BASE_URL}/super-admin/backup`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async getAllHospitalsAdmin(): Promise<SuperAdminHospital[]> {
    const response = await fetch(`${API_BASE_URL}/super-admin/hospitals`, {
      headers: this.getHeaders(),
    });
    const data = await this.handleResponse<{ hospitals?: SuperAdminHospital[] } | SuperAdminHospital[]>(response);
    return unwrapCollection(data, 'hospitals');
  }

  async triggerUpgrade(version?: string, description?: string) {
    const response = await fetch(`${API_BASE_URL}/super-admin/upgrade`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ version, description }),
    });
    return this.handleResponse(response);
  }

  async getSystemSettings(): Promise<SuperAdminSetting[]> {
    const response = await fetch(`${API_BASE_URL}/super-admin/settings`, {
      headers: this.getHeaders(),
    });
    const data = await this.handleResponse<{ settings?: SuperAdminSetting[] } | SuperAdminSetting[]>(response);
    return unwrapCollection(data, 'settings');
  }

  async updateSystemSetting(settingIdOrData: string | any, value?: any) {
    const body = typeof settingIdOrData === 'string'
      ? { key: settingIdOrData, value }
      : settingIdOrData;
    const response = await fetch(`${API_BASE_URL}/super-admin/settings`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    });
    return this.handleResponse(response);
  }

  async getAllUsers(): Promise<SuperAdminUser[]> {
    const response = await fetch(`${API_BASE_URL}/super-admin/users`, {
      headers: this.getHeaders(),
    });
    const data = await this.handleResponse<{ users?: SuperAdminUser[] } | SuperAdminUser[]>(response);
    return unwrapCollection(data, 'users');
  }

  async updateUserStatus(id: string, status: string): Promise<void> {
    // PATCH, matching router.patch('/users/:userId/status'). This sent PUT, which
    // has no matching route, so every lock/unlock and activate/deactivate 404'd
    // and the table never appeared to update.
    const response = await fetch(`${API_BASE_URL}/super-admin/users/${id}/status`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify({ status }),
    });
    return this.handleResponse(response);
  }

  async resetUserPassword(id: string, clearTwoFactor = false): Promise<{ temporaryPassword: string; twoFactorDisabled: boolean }> {
    const response = await fetch(`${API_BASE_URL}/super-admin/users/${id}/reset-password`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ clear_two_factor: clearTwoFactor }),
    });
    return this.handleResponse(response);
  }

}

export const api = new ApiService();

// Push any patient edits that were queued while the network was down. The
// queue is drained on start-up and whenever the browser reports it is back
// online, so an offline edit is not stranded in browser storage.
if (typeof window !== 'undefined') {
  const drain = () => {
    api.syncOfflinePatients().catch((error) => {
      console.warn('Failed to sync offline patient changes:', error);
    });
  };
  window.addEventListener('online', drain);
  window.addEventListener('load', drain);
}
