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

  constructor(private api: ApiClientService) {}

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

  // Étape 1 : demander un code
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

  // Étape 2 : vérifier le code. Le serveur crée la session et renvoie le jeton.
  async verifyOtp(code: string): Promise<{ success: boolean; user: User | null; message: string; hasPin: boolean }> {
    try {
      const res = await this.api.verifyOtp(this.pendingPhone, code);
      if (res.success && res.token) {
        this.api.setToken(res.token);
        this.currentUser = res.user;
        this.pinSet = !!res.hasPin;
        this.authenticated = true;
        this.pendingOtp = '';
        this.updateState();
        return { success: true, user: this.currentUser, message: res.message, hasPin: this.pinSet };
      }
      return { success: false, user: null, message: res.message || 'Code incorrect', hasPin: false };
    } catch (err: any) {
      return { success: false, user: null, message: err?.error?.message || 'Vérification impossible', hasPin: false };
    }
  }

  // PIN est vérifié côté serveur
  async setPin(pin: string): Promise<{ success: boolean; message: string }> {
    try {
      if (!/^\d{4}$/.test(pin)) {
        return { success: false, message: 'Le PIN doit être à 4 chiffres' };
      }
      const res = await this.api.setPin(pin);
      if (res.success) {
        this.pinSet = true;
        this.updateState();
      }
      return { success: !!res.success, message: res.message || '' };
    } catch (err: any) {
      return { success: false, message: err?.error?.message || 'PIN non enregistré' };
    }
  }

  async updateProfile(name: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await this.api.updateProfile(name);
      if (res.success && this.currentUser) {
        this.currentUser = { ...this.currentUser, name };
        this.updateState();
      }
      return { success: !!res.success, message: res.message || '' };
    } catch (err: any) {
      return { success: false, message: err?.error?.message || 'Nom non enregistré' };
    }
  }

  // Au démarrage : vérifier si on a une session valide
  async validateSession(): Promise<boolean> {
    if (!this.api.getToken()) return false;
    try {
      const res: any = await this.api.getTransactions();
      // Si on arrive ici, le token est valide
      // On pourrait aussi faire un appel dédié /api/session/validate
      return true;
    } catch (err) {
      this.clearLocal();
      return false;
    }
  }

  logout(): void {
    this.api.revokeSession().catch(() => {});
    this.clearLocal();
  }

  private clearLocal(): void {
    this.authenticated = false;
    this.currentUser = null;
    this.pinSet = false;
    this.pendingPhone = '';
    this.pendingOtp = '';
    this.api.clearToken();
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