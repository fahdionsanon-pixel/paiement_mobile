import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController, LoadingController } from '@ionic/angular';
import { Auth } from '../services/auth';
import { DatabaseService } from '../services/database.service';

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
    private auth: Auth,
    private router: Router,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private db: DatabaseService
  ) {}

  ngOnInit() {
    this.phone = this.auth.getPhone();
    this.currentOtp = this.auth.getCurrentOtp();
    this.isFirebaseActive = this.auth.isFirebaseConfigured();
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
    const loader = await this.loadingCtrl.create({
      message: 'Vérification du code SMS...',
      spinner: 'crescent',
    });
    await loader.present();

    try {
      const res = await this.auth.verifyOtp(codeStr);
      await loader.dismiss();
      this.loading = false;

      if (res.success) {
        await this.showToast(res.message || 'Connexion réussie ! Bienvenue sur PayPulse.', 'success');
        // Check if the user already has a name configured
        const profile = await this.db.checkUserProfile(this.phone);
        if (profile.hasName) {
          this.router.navigate(['/home'], { replaceUrl: true });
        } else {
          this.router.navigate(['/setup-profile'], { replaceUrl: true });
        }
      } else {
        this.code = '';
        await this.showToast(res.message || 'Code invalide.', 'danger', 5000);
      }
    } catch (err: any) {
      await loader.dismiss();
      this.loading = false;
      await this.showToast(`Erreur : ${err?.message || 'Vérification échouée'}`, 'danger');
    }
  }

  async resend() {
    this.loading = true;
    const loader = await this.loadingCtrl.create({
      message: 'Renvoi du code SMS...',
      spinner: 'crescent',
    });
    await loader.present();

    try {
      const res = await this.auth.sendOtp(this.phone);
      await loader.dismiss();
      this.loading = false;

      if (res.method === 'firebase') {
        await this.showToast(`Un nouveau SMS a été envoyé au ${this.phone}.`, 'success');
      } else {
        this.currentOtp = res.otp || '';
        await this.showToast(`Nouveau code simulé : ${res.otp}`, 'primary', 10000);
      }
    } catch (err: any) {
      await loader.dismiss();
      this.loading = false;
      await this.showToast(`Erreur lors du renvoi : ${err?.message}`, 'danger');
    }
  }

  changeNumber() {
    this.router.navigate(['/login'], { replaceUrl: true });
  }

  private async showToast(message: string, color: string, duration = 3000) {
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