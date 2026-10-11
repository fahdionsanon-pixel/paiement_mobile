import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController, LoadingController } from '@ionic/angular';
import { Auth } from '../services/auth';
import { DatabaseService } from '../services/database.service';

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
    private auth: Auth,
    private router: Router,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private db: DatabaseService
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
      await this.db.saveUserProfile(this.phone, this.fullName);
      await loader.dismiss();
      this.loading = false;
      this.router.navigate(['/home'], { replaceUrl: true });
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
