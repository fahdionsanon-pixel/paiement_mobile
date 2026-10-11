// Login Page - Uses Node.js API backend
// Flow: Phone -> OTP -> PIN -> Session

import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController, LoadingController } from '@ionic/angular';
import { AuthService } from '../services/auth-new.service';
import { ApiClientService } from '../services/api-client.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage implements OnInit {
  selectedCountry = '+226';
  phone = '';
  loading = false;
  apiConnected = false;
  apiBaseUrl = 'http://localhost:3000';

  countries = [
    { code: '+226', flag: '🇧🇫', name: 'Burkina Faso' },
    { code: '+221', flag: '🇸🇳', name: 'Sénégal' },
    { code: '+225', flag: '🇨🇮', name: "Côte d'Ivoire" },
    { code: '+223', flag: '🇲🇱', name: 'Mali' },
    { code: '+237', flag: '🇨🇲', name: 'Cameroun' },
    { code: '+33', flag: '🇫🇷', name: 'France' },
    { code: '+212', flag: '🇲🇦', name: 'Maroc' },
    { code: '+1', flag: '🇺🇸', name: 'USA / Canada' },
  ];

  constructor(
    private auth: AuthService,
    private api: ApiClientService,
    private router: Router,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController
  ) {}

  async ngOnInit() {
    this.apiBaseUrl = this.api.getConfig().baseUrl;
    await this.checkApiConnection();
  }

  async checkApiConnection() {
    try {
      const res = await this.api.healthCheck();
      this.apiConnected = res.status === 'ok';
    } catch (err) {
      this.apiConnected = false;
    }
  }

  get fullPhone(): string {
    let digits = (this.phone || '').replace(/\s+/g, '').replace(/[-().]/g, '');
    if (this.selectedCountry !== '+1' && digits.startsWith('0')) {
      digits = digits.substring(1);
    }
    return `${this.selectedCountry}${digits}`;
  }

  isValid(): boolean {
    const digits = (this.phone || '').replace(/\s/g, '');
    return /^\d{6,15}$/.test(digits);
  }

  async confirm() {
    if (!this.isValid()) return;

    this.loading = true;
    const loader = await this.loadingCtrl.create({
      message: 'Envoi du code OTP...',
      spinner: 'crescent',
    });
    await loader.present();

    try {
      const res = await this.auth.sendOtp(this.fullPhone);
      await loader.dismiss();
      this.loading = false;

      if (res.success) {
        this.showToast(`OTP généré : ${res.otp || 'Voir console'}`, 'success', 5000);
        // Navigate to OTP page
        this.router.navigate(['/otp'], {
          state: { phone: this.fullPhone, otp: res.otp }
        });
      } else {
        this.showToast(res.message, 'danger');
      }
    } catch (err: any) {
      await loader.dismiss();
      this.loading = false;
      this.showToast(err?.message || 'Connexion échouée', 'danger');
    }
  }

  updateApiUrl() {
    this.api.setConfig({ baseUrl: this.apiBaseUrl });
    this.checkApiConnection();
  }

  private async showToast(message: string, color: string, duration = 4000) {
    const toast = await this.toastCtrl.create({
      message,
      color,
      duration,
      position: 'top',
      buttons: [{ text: 'OK', role: 'cancel' }],
    });
    await toast.present();
  }
}