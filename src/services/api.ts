import type { User } from "@/contexts/AuthContext";


interface SystemHealthResponse { status: string; }

export interface DemoRequestPayload {
  name: string;
  email: string;
  organization: string;
  role: string;
  organizationSize: '1-50' | '51-250' | '251-1000' | '1000+';
  preferredContact: 'email' | 'phone';
  phone?: string;
  message?: string;
  website?: string;
}

let configuredUrl = import.meta.env.VITE_API_URL || '/api';
if (import.meta.env.DEV && configuredUrl.includes('localhost:5600')) {
  // Use Vite's local mock API middleware if the default 5600 is injected but not running
  configuredUrl = '/api';
}
const API_BASE_URL = configuredUrl;
export const API_ORIGIN = API_BASE_URL.startsWith('http') ? API_BASE_URL.replace(/\/api$/, '') : '';

class ApiService {
  private cache: { [url: string]: any } = {};

  getPatientsFromLocalStorage(): any[] | null {
    try {
      const data = localStorage.getItem('cached_patients');
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  savePatientsToLocalStorage(patients: any[]): void {
    try {
      localStorage.setItem('cached_patients', JSON.stringify(patients));
    } catch (e) {
      console.warn('Failed to save patients to localStorage', e);
    }
  }

  generateOfflineId(): string {
    return 'offline-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
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
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: this.getHeaders(false),
      body: JSON.stringify({ email, password }),
    });
    return this.handleResponse(response);
  }

  async register(data: { email: string; password: string; name: string; roleId?: string; hospital?: string; department?: string }) {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: this.getHeaders(false),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async requestDemo(data: DemoRequestPayload): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/demo-requests`, {
      method: 'POST',
      headers: this.getHeaders(false),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async forgotPassword(email: string) {
    const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: this.getHeaders(false),
      body: JSON.stringify({ email }),
    });
    return this.handleResponse(response);
  }

  async resetPassword(token: string, password: string) {
    const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: this.getHeaders(false),
      body: JSON.stringify({ token, password }),
    });
    return this.handleResponse(response);
  }

  async verifyTwoFactor(code: string, mfaToken?: string) {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (mfaToken) {
      headers['Authorization'] = `Bearer ${mfaToken}`;
    } else {
      const token = localStorage.getItem('token');
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }
    const response = await fetch(`${API_BASE_URL}/auth/verify-2fa`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ code }),
    });
    return this.handleResponse(response);
  }

  /** DEV-only: current valid TOTP code for the seeded demo user (auto-fill button). */
  async devCurrentTotp(): Promise<{ code: string }> {
    const response = await fetch(`${API_BASE_URL}/auth/dev-totp-current`);
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

  async createAppointment(_data: any) {
    const response = await fetch(`${API_BASE_URL}/appointments`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Super Admin endpoints
  async triggerRestore(_backupPath: string) {
    const response = await fetch(`${API_BASE_URL}/super-admin/restore`, {
      method: 'POST',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async getSystemHealth(): Promise<SystemHealthResponse> {
    const response = await fetch(`${API_BASE_URL}/super-admin/health`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async getBackups() {
    const response = await fetch(`${API_BASE_URL}/super-admin/backups`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
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

  async createTransaction(data: any) {
    const response = await fetch(`${API_BASE_URL}/financial/transactions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
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
    const response = await fetch(`${API_BASE_URL}/super-admin/status`, {
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

  async getAllHospitalsAdmin() {
    const response = await fetch(`${API_BASE_URL}/super-admin/hospitals`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async triggerUpgrade(version?: string, description?: string) {
    const response = await fetch(`${API_BASE_URL}/super-admin/upgrade`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ version, description }),
    });
    return this.handleResponse(response);
  }

  async getSystemSettings() {
    const response = await fetch(`${API_BASE_URL}/super-admin/settings`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
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

  async getAllUsers() {
    const response = await fetch(`${API_BASE_URL}/super-admin/users`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async updateUserStatus(id: string, status: string) {
    const response = await fetch(`${API_BASE_URL}/super-admin/users/${id}/status`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ status }),
    });
    return this.handleResponse(response);
  }

  async resetUserPassword(id: string, clearTwoFactor = false) {
    const response = await fetch(`${API_BASE_URL}/super-admin/users/${id}/reset-password`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ clear_two_factor: clearTwoFactor }),
    });
    return this.handleResponse(response);
  }

}

export const api = new ApiService();
