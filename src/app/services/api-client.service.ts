// API Client Service - Connects Ionic app to PHP/WAMP backend
// Base URL configurable, handles auth tokens

import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';

export interface ApiConfig {
  baseUrl: string;
  timeout: number;
}

const DEFAULT_CONFIG: ApiConfig = {
  baseUrl: 'http://localhost',
  timeout: 30000,
};

@Injectable({
  providedIn: 'root',
})
export class ApiClientService {
  private config: ApiConfig = { ...DEFAULT_CONFIG };
  private currentToken: string | null = null;

  constructor(private http: HttpClient) {
    // Restore saved config
    try {
      const saved = localStorage.getItem('paypulse_api_config');
      if (saved) {
        this.config = { ...this.config, ...JSON.parse(saved) };
      }
    } catch (e) {}

    // Restore auth token
    try {
      this.currentToken = localStorage.getItem('paypulse_session_token');
    } catch (e) {}
  }

  // Configuration
  getConfig(): ApiConfig {
    return { ...this.config };
  }

  setConfig(config: Partial<ApiConfig>): void {
    this.config = { ...this.config, ...config };
    try {
      localStorage.setItem('paypulse_api_config', JSON.stringify(this.config));
    } catch (e) {}
  }

  getBaseUrl(): string {
    return this.config.baseUrl;
  }

  // Auth token management
  setToken(token: string): void {
    this.currentToken = token;
    try {
      localStorage.setItem('paypulse_session_token', token);
    } catch (e) {}
  }

  getToken(): string | null {
    return this.currentToken;
  }

  clearToken(): void {
    this.currentToken = null;
    try {
      localStorage.removeItem('paypulse_session_token');
    } catch (e) {}
  }

  // Generic request method
  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    body?: any,
    requireAuth: boolean = true
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (requireAuth && this.currentToken) {
      headers['Authorization'] = `Bearer ${this.currentToken}`;
    }

    const options: any = {
      headers,
    };

    if (method === 'GET') {
      if (body) {
        options.params = new HttpParams({ ...body });
      }
      const res = await firstValueFrom(this.http.get<any>(url, options));
      return res as T;
    } else if (method === 'POST') {
      const res = await firstValueFrom(this.http.post<any>(url, body, options));
      return res as T;
    } else if (method === 'PUT') {
      const res = await firstValueFrom(this.http.put<any>(url, body, options));
      return res as T;
    } else if (method === 'DELETE') {
      const res = await firstValueFrom(this.http.delete<any>(url, options));
      return res as T;
    }

    throw new Error('Méthode non supportée');
  }

  // ===== OTP =====
  async sendOtp(phone: string): Promise<any> {
    return this.request('POST', '/send_sms.php', { phone }, false);
  }

  async verifyOtp(phone: string, code: string): Promise<any> {
    return this.request('POST', '/verify_sms.php', { phone, code }, false);
  }

  // ===== Session (simulated for PHP backend) =====
  async validateSession(): Promise<any> {
    // For PHP backend, session is local - just check if we have a token
    return { success: !!this.currentToken };
  }

  async revokeSession(): Promise<any> {
    this.clearToken();
    return { success: true };
  }

  // ===== User Data =====
  async getUserData(phone: string): Promise<any> {
    return this.request('GET', '/get_data.php', { phone }, false);
  }

  // ===== Transfer =====
  async sendMoney(phone: string, recipientPhone: string, amount: number, note?: string, category?: string): Promise<any> {
    return this.request('POST', '/send_money.php', {
      phone,
      recipientPhone,
      amount,
      note: note || 'Transfert instantané PayPulse',
      category: category || 'transfer',
    }, true);
  }

  // ===== Top Up =====
  async topUp(phone: string, amount: number, method: string = 'card'): Promise<any> {
    return this.request('POST', '/top_up.php', {
      phone,
      amount,
      method,
    }, true);
  }

  // ===== Profile =====
  async updateProfile(phone: string, name: string): Promise<any> {
    return this.request('POST', '/update_profile.php', { phone, name }, true);
  }

  // ===== Sync =====
  async syncData(phone: string, pendingTransactions: any[] = []): Promise<any> {
    return this.request('POST', '/sync.php', {
      phone,
      pending_transactions: pendingTransactions,
    }, true);
  }

  // ===== Health =====
  async healthCheck(): Promise<any> {
    return this.request('GET', '/health', undefined, false);
  }
}

export default ApiClientService;