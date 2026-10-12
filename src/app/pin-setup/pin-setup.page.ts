import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController, LoadingController } from '@ionic/angular';
import { AuthService } from '../services/auth-new.service';

@Component({
  selector: 'app-pin-setup',
  templateUrl: './pin-setup.page.html',
  styleUrls: ['./pin-setup.page.scss'],
  standalone: false,
})
export class PinSetupPage implements OnInit {
  pinDigits: string[] = ['', '', '', ''];
  pinConfirm = '';
  pinError = '';
  loading = false;

  constructor(
    private auth: AuthService,
    private router: Router,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController
  ) {}

  ngOnInit() {
    if (!this.auth.getPhone()) {
      this.router.navigate(['/login'], { replaceUrl: true });
    }
  }

  moveFocus(event: Event, nextIndex: number) {
    const input = event.target as HTMLInputElement;
    if (input.value.length === 1 && nextIndex >= 0 && nextIndex < 4) {
      const nextInput = input.parentElement?.querySelectorAll('input')[nextIndex] as HTMLInputElement;
      nextInput?.focus();
    }
  }

  async confirmPinSetup() {
    const pin = this.pinDigits.join('');
    if (!/^\d{4}$/.test(pin)) {
      this.pinError = 'Le PIN doit être à 4 chiffres.';
      return;
    }
    if (pin !== this.pinConfirm) {
      this.pinError = 'Les codes ne correspondent pas.';
      return;
    }

    this.loading = true;
    const loader = await this.loadingCtrl.create({ message: 'Enregistrement du PIN...', spinner: 'crescent' });
    await loader.present();

    const res = await this.auth.setPin(pin);
    await loader.dismiss();
    this.loading = false;

    if (!res.success) {
      this.pinError = res.message;
      return;
    }

    this.pinDigits = ['', '', '', ''];
    this.pinConfirm = '';
    await this.showToast('PIN enregistré avec succès !', 'success');

    const hasName = !!this.auth.getCurrentUser()?.name;
    if (!hasName) {
      this.router.navigate(['/setup-profile'], { replaceUrl: true });
    } else {
      this.router.navigate(['/home'], { replaceUrl: true });
    }
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