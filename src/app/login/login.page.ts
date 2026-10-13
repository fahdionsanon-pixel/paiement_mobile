import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController, LoadingController } from '@ionic/angular';
import { AuthService } from '../services/auth-new.service';

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
    private router: Router,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController
  ) {}

  ngOnInit() {}

  get fullPhone(): string {
    let digits = (this.phone || '').replace(/\s+/g, '').replace(/[-().]/g, '');
    // Remove leading zero if entered in international mode (e.g. 06 12 34 -> 6 12 34 for +33)
    if (this.selectedCountry !== '+1' && digits.startsWith('0')) {
      digits = digits.substring(1);
    }
    return `${this.selectedCountry}${digits}`;
  }

  isValid(): boolean {
    const digits = (this.phone || '').replace(/\s/g, '');
    return /^\d{8}$/.test(digits);
  }

  async confirm() {
    if (!this.isValid() || this.loading) return;
    this.loading = true;
    const loader = await this.loadingCtrl.create({ message: 'Envoi du code...', spinner: 'crescent' });
    await loader.present();
    const res = await this.auth.sendOtp(this.fullPhone);
    await loader.dismiss();
    this.loading = false;
    if (!res.success) {
      await this.showToast(res.message, 'danger', 6000);
      return;
    }
    await this.showToast(`Code de test pour le ${this.fullPhone} : ${res.otp}`, 'success', 8000);
    this.router.navigate(['/otp']);
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