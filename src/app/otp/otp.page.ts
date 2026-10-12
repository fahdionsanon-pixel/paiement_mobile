import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController, LoadingController } from '@ionic/angular';
import { AuthService } from '../services/auth-new.service';

@Component({
  selector: 'app-otp',
  templateUrl: './otp.page.html',
  styleUrls: ['./otp.page.scss'],
  standalone: false,
})
export class OtpPage implements OnInit {
  code = '';
  phone = '';
  currentOtp = '';
  loading = false;
  isFirebaseActive = false;
  showPushNotification = true;
  notificationCopied = false;

  constructor(
    private auth: AuthService,
    private router: Router,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController
  ) {}

  ngOnInit() {
    this.phone = this.auth.getPhone();
    if (!this.phone) {
      this.router.navigate(['/login'], { replaceUrl: true });
      return;
    }
    this.currentOtp = this.auth.getPendingOtp();
    this.isFirebaseActive = false;
    this.showPushNotification = true;
  }

  async copyCodeFromNotification() {
    if (!this.currentOtp) return;
    this.code = this.currentOtp;
    this.notificationCopied = true;
    try {
      await navigator.clipboard.writeText(this.currentOtp);
    } catch (e) {}
    await this.showToast(`Code ${this.currentOtp} copié et inséré !`, 'success', 3000);
  }

  dismissNotification() {
    this.showPushNotification = false;
  }

  fillCode() {
    this.code = this.currentOtp;
  }

  async verify() {
    const codeStr = String(this.code || '').trim();
    if (codeStr.length < 6) return;

    this.loading = true;
    const loader = await this.loadingCtrl.create({ message: 'Vérification du code...', spinner: 'crescent' });
    await loader.present();
    const res = await this.auth.verifyOtp(codeStr);
    await loader.dismiss();
    this.loading = false;
    if (!res.success) {
      this.code = '';
      await this.showToast(res.message, 'danger', 5000);
      return;
    }
    await this.showToast('Connexion réussie !', 'success');
    const hasName = !!res.user?.name;
    const hasPin = res.hasPin;
    if (!hasName) {
      this.router.navigate(['/setup-profile'], { replaceUrl: true });
    } else if (!hasPin) {
      this.router.navigate(['/home'], { replaceUrl: true, state: { showPinSetup: true } });
    } else {
      this.router.navigate(['/home'], { replaceUrl: true });
    }
  }

  async resend() {
    const res = await this.auth.sendOtp(this.phone);
    if (res.success) {
      this.currentOtp = res.otp || '';
      await this.showToast(`Nouveau code de test : ${res.otp}`, 'primary', 10000);
    } else {
      await this.showToast(res.message, 'danger');
    }
  }

  changeNumber() {
    this.router.navigate(['/login'], { replaceUrl: true });
  }

  async showToast(message: string, color: string, duration = 3000) {
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