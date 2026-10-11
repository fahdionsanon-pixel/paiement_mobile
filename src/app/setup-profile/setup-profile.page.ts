// Setup Profile Page - Set PIN after OTP verification
// Flow: OTP -> Profile name -> PIN -> Session -> Home

import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController, LoadingController } from '@ionic/angular';
import { AuthService } from '../services/auth-new.service';
import { ApiClientService } from '../services/api-client.service';

@Component({
  selector: 'app-setup-profile',
  templateUrl: './setup-profile.page.html',
  styleUrls: ['./setup-profile.page.scss'],
  standalone: false,
})
export class SetupProfilePage implements OnInit {
  firstName = '';
  lastName = '';
  phone = '';
  pin = '';
  pinConfirm = '';
  showPinStep = false;
  loading = false;
  pinError = '';

  constructor(
    private auth: AuthService,
    private api: ApiClientService,
    private router: Router,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController
  ) {}

  ngOnInit() {
    const nav = this.router.getCurrentNavigation();
    if (nav?.extras?.state) {
      this.phone = nav.extras.state['phone'] || this.auth.getPhone();
    } else {
      this.phone = this.auth.getPhone();
    }
    if (!this.phone) {
      this.router.navigate(['/login'], { replaceUrl: true });
    }
  }

  get fullName(): string {
    return `${this.firstName.trim()} ${this.lastName.trim()}`.trim();
  }

  get isValid(): boolean {
    return this.firstName.trim().length >= 2;
  }

  async saveName() {
    if (!this.isValid) return;
    this.showPinStep = true;
  }

  async completeSetup() {
    if (this.pin.length !== 4 || !/^\d{4}$/.test(this.pin)) {
      this.pinError = 'Le PIN doit être à 4 chiffres';
      return;
    }
    if (this.pin !== this.pinConfirm) {
      this.pinError = 'Les codes PIN ne correspondent pas';
      return;
    }

    this.loading = true;
    const loader = await this.loadingCtrl.create({
      message: 'Configuration du compte...',
      spinner: 'crescent',
    });
    await loader.present();

    try {
      // Step 1: Set PIN
      const pinResult = await this.auth.setPin(this.phone, this.pin);
      if (!pinResult.success) {
        await loader.dismiss();
        this.pinError = pinResult.message;
        return;
      }

      // Step 2: Create session
      const sessionResult = await this.auth.createSession(this.phone, 'Mobile');
      if (!sessionResult.success) {
        await loader.dismiss();
        this.showToast(sessionResult.message, 'danger');
        return;
      }

      await loader.dismiss();
      this.loading = false;
      this.router.navigate(['/home'], { replaceUrl: true });
    } catch (err: any) {
      await loader.dismiss();
      this.loading = false;
      this.showToast('Configuration échouée. Veuillez réessayer.', 'danger');
    }
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