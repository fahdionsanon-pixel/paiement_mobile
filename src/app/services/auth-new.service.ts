// Auth Service - Uses Node.js API backend
// Flow: OTP -> PIN -> Session token

import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ApiClientService } from './api-client.service';

export interface User {
  id: number;
  phone: string;
  name: string;
}

export interface AuthState {
  authenticated: boolean;
  user: User | null;
  token: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private currentUser: User | null = null;
  private currentToken: string | null = null;
  private authenticated = false;

  public authState$ = new BehaviorSubject<AuthState>({
    authenticated: false,
    user: null,
    token: null,
  });

  constructor(private api: ApiClientService) {
    // Restore session
    const token = this.api.getToken();
    if (token) {
      this.currentToken = token;
      this.validateSession();
    }
  }

  getPhone(): string {
    return this.currentUser?.phone || '+226 70 12 34 56';
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  getToken(): string | null {
    return this.currentToken;
  }

  isAuthenticated(): boolean {
    return this.authenticated;
  }

  // Step 1: Send OTP
  async sendOtp(phone: string): Promise<{ success: boolean; otp?: string; message: string }> {
    try {
      const res = await this.api.sendOtp(phone);
      if (res.success) {
        return { success: true, otp: res.otp, message: res.message };
      }
      return { success: false, message: res.message || 'OTP non envoyé' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Connexion échouée' };
    }
  }

  // Step 2: Verify OTP
  async verifyOtp(phone: string, code: string): Promise<{ success: boolean; user?: User; message: string }> {
    try {
      const res = await this.api.verifyOtp(phone, code);
      if (res.success) {
        return { success: true, user: res.user, message: res.message };
      }
      return { success: false, message: res.message || 'OTP incorrect' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Connexion échouée' };
    }
  }

  // Step 3: Set PIN
  async setPin(phone: string, pin: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await this.api.setPin(phone, pin);
      return { success: res.success, message: res.message };
    } catch (err: any) {
      return { success: false, message: err?.message || 'PIN non enregistré' };
    }
  }

  // Step 4: Create session
  async createSession(phone: string, deviceName?: string): Promise<{ success: boolean; token?: string; user?: User; message: string }> {
    try {
      const res = await this.api.createSession(phone, deviceName);
      if (res.success && res.token) {
        this.currentToken = res.token;
        this.api.setToken(res.token);
        this.currentUser = res.user || null;
        this.authenticated = true;
        this.updateState();
        return { success: true, token: res.token, user: res.user, message: res.message };
      }
      return { success: false, message: res.message || 'Session non créée' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Connexion échouée' };
    }
  }

  // Validate current session
  async validateSession(): Promise<boolean> {
    if (!this.currentToken) return false;
    try {
      const res = await this.api.validateSession();
      if (res.success) {
        this.authenticated = true;
        this.currentUser = res.user || null;
        this.updateState();
        return true;
      }
    } catch (err) {}
    
    this.authenticated = false;
    this.currentUser = null;
    this.currentToken = null;
    this.api.clearToken();
    this.updateState();
    return false;
  }

  // Logout
  logout(): void {
    if (this.currentToken) {
      this.api.revokeSession().catch(() => {});
    }
    this.authenticated = false;
    this.currentUser = null;
    this.currentToken = null;
    this.api.clearToken();
    this.updateState();
  }

  private updateState(): void {
    this.authState$.next({
      authenticated: this.authenticated,
      user: this.currentUser,
      token: this.currentToken,
    });
  }
}

export default AuthService;