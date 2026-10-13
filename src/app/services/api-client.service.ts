// Service API : connecte l'app Ionic à l'API Node.js
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

const TOKEN_KEY = 'paypulse_session_token';

@Injectable({ providedIn: 'root' })
export class ApiClientService {
  private baseUrl: string = environment.apiUrl;
  private currentToken: string | null = null;

  constructor(private http: HttpClient) {
    try {
      this.currentToken = localStorage.getItem(TOKEN_KEY);
    } catch (e) {}
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  // ===== Jeton de session =====
  setToken(token: string): void {
    this.currentToken = token;
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch (e) {}
  }

  getToken(): string | null {
    return this.currentToken;
  }

  clearToken(): void {
    this.currentToken = null;
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch (e) {}
  }

  // ===== Requête générique avec gestion 401 =====
  private async request<T>(
    method: 'GET' | 'POST',
    endpoint: string,
    body?: any,
    requireAuth: boolean = true,
    isRetry: boolean = false
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (requireAuth && this.currentToken) {
      headers['Authorization'] = `Bearer ${this.currentToken}`;
    }

    try {
      let result: T;
      if (method === 'GET') {
        const params = body ? new HttpParams({ fromObject: body }) : undefined;
        result = await firstValueFrom(
          this.http.get<T>(url, { headers, params }).pipe(
            catchError((err: HttpErrorResponse) => throwError(() => err))
          )
        );
      } else {
        result = await firstValueFrom(
          this.http.post<T>(url, body, { headers }).pipe(
            catchError((err: HttpErrorResponse) => throwError(() => err))
          )
        );
      }
      return result;
    } catch (err: any) {
      // Si 401 et pas encore de retry, tenter de rafraîchir le token
      if (err?.status === 401 && requireAuth && !isRetry) {
        const refreshed = await this.refreshToken();
        if (refreshed) {
          // Réessayer la requête avec le nouveau token
          return this.request(method, endpoint, body, requireAuth, true);
        }
      }
      throw err;
    }
  }

  // Rafraîchir le token via l'endpoint de refresh
  async refreshToken(): Promise<boolean> {
    if (!this.currentToken) return false;
    try {
      const res: any = await firstValueFrom(
        this.http.post(`${this.baseUrl}/api/session/refresh`, {}, {
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.currentToken}` }
        })
      );
      if (res.success && res.token) {
        this.setToken(res.token);
        return true;
      }
    } catch (e) {}
    return false;
  }

  // ===== Connexion par OTP =====
  async sendOtp(phone: string): Promise<any> {
    return this.request('POST', '/api/otp/send', { phone }, false);
  }

  async verifyOtp(phone: string, code: string): Promise<any> {
    return this.request('POST', '/api/otp/verify', { phone, code, deviceName: 'Appareil Ionic' }, false);
  }

  // ===== Profil et PIN =====
  async updateProfile(name: string): Promise<any> {
    return this.request('POST', '/api/profile/', { name });
  }

  async setPin(pin: string): Promise<any> {
    return this.request('POST', '/api/pin/set', { pin });
  }

  // ===== Solde et historique =====
  async getTransactions(): Promise<any> {
    return this.request('GET', '/api/transactions/list');
  }

  // ===== Envoi d'argent =====
  async sendMoney(recipientPhone: string, amount: number, pin: string, idempotencyKey: string): Promise<any> {
    return this.request('POST', '/api/transfer/send', { recipientPhone, amount, pin, idempotency_key: idempotencyKey });
  }

  // ===== Session =====
  async revokeSession(): Promise<any> {
    return this.request('POST', '/api/session/revoke');
  }
}