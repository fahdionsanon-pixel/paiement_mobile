// API Client Service - Connects Ionic app to Node.js backend
// Base URL configurable, handles auth tokens

import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, firstValueFrom } from 'rxjs';

export interface ApiConfig {
  baseUrl: string;
  timeout: number;
}

const DEFAULT_CONFIG: ApiConfig = {
  baseUrl: 'http://localhost:3000',
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
      const res = await firstValueFrom(this.http.get<T>(url, options));
      return res;
    } else if (method === 'POST') {
      const res = await firstValueFrom(this.http.post<T>(url, body, options));
      return res;
    } else if (method === 'PUT') {
      const res = await firstValueFrom(this.http.put<T>(url, body, options));
      return res;
    } else if (method === 'DELETE') {
      const res = await firstValueFrom(this.http.delete<T>(url, options));
      return res;
    }

    throw new Error('Méthode non supportée');
  }

  // ===== OTP =====
  async sendOtp(phone: string): Promise<any> {
    return this.request('POST', '/api/otp/send', { phone }, false);
  }

  async verifyOtp(phone: string, code: string): Promise<any> {
    return this.request('POST', '/api/otp/verify', { phone, code }, false);
  }

  // ===== PIN =====
  async setPin(phone: string, pin: string): Promise<any> {
    return this.request('POST', '/api/pin/set', { phone, pin }, false);
  }

  async verifyPin(phone: string, pin: string): Promise<any> {
    return this.request('POST', '/api/pin/verify', { phone, pin }, false);
  }

  // ===== Session =====
  async createSession(phone: string, deviceName?: string): Promise<any> {
    return this.request('POST', '/api/session/create', { phone, deviceName }, false);
  }

  async validateSession(): Promise<any> {
    return this.request('GET', '/api/session/validate', undefined, true);
  }

  async revokeSession(): Promise<any> {
    return this.request('POST', '/api/session/revoke', undefined, true);
  }

  // ===== Auth =====
  async login(phone: string): Promise<any> {
    return this.request('POST', '/api/auth/login', { phone }, false);
  }

  // ===== Transfer =====
  async sendMoney(phone: string, recipientPhone: string, amount: number, pin: string): Promise<any> {
    return this.request('POST', '/api/transfer/send', {
      phone,
      recipientPhone,
      amount,
      pin,
    }, true);
  }

  // ===== Transactions =====
  async getTransactions(phone: string): Promise<any> {
    return this.request('GET', '/api/transactions/list', { phone }, true);
  }

  async getTransaction(reference: string): Promise<any> {
    return this.request('GET', `/api/transactions/${reference}`, undefined, true);
  }

  // ===== Health =====
  async healthCheck(): Promise<any> {
    return this.request('GET', '/health', undefined, false);
  }
}

export default ApiClientService;