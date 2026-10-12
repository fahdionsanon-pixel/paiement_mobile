import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController, LoadingController } from '@ionic/angular';
import { AuthService } from '../services/auth-new.service';

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
  loading = false;

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
    }
  }

  get fullName(): string {
    return `${this.firstName.trim()} ${this.lastName.trim()}`.trim();
  }

  get isValid(): boolean {
    return this.firstName.trim().length >= 2;
  }

  async save() {
    if (!this.isValid) return;

    this.loading = true;
    const loader = await this.loadingCtrl.create({
      message: 'Enregistrement de votre profil...',
      spinner: 'crescent',
    });
    await loader.present();

    try {
      const res = await this.auth.updateProfile(this.fullName);
      if (!res.success) throw new Error(res.message);
      await loader.dismiss();
      this.loading = false;
      // Check if PIN is set, if not navigate to pin-setup
      const hasPin = this.auth.hasPin();
      if (!hasPin) {
        this.router.navigate(['/pin-setup'], { replaceUrl: true });
      } else {
        this.router.navigate(['/home'], { replaceUrl: true });
      }
    } catch (err: any) {
      await loader.dismiss();
      this.loading = false;
      await this.showToast('Erreur lors de l\'enregistrement. Veuillez réessayer.', 'danger');
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
