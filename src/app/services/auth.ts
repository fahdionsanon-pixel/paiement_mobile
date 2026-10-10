import { Injectable } from '@angular/core';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  Auth as FirebaseAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
} from 'firebase/auth';
import { environment } from '../../environments/environment';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
}

export interface SendOtpResult {
  success: boolean;
  method: 'firebase' | 'simulated' | 'whatsapp';
  message: string;
  otp?: string;
  whatsappLink?: string;
}

export interface VerifyOtpResult {
  success: boolean;
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class Auth {
  private phone = '';
  private currentOtp = '';
  private expiresAt = 0;
  private authenticated = false;
  private confirmationResult: ConfirmationResult | null = null;
  private recaptchaVerifier: RecaptchaVerifier | null = null;
  private firebaseApp: FirebaseApp | null = null;
  private firebaseAuth: FirebaseAuth | null = null;
  private whatsappLink = '';
  private currentChannel: 'sms' | 'whatsapp' = 'sms';

  constructor() {
    // Restore session if available
    try {
      const savedAuth = sessionStorage.getItem('paypulse_auth');
      const savedPhone = sessionStorage.getItem('paypulse_phone');
      if (savedAuth === 'true') {
        this.authenticated = true;
      }
      if (savedPhone) {
        this.phone = savedPhone;
      }
    } catch (e) {
      // Ignore storage errors in restricted contexts
    }

    this.initFirebase();
  }

  // Get active Firebase configuration (custom from storage or from environment)
  getFirebaseConfig(): FirebaseConfig {
    try {
      const custom = localStorage.getItem('paypulse_firebase_config');
      if (custom) {
        return JSON.parse(custom);
      }
    } catch (e) {}
    return environment.firebase;
  }

  saveFirebaseConfig(config: FirebaseConfig): void {
    try {
      localStorage.setItem('paypulse_firebase_config', JSON.stringify(config));
      this.initFirebase(true);
    } catch (e) {}
  }

  isFirebaseConfigured(): boolean {
    const config = this.getFirebaseConfig();
    return !!(
      config &&
      config.apiKey &&
      config.apiKey !== 'VOTRE_API_KEY' &&
      config.projectId &&
      config.projectId !== 'votre-projet'
    );
  }

  initFirebase(force = false): void {
    const config = this.getFirebaseConfig();
    if (!this.isFirebaseConfigured()) {
      return;
    }

    try {
      if (getApps().length === 0 || force) {
        this.firebaseApp = initializeApp(config);
      } else {
        this.firebaseApp = getApp();
      }
      this.firebaseAuth = getAuth(this.firebaseApp);
      this.firebaseAuth.useDeviceLanguage();
    } catch (err) {
      console.warn('Firebase initialization notice:', err);
    }
  }

  // Envoi de SMS Classique (Option 2 - Passerelle SMS WAMP sans reCAPTCHA)
  async sendOtp(phoneE164: string): Promise<SendOtpResult> {
    this.phone = phoneE164;
    this.currentChannel = 'sms';
    this.confirmationResult = null;

    try {
      sessionStorage.setItem('paypulse_phone', phoneE164);
      sessionStorage.setItem('paypulse_channel', 'sms');
    } catch (e) {}

    const cleanPhone = phoneE164.replace(/\+/g, '').replace(/\s+/g, '');

    // Appel direct au backend SMS WAMP
    try {
      const res = await fetch('http://127.0.0.1:8080/send_sms.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone }),
      });
      const data = await res.json();
      if (data && data.success) {
        this.currentOtp = data.otp || '';
        try {
          if (this.currentOtp) sessionStorage.setItem('paypulse_otp', this.currentOtp);
        } catch (e) {}

        return {
          success: true,
          method: 'simulated',
          otp: this.currentOtp,
          message: data.message || `Code SMS envoyé au ${phoneE164}`,
        };
      }
    } catch (err) {
      console.warn('WAMP SMS non joignable, fallback local:', err);
    }

    return this.triggerSimulatedOtp(phoneE164);
  }

  // Envoi par WhatsApp (Meta Cloud API ou Direct Link via backend WAMP)
  async sendWhatsAppOtp(phoneE164: string): Promise<SendOtpResult> {
    this.phone = phoneE164;
    this.currentChannel = 'whatsapp';
    try {
      sessionStorage.setItem('paypulse_phone', phoneE164);
      sessionStorage.setItem('paypulse_channel', 'whatsapp');
    } catch (e) {}

    const cleanPhone = phoneE164.replace(/\+/g, '').replace(/\s+/g, '');

    // Appel à l'API PHP sur WampServer (port 8080 ou 80)
    try {
      const res = await fetch('http://127.0.0.1:8080/send_whatsapp_otp.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone }),
      });
      const data = await res.json();

      if (data && data.success) {
        this.currentOtp = data.otp || '';
        this.whatsappLink =
          data.whatsapp_link ||
          `https://api.whatsapp.com/send?phone=${cleanPhone}&text=Code%20PayPulse:%20${data.otp}`;
        try {
          if (this.currentOtp) sessionStorage.setItem('paypulse_otp', this.currentOtp);
          sessionStorage.setItem('paypulse_wa_link', this.whatsappLink);
        } catch (e) {}

        return {
          success: true,
          method: 'whatsapp',
          otp: this.currentOtp,
          whatsappLink: this.whatsappLink,
          message: data.message || `Code WhatsApp généré : ${this.currentOtp}`,
        };
      }
    } catch (err) {
      console.warn('WAMP WhatsApp non joignable, fallback local:', err);
    }

    // Fallback local instantané
    this.currentOtp = Math.floor(100000 + Math.random() * 900000).toString();
    this.whatsappLink = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=%F0%9F%94%90%20%2APayPulse%2A%20%3A%20Votre%20code%20OTP%20est%20%3A%20${this.currentOtp}`;
    try {
      sessionStorage.setItem('paypulse_otp', this.currentOtp);
      sessionStorage.setItem('paypulse_wa_link', this.whatsappLink);
    } catch (e) {}

    return {
      success: true,
      method: 'whatsapp',
      otp: this.currentOtp,
      whatsappLink: this.whatsappLink,
      message: `Code OTP WhatsApp généré : ${this.currentOtp}`,
    };
  }

  getWhatsAppLink(): string {
    return this.whatsappLink || sessionStorage.getItem('paypulse_wa_link') || '';
  }

  getCurrentChannel(): 'sms' | 'whatsapp' {
    return (sessionStorage.getItem('paypulse_channel') as any) || this.currentChannel;
  }

  private triggerSimulatedOtp(phone: string, reason?: string): SendOtpResult {
    this.confirmationResult = null;
    this.currentOtp = Math.floor(100000 + Math.random() * 900000).toString();
    this.expiresAt = Date.now() + 10 * 60 * 1000;

    try {
      sessionStorage.setItem('paypulse_otp', this.currentOtp);
    } catch (e) {}

    return {
      success: true,
      method: 'simulated',
      otp: this.currentOtp,
      message: reason || `Code de simulation généré : ${this.currentOtp}`,
    };
  }

  // Verify OTP code
  async verifyOtp(code: string): Promise<VerifyOtpResult> {
    const trimmed = (code || '').trim();

    // 1. If WhatsApp channel, check with WAMP backend
    if (this.getCurrentChannel() === 'whatsapp') {
      try {
        const cleanPhone = this.getPhone().replace(/\+/g, '').replace(/\s+/g, '');
        const res = await fetch('http://127.0.0.1:8080/verify_whatsapp_otp.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: cleanPhone, code: trimmed }),
        });
        const data = await res.json();
        if (data && data.success) {
          this.authenticated = true;
          try {
            sessionStorage.setItem('paypulse_auth', 'true');
          } catch (e) {}
          return {
            success: true,
            message: data.message || 'Authentification WhatsApp réussie !',
          };
        }
      } catch (err) {}
    }

    // 2. If Firebase ConfirmationResult is active, verify via Firebase
    if (this.confirmationResult) {
      try {
        const userCredential = await this.confirmationResult.confirm(trimmed);
        if (userCredential && userCredential.user) {
          this.authenticated = true;
          try {
            sessionStorage.setItem('paypulse_auth', 'true');
            if (userCredential.user.phoneNumber) {
              sessionStorage.setItem('paypulse_phone', userCredential.user.phoneNumber);
            }
          } catch (e) {}
          return {
            success: true,
            message: 'Authentification par SMS Firebase confirmée avec succès !',
          };
        }
      } catch (err: any) {
        // If Firebase verify fails, also check if user typed the demo fallback code
        if (trimmed === '123456') {
          this.authenticated = true;
          try {
            sessionStorage.setItem('paypulse_auth', 'true');
          } catch (e) {}
          return { success: true, message: 'Code démo accepté (bypass).' };
        }

        let errMsg = 'Le code SMS saisi est incorrect ou a expiré.';
        if (err?.code === 'auth/invalid-verification-code') {
          errMsg = 'Code de vérification SMS erroné. Veuillez vérifier le SMS reçu.';
        } else if (err?.code === 'auth/code-expired') {
          errMsg = 'Le code a expiré. Veuillez demander un nouveau code SMS.';
        }
        return { success: false, message: errMsg };
      }
    }

    // 3. Stored OTP verification (local / fallback)
    const storedOtp = sessionStorage.getItem('paypulse_otp');
    const valid =
      trimmed === this.currentOtp ||
      trimmed === storedOtp ||
      trimmed === '123456';

    if (valid) {
      this.authenticated = true;
      try {
        sessionStorage.setItem('paypulse_auth', 'true');
      } catch (e) {}
      return { success: true, message: 'Code validé avec succès.' };
    }

    return {
      success: false,
      message: 'Code incorrect. Veuillez entrer le code reçu ou le code démo 123456.',
    };
  }

  getPhone(): string {
    return this.phone || sessionStorage.getItem('paypulse_phone') || '+226 70 12 34 56';
  }

  getCurrentOtp(): string {
    return this.currentOtp || sessionStorage.getItem('paypulse_otp') || '123456';
  }

  isLoggedIn(): boolean {
    return this.authenticated || sessionStorage.getItem('paypulse_auth') === 'true';
  }

  loginDirect(): void {
    this.authenticated = true;
    this.phone = '+226 70 12 34 56';
    try {
      sessionStorage.setItem('paypulse_auth', 'true');
      sessionStorage.setItem('paypulse_phone', this.phone);
    } catch (e) {}
  }

  logout(): void {
    this.authenticated = false;
    this.phone = '';
    this.currentOtp = '';
    this.confirmationResult = null;
    try {
      sessionStorage.removeItem('paypulse_auth');
      sessionStorage.removeItem('paypulse_phone');
      sessionStorage.removeItem('paypulse_otp');
    } catch (e) {}
  }
}