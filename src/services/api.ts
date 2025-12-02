import type { User } from "@/contexts/AuthContext";


interface SystemHealthResponse { status: string; }

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5600/api';
export const API_ORIGIN = API_BASE_URL.replace(/\/api$/, '');

class ApiService {
  private cache: { [url: string]: any } = {};

  private getHeaders(includeAuth = true): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    // Get CSRF token from cookie (set by backend)
    if (typeof document !== 'undefined') {
      const csrfToken = this.getCookie('XSRF-TOKEN');
      if (csrfToken) {
        headers['X-XSRF-TOKEN'] = csrfToken;
      }
    }

    // For backward compatibility: still support Authorization header if token exists in localStorage
    // TODO: Remove this after full migration to httpOnly cookies
    if (includeAuth) {
      const token = localStorage.getItem('token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  private getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      return parts.pop()?.split(';').shift() || null;
    }
    return null;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      // Handle 401 Unauthorized - clear token and redirect to login
      if (response.status === 401) {
        localStorage.removeItem('token');
        // Token in httpOnly cookie will be cleared by backend on next request
      }
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
      credentials: 'include', // Important: send cookies (httpOnly token)
      body: JSON.stringify({ email, password }),
    });
    const data = await this.handleResponse(response);
    
    // For backward compatibility: still store token in localStorage if returned
    // TODO: Remove this after full migration to httpOnly cookies
    if ((data as any).token) {
      localStorage.setItem('token', (data as any).token);
    }
    
    return data;
  }

  async register(data: { email: string; password: string; name: string; roleId?: string }) {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: this.getHeaders(false),
      credentials: 'include', // Send cookies
      body: JSON.stringify(data),
    });
    const result = await this.handleResponse(response);
    
    // For backward compatibility: store token if returned
    if ((result as any).token) {
      localStorage.setItem('token', (result as any).token);
    }
    
    return result;
  }

  async forgotPassword(email: string) {
    const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: this.getHeaders(false),
      credentials: 'include',
      body: JSON.stringify({ email }),
    });
    return this.handleResponse(response);
  }

  async resetPassword(token: string, password: string) {
    const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: this.getHeaders(false),
      credentials: 'include',
      body: JSON.stringify({ token, password }),
    });
    return this.handleResponse(response);
  }

  async verifyTwoFactor(code: string) {
    const response = await fetch(`${API_BASE_URL}/auth/verify-2fa`, {
      method: 'POST',
      headers: this.getHeaders(),
      credentials: 'include',
      body: JSON.stringify({ code }),
    });
    return this.handleResponse(response);
  }

  async changePassword(currentPassword: string, newPassword: string) {
    const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
      method: 'POST',
      headers: this.getHeaders(),
      credentials: 'include',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    return this.handleResponse(response);
  }

  async postponePasswordChange() {
    const response = await fetch(`${API_BASE_URL}/auth/postpone-password-change`, {
      method: 'POST',
      headers: this.getHeaders(),
      credentials: 'include',
    });
    return this.handleResponse(response);
  }

  async logout() {
    const response = await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: this.getHeaders(),
      credentials: 'include', // Send cookies
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

    // Check localStorage first for offline support
    const cachedPatients = this.getPatientsFromLocalStorage();
    if (cachedPatients) {
      console.log('Returning cached patients from localStorage');
      return Promise.resolve(cachedPatients);
    }

    if (this.cache[url]) {
      console.log('Returning cached response for ' + url);
      return Promise.resolve(this.cache[url]);
    }
    const response = await fetch(url, {
      headers: this.getHeaders(),
      credentials: 'include', // Send cookies for authentication
    });
    const data = await this.handleResponse(response) as any[];
    this.cache[url] = data;
    // Save to localStorage
    this.savePatientsToLocalStorage(data);
    return data;
  }

  async getPatient(id: string) {
    const url = API_BASE_URL + '/patients/' + id;
    if (this.cache[url]) {
      console.log('Returning cached response for ' + url);
      return Promise.resolve(this.cache[url]);
    }
    const response = await fetch(url, {
      headers: this.getHeaders(),
      credentials: 'include', // Send cookies for authentication
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
        credentials: 'include', // Send cookies for authentication
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

  async createAppointment(data: any) {
    const response = await fetch(`${API_BASE_URL}/appointments`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  // Purchase Order endpoints
  async getPurchaseOrders() {
    const url = API_BASE_URL + '/purchase-orders';
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

  async updatePurchaseOrder(id: string, data: any) {
    const response = await fetch(`${API_BASE_URL}/purchase-orders/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  // Pharmacy reports with parameter
  async getPharmacyReport(reportType: string) {
    const url = `${API_BASE_URL}/pharmacy/reports?reportType=${reportType}`;
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

  // Pharmacy reports with parameter
  async getPharmacyReports() {
    const response = await fetch(`${API_BASE_URL}/pharmacy/reports`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Dashboard analytics endpoints
  async getPatientLoadPredictions() {
    const response = await fetch(`${API_BASE_URL}/patient-load-predictions`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async getGhanaHealthData() {
    const response = await fetch(`${API_BASE_URL}/dashboard/ghana-health-data`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  // Super Admin endpoints
  async getSystemStatus() {
    const response = await fetch(`${API_BASE_URL}/super-admin/system-status`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async getAllUsers() {
    const url = API_BASE_URL + '/super-admin/users';
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

  async updateUserStatus(userId: string, status: 'active' | 'inactive' | 'locked') {
    const response = await fetch(`${API_BASE_URL}/super-admin/users/${userId}/status`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify({ status }),
    });
    return this.handleResponse(response);
  }

  async getAllHospitalsAdmin() {
    const url = API_BASE_URL + '/super-admin/hospitals';
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

  async getAuditLogs(limit = 100, offset = 0) {
    const response = await fetch(`${API_BASE_URL}/super-admin/audit-logs?limit=${limit}&offset=${offset}`, {
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

  async triggerUpgrade(version: string, description: string) {
    const response = await fetch(`${API_BASE_URL}/super-admin/upgrade`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ version, description }),
    });
    return this.handleResponse(response);
  }

  async getSystemSettings() {
    const url = API_BASE_URL + '/super-admin/settings';
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

  async updateSystemSetting(settingId: string, settingValue: string) {
    const response = await fetch(`${API_BASE_URL}/super-admin/settings/${settingId}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify({ setting_value: settingValue }),
    });
    return this.handleResponse(response);
  }

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

  // Financial endpoints
  async getAccounts() {
    const url = API_BASE_URL + '/financial/accounts';
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

  async createAccount(data: any) {
    const response = await fetch(`${API_BASE_URL}/financial/accounts`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async getTransactions(params?: { accountId?: string; dateFrom?: string; dateTo?: string }) {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    const url = API_BASE_URL + '/financial/transactions' + queryString;
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

  async getTransactionById(id: string) {
    const url = API_BASE_URL + '/financial/transactions/' + id;
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

  async createTransaction(data: any) {
    const response = await fetch(`${API_BASE_URL}/financial/transactions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async getFinancialReports(params?: { reportType?: string; dateFrom?: string; dateTo?: string }) {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    const response = await fetch(`${API_BASE_URL}/financial/reports${queryString}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async createInvoice(data: any) {
    const response = await fetch(`${API_BASE_URL}/financial/invoices`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async finalizeInvoice(id: string, data?: any) {
    const response = await fetch(`${API_BASE_URL}/financial/invoices/${id}/finalize`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data || {}),
    });
    return this.handleResponse(response);
  }

  async recordPayment(data: any) {
    const response = await fetch(`${API_BASE_URL}/financial/payments`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async createExpense(data: any) {
    const response = await fetch(`${API_BASE_URL}/financial/expenses`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async createPayroll(data: any) {
    const response = await fetch(`${API_BASE_URL}/financial/payroll`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async createTaxRule(data: any) {
    const response = await fetch(`${API_BASE_URL}/financial/tax-rules`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async calculateTax(data: any) {
    const response = await fetch(`${API_BASE_URL}/financial/tax/calculate`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async forecast(params?: { period?: string; forecastType?: string }) {
    const queryString = params ? '?' + new URLSearchParams(params as any).toString() : '';
    const response = await fetch(`${API_BASE_URL}/financial/forecast${queryString}`, {
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async createCustomer(data: any) {
    const response = await fetch(`${API_BASE_URL}/financial/customers`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async createCharge(data: any) {
    const response = await fetch(`${API_BASE_URL}/financial/charges`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  // Roles endpoints
  async getRoles() {
    const url = API_BASE_URL + '/roles';
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

  async getRoleById(id: string) {
    const url = API_BASE_URL + '/roles/' + id;
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

  async createRole(data: any) {
    const response = await fetch(`${API_BASE_URL}/roles`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async updateRole(id: string, data: any) {
    const response = await fetch(`${API_BASE_URL}/roles/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  async deleteRole(id: string) {
    const response = await fetch(`${API_BASE_URL}/roles/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    return this.handleResponse(response);
  }

  async updateRolePermissions(id: string, data: any) {
    const response = await fetch(`${API_BASE_URL}/roles/${id}/permissions`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  // Settings endpoints
  async getSettings() {
    const url = API_BASE_URL + '/settings';
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

  async updateSettings(data: any) {
    const response = await fetch(`${API_BASE_URL}/settings`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }

  // Helper methods for localStorage support
  private getPatientsFromLocalStorage() {
    try {
      const cached = localStorage.getItem('cachedPatients');
      if (!cached) return null;
      const parsed = JSON.parse(cached);
      const oneHourAgo = Date.now() - 1000 * 60 * 60;
      if (parsed.timestamp > oneHourAgo) {
        return parsed.data;
      }
      return null;
    } catch (error) {
      console.error('Error reading patients from localStorage:', error);
      return null;
    }
  }

  private savePatientsToLocalStorage(data: any[]) {
    try {
      localStorage.setItem('cachedPatients', JSON.stringify({
        data,
        timestamp: Date.now(),
      }));
    } catch (error) {
      console.error('Error saving patients to localStorage:', error);
    }
  }

  private generateOfflineId() {
    return `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Pharmacy endpoints
  async getMedicines() {
    const response = await fetch(`${API_BASE_URL}/pharmacy/medicines`, {
      headers: this.getHeaders(),
      credentials: 'include',
    });
    return this.handleResponse(response);
  }

  async createPharmacyItem(medicine: any) {
    const response = await fetch(`${API_BASE_URL}/pharmacy/medicines`, {
      method: 'POST',
      headers: this.getHeaders(),
      credentials: 'include',
      body: JSON.stringify(medicine),
    });
    return this.handleResponse(response);
  }

  async updatePharmacyItem(id: string, updates: any) {
    const response = await fetch(`${API_BASE_URL}/pharmacy/medicines/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      credentials: 'include',
      body: JSON.stringify(updates),
    });
    return this.handleResponse(response);
  }

  // Supplier endpoints
  async getSuppliers() {
    const response = await fetch(`${API_BASE_URL}/suppliers`, {
      headers: this.getHeaders(),
      credentials: 'include',
    });
    return this.handleResponse(response);
  }

  async createSupplier(supplier: { name: string; contact_person?: string; email?: string; phone?: string; address?: string }) {
    const response = await fetch(`${API_BASE_URL}/suppliers`, {
      method: 'POST',
      headers: this.getHeaders(),
      credentials: 'include',
      body: JSON.stringify(supplier),
    });
    return this.handleResponse(response);
  }

  // Purchase Order endpoints
  async createPurchaseOrder(order: any) {
    const response = await fetch(`${API_BASE_URL}/purchase-orders`, {
      method: 'POST',
      headers: this.getHeaders(),
      credentials: 'include',
      body: JSON.stringify(order),
    });
    return this.handleResponse(response);
  }

  // Sync offline patients when back online
  async syncOfflinePatients(): Promise<{ synced: number; conflicts: number }> {
    const offlinePatients = JSON.parse(localStorage.getItem('offlinePatients') || '[]') as any[];
    let synced = 0;
    let conflicts = 0;

    for (const offline of offlinePatients) {
      try {
        if (offline.offlineAction === 'CREATE') {
          // Check if server has it (by patient_id or similar)
          const existing = await this.getPatients();
          const exists = existing.some((p: any) => p.patient_id === offline.patient_id);
          if (!exists) {
            await fetch(`${API_BASE_URL}/patients`, {
              method: 'POST',
              headers: this.getHeaders(),
              body: JSON.stringify(offline),
            });
            synced++;
          } else {
            conflicts++; // Server has it, conflict
          }
        } else if (offline.offlineAction === 'UPDATE') {
          // For updates, server has priority if modified later
          const serverPatient = await this.getPatient(offline.id);
          if (serverPatient) {
            const serverUpdate = new Date(serverPatient.updated_at || 0);
            const clientUpdate = new Date(offline.clientUpdatedAt || 0);
            if (clientUpdate > serverUpdate) {
              await fetch(`${API_BASE_URL}/patients/${offline.id}`, {
                method: 'PUT',
                headers: this.getHeaders(),
                body: JSON.stringify(offline),
              });
              synced++;
            } else {
              conflicts++; // Server version newer
            }
          }
        } else if (offline.offlineAction === 'DELETE') {
          // Try to delete, ignore if not found
          await fetch(`${API_BASE_URL}/patients/${offline.id}`, {
            method: 'DELETE',
            headers: this.getHeaders(),
          }).catch(() => {}); // Ignore 404
          synced++;
        }
      } catch (error) {
        console.error('Failed to sync offline patient:', error);
      }
    }

    // Clear synced items from localStorage
    localStorage.removeItem('offlinePatients');
    return { synced, conflicts };
  }
}

export const api = new ApiService();
