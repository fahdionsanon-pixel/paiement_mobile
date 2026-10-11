// OTP Page - Verify OTP then set PIN then create session

import { Component, OnInit } from '@angular/core';
import { Router, NavigationExtras } from '@angular/router';
import { ToastController, LoadingController } from '@ionic/angular';
import { AuthService } from '../services/auth-new.service';
import { ApiClientService } from '../services/api-client.service';

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
  showPushNotification = true;
  notificationCopied = false;

  constructor(
    private auth: AuthService,
    private api: ApiClientService,
    private router: Router,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController
  ) {}

  ngOnInit() {
    // Get phone from navigation state
    const nav = this.router.getCurrentNavigation();
    if (nav?.extras?.state) {
      this.phone = nav.extras.state['phone'] || '';
      this.currentOtp = nav.extras.state['otp'] || '';
    } else {
      // Fallback
      this.phone = this.auth.getPhone();
      this.currentOtp = '';
    }
  }

  async verify() {
    if (!this.code || this.code.length < 6) {
      this.showToast('Veuillez entrer le code à 6 chiffres', 'warning');
      return;
    }

    this.loading = true;
    const loader = await this.loadingCtrl.create({
      message: 'Vérification du code...',
      spinner: 'crescent',
    });
    await loader.present();

    try {
      // Step 1: Verify OTP
      const result = await this.auth.verifyOtp(this.phone, this.code);
      await loader.dismiss();
      this.loading = false;

      if (!result.success) {
        this.showToast(result.message, 'danger');
        return;
      }

      // OTP verified - now check if user has PIN
      // For now, go to PIN setup if no PIN exists
      this.router.navigate(['/setup-profile'], {
        state: { phone: this.phone, needsPin: true }
      });
    } catch (err: any) {
      await loader.dismiss();
      this.loading = false;
      this.showToast(err?.message || 'Vérification échouée', 'danger');
    }
  }

  async resend() {
    this.loading = true;
    try {
      const res = await this.auth.sendOtp(this.phone);
      if (res.success) {
        this.currentOtp = res.otp || '';
        this.showToast('Nveau code OTP généré', 'success');
      }
    } catch (err) {
      this.showToast('Renvoi échoué', 'danger');
    }
    this.loading = false;
  }

  changeNumber() {
    this.router.navigate(['/login']);
  }

  dismissNotification() {
    this.showPushNotification = false;
  }

  copyCodeFromNotification() {
    this.code = this.currentOtp;
    this.notificationCopied = true;
    setTimeout(() => { this.notificationCopied = false; }, 2000);
  }
}