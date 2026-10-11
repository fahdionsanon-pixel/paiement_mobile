// Home Page - Uses Node.js API backend for balance and transactions
// Simplified for first APK: balance, send money, history, logout

import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController, LoadingController } from '@ionic/angular';
import { AuthService } from '../services/auth-new.service';
import { ApiClientService } from '../services/api-client.service';
import { HomeDataService } from '../services/home-data.service';

interface Transaction {
  id: number;
  reference: string;
  type: string;
  amount: number;
  status: string;
  created_at: string;
  from_phone?: string;
  to_phone?: string;
  is_sender?: boolean;
}

interface User {
  id: number;
  phone: string;
  name: string;
}

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit {
  user: User = { id: 0, phone: '', name: 'Utilisateur' };
  balanceXOF = 0;
  currency = 'XOF';
  transactions: Transaction[] = [];
  loading = false;

  // Modals
  isSendModalOpen = false;
  isTxDetailsModalOpen = false;
  selectedTransaction: Transaction | null = null;

  // Send form
  sendForm = {
    recipientName: '',
    recipientPhone: '',
    amount: null as number | null,
    note: '',
    category: 'transfer',
  };

  presetAmounts = [1000, 5000, 10000, 25000, 50000];

  constructor(
    private auth: AuthService,
    private api: ApiClientService,
    private homeData: HomeDataService,
    private router: Router,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController
  ) {}

  async ngOnInit() {
    // Validate session
    const valid = await this.auth.validateSession();
    if (!valid) {
      this.router.navigate(['/login'], { replaceUrl: true });
      return;
    }

    this.user = this.auth.getCurrentUser() || { id: 0, phone: '', name: 'Utilisateur' };
    await this.loadData();
  }

  async loadData() {
    this.loading = true;
    const data = await this.homeData.loadAccountData();
    if (data) {
      this.balanceXOF = data.balance;
      this.currency = data.currency;
      this.transactions = data.transactions;
    }
    this.loading = false;
  }

  get formattedBalance(): string {
    return new Intl.NumberFormat('fr-FR', {
      maximumFractionDigits: 0,
    }).format(this.balanceXOF) + ' FCFA';
  }

  formatAmount(val: number): string {
    return new Intl.NumberFormat('fr-FR', {
      maximumFractionDigits: 0,
    }).format(val) + ' FCFA';
  }

  openSendModal() {
    this.isSendModalOpen = true;
  }

  setPresetAmount(amount: number) {
    this.sendForm.amount = amount;
  }

  async confirmSendMoney() {
    if (!this.sendForm.amount || this.sendForm.amount <= 0) {
      this.showToast('Veuillez saisir un montant valide.', 'danger');
      return;
    }
    if (!this.sendForm.recipientPhone) {
      this.showToast('Veuillez saisir le numéro du destinataire.', 'danger');
      return;
    }

    const loader = await this.loadingCtrl.create({
      message: 'Transfert en cours...',
      spinner: 'crescent',
    });
    await loader.present();

    try {
      // Ask for PIN (in real app, show PIN input)
      const pin = prompt('Entrez votre PIN à 4 chiffres:');
      if (!pin) {
        await loader.dismiss();
        return;
      }

      const result = await this.homeData.sendMoney(
        this.sendForm.recipientPhone,
        Number(this.sendForm.amount),
        pin
      );

      await loader.dismiss();

      if (result.success) {
        this.showToast('✅ Transfert effectué !', 'success');
        this.isSendModalOpen = false;
        this.sendForm = {
          recipientName: '',
          recipientPhone: '',
          amount: null,
          note: '',
          category: 'transfer',
        };
      } else {
        this.showToast(result.message || 'Transfert échoué', 'danger');
      }
    } catch (err: any) {
      await loader.dismiss();
      this.showToast(err?.message || 'Transfert échoué', 'danger');
    }
  }

  viewTransactionDetails(tx: Transaction) {
    this.selectedTransaction = tx;
    this.isTxDetailsModalOpen = true;
  }

  logout() {
    this.auth.logout();
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