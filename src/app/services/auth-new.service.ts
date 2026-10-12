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
  hasPin: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private currentUser: User | null = null;
  private authenticated = false;
  private pinSet = false;
  private pendingPhone = '';
  private pendingOtp = '';
  public authState$ = new BehaviorSubject<AuthState>({
    authenticated: false,
    user: null,
    hasPin: false,
  });

  constructor(private api: ApiClientService) {
    // Restore local session
    this.loadLocalSession();
  }

  getPhone(): string {
    return this.currentUser?.phone || this.pendingPhone;
  }

  getPendingOtp(): string {
    return this.pendingOtp;
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  isAuthenticated(): boolean {
    return this.authenticated;
  }

  hasPin(): boolean {
    return this.pinSet;
  }

  // Step 1: Request a code
  async sendOtp(phone: string): Promise<{ success: boolean; otp?: string; message: string }> {
    try {
      const res = await this.api.sendOtp(phone);
      if (res.success) {
        this.pendingPhone = phone;
        this.pendingOtp = res.otp || '';
        return { success: true, otp: res.otp, message: res.message };
      }
      return { success: false, message: res.message || 'Code non envoyé' };
    } catch (err: any) {
      return { success: false, message: err?.error?.message || 'Connexion au serveur impossible' };
    }
  }

  // Step 2: Verify the code
  async verifyOtp(code: string): Promise<{ success: boolean; user?: User; message: string }> {
    try {
      const res = await this.api.verifyOtp(this.pendingPhone, code);
      if (res.success) {
        // Fetch user data from server
        const userData = await this.api.getUserData(this.pendingPhone);
        if (userData.success && userData.user) {
          this.currentUser = userData.user;
          this.pinSet = !!localStorage.getItem(`paypulse_pin_${this.pendingPhone}`);
          this.authenticated = true;
          this.pendingOtp = '';
          this.saveLocalSession();
          this.updateState();
          return { success: true, user: this.currentUser, message: res.message };
        }
        // Fallback if getUserData fails
        this.currentUser = { id: 0, phone: this.pendingPhone, name: '' };
        this.pinSet = !!localStorage.getItem(`paypulse_pin_${this.pendingPhone}`);
        this.authenticated = true;
        this.pendingOtp = '';
        this.saveLocalSession();
        this.updateState();
        return { success: true, user: this.currentUser, message: res.message };
      }
      return { success: false, message: res.message || 'Code incorrect' };
    } catch (err: any) {
      return { success: false, message: err?.error?.message || 'Vérification impossible' };
    }
  }

  // PIN is stored locally for PHP backend
  async setPin(pin: string): Promise<{ success: boolean; message: string }> {
    try {
      if (!/^\d{4}$/.test(pin)) {
        return { success: false, message: 'Le PIN doit être à 4 chiffres' };
      }
      localStorage.setItem(`paypulse_pin_${this.pendingPhone}`, pin);
      this.pinSet = true;
      this.saveLocalSession();
      this.updateState();
      return { success: true, message: 'PIN enregistré' };
    } catch (err: any) {
      return { success: false, message: err?.error?.message || 'PIN non enregistré' };
    }
  }

  async updateProfile(name: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await this.api.updateProfile(this.pendingPhone, name);
      if (res.success && this.currentUser) {
        this.currentUser = { ...this.currentUser, name };
        this.updateState();
      }
      return { success: !!res.success, message: res.message || '' };
    } catch (err: any) {
      return { success: false, message: err?.error?.message || 'Nom non enregistré' };
    }
  }

  // Verify PIN locally
  verifyPin(pin: string): boolean {
    const savedPin = localStorage.getItem(`paypulse_pin_${this.currentUser?.phone || this.pendingPhone}`);
    return pin === savedPin;
  }

  // At startup: check if we have a local session
  async validateSession(): Promise<boolean> {
    if (!this.currentUser) return false;
    try {
      // Optionally verify with server
      const res = await this.api.getUserData(this.currentUser.phone);
      if (res.success && res.user) {
        this.currentUser = res.user;
        this.pinSet = !!localStorage.getItem(`paypulse_pin_${this.currentUser.phone}`);
        this.authenticated = true;
        this.updateState();
        return true;
      }
    } catch (err) {}
    this.clearLocal();
    return false;
  }

  logout(): void {
    this.api.revokeSession().catch(() => {});
    this.clearLocal();
  }

  private saveLocalSession(): void {
    try {
      localStorage.setItem('paypulse_auth', JSON.stringify({
        user: this.currentUser,
        authenticated: this.authenticated,
        pinSet: this.pinSet,
        phone: this.pendingPhone,
      }));
    } catch (e) {}
  }

  private loadLocalSession(): void {
    try {
      const saved = localStorage.getItem('paypulse_auth');
      if (saved) {
        const data = JSON.parse(saved);
        this.currentUser = data.user;
        this.authenticated = data.authenticated;
        this.pinSet = data.pinSet;
        this.pendingPhone = data.phone;
      }
    } catch (e) {}
  }

  private clearLocal(): void {
    this.authenticated = false;
    this.currentUser = null;
    this.pinSet = false;
    this.pendingPhone = '';
    this.pendingOtp = '';
    this.api.clearToken();
    localStorage.removeItem('paypulse_auth');
    this.updateState();
  }

  private updateState(): void {
    this.authState$.next({
      authenticated: this.authenticated,
      user: this.currentUser,
      hasPin: this.pinSet,
    });
  }
}

export default AuthService;