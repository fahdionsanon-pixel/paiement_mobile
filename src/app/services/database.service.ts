import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { Transaction, QuickContact } from '../home/home.page';

export interface LocalAppData {
  user: {
    id: number;
    name: string;
    phone: string;
    initials: string;
    verified: boolean;
    cashbackBalance: number;
  };
  balanceXOF: number;
  card: {
    cardNumber: string;
    cardHolder: string;
    expiry: string;
    cvv: string;
    isFrozen: boolean;
    cardTier: string;
  };
  contacts: QuickContact[];
  savingsGoal: {
    title: string;
    current: number;
    target: number;
    percent: number;
  };
  transactions: Transaction[];
  syncedAt?: string;
}

const DEFAULT_LOCAL_DATA: LocalAppData = {
  user: {
    id: 1,
    name: 'Mon Compte',
    phone: '',
    initials: 'MC',
    verified: false,
    cashbackBalance: 0,
  },
  balanceXOF: 0,
  card: {
    cardNumber: '',
    cardHolder: '',
    expiry: '',
    cvv: '',
    isFrozen: false,
    cardTier: 'STANDARD',
  },
  contacts: [],
  savingsGoal: {
    title: '',
    current: 0,
    target: 0,
    percent: 0,
  },
  transactions: [],
};

@Injectable({
  providedIn: 'root',
})
export class DatabaseService {
  private readonly STORAGE_KEY = 'paypulse_local_device_database';
  private readonly API_URL_KEY = 'paypulse_wamp_api_url';
  private readonly PENDING_SYNC_KEY = 'paypulse_pending_sync_txs';

  // WAMP Server API URLs to check
  // 1. Port 8080 (serveur PHP dédié)
  // 2. Port 80 (Apache WampServer localhost/api-paiement)
  private candidateUrls = [
    'http://127.0.0.1:8080',
    'http://localhost/api-paiement',
    'http://127.0.0.1/api-paiement',
  ];

  public apiUrl = 'http://127.0.0.1:8080';
  public isWampConnected$ = new BehaviorSubject<boolean>(false);
  public isSyncing$ = new BehaviorSubject<boolean>(false);
  public lastSyncTime = '';

  constructor(private http: HttpClient) {
    const savedUrl = localStorage.getItem(this.API_URL_KEY);
    if (savedUrl) {
      this.apiUrl = savedUrl;
    }
  }

  // 1. Chargement instantané des données locales depuis l'appareil
  getLocalData(): LocalAppData {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Impossible de lire les données locales :', e);
    }

    // Si aucune donnée n'existe encore sur l'appareil, initialiser
    this.saveLocalData(DEFAULT_LOCAL_DATA);
    return JSON.parse(JSON.stringify(DEFAULT_LOCAL_DATA));
  }

  // 2. Sauvegarde immédiate sur l'appareil
  saveLocalData(data: LocalAppData): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Erreur lors de la sauvegarde locale sur l’appareil :', e);
    }
  }

  // 3. Vérification de la connexion à WampServer
  async checkWampConnection(): Promise<boolean> {
    // Tester d'abord l'URL actuelle
    const ok = await this.pingUrl(this.apiUrl);
    if (ok) {
      this.isWampConnected$.next(true);
      return true;
    }

    // Tester les alternatives
    for (const url of this.candidateUrls) {
      if (url !== this.apiUrl) {
        const works = await this.pingUrl(url);
        if (works) {
          this.apiUrl = url;
          localStorage.setItem(this.API_URL_KEY, url);
          this.isWampConnected$.next(true);
          return true;
        }
      }
    }

    this.isWampConnected$.next(false);
    return false;
  }

  private async pingUrl(url: string): Promise<boolean> {
    try {
      const res: any = await firstValueFrom(
        this.http.get(`${url}/index.php`, { headers: { 'Accept': 'application/json' } })
      );
      return res && res.success === true;
    } catch (e) {
      return false;
    }
  }

  // 4. Synchronisation bidirectionnelle : Appareil Local <--> WAMP MySQL
  async syncWithWamp(): Promise<{ success: boolean; data?: LocalAppData; message?: string }> {
    this.isSyncing$.next(true);

    try {
      const isConnected = await this.checkWampConnection();
      if (!isConnected) {
        this.isSyncing$.next(false);
        return {
          success: false,
          message: 'WampServer injoignable. L’application continue en mode local sur votre appareil.',
        };
      }

      // Récupérer les transactions créées hors-ligne sur l'appareil
      const pendingTxs = this.getPendingSyncTransactions();

      let response: any;
      if (pendingTxs.length > 0) {
        // Envoyer les transactions en attente à sync.php
        response = await firstValueFrom(
          this.http.post(`${this.apiUrl}/sync.php`, {
            user_id: 1,
            pending_transactions: pendingTxs,
          })
        );
        this.clearPendingSyncTransactions();
      } else {
        // Récupérer les données fraîches depuis MySQL
        response = await firstValueFrom(
          this.http.get(`${this.apiUrl}/get_data.php?user_id=1`)
        );
      }

      if (response && response.success) {
        const localData = this.getLocalData();

        // Mettre à jour avec les données MySQL certifiées
        const updatedData: LocalAppData = {
          user: response.user || localData.user,
          balanceXOF: response.balanceXOF !== undefined ? response.balanceXOF : localData.balanceXOF,
          card: response.card || localData.card,
          contacts: response.contacts && response.contacts.length ? response.contacts : localData.contacts,
          savingsGoal: response.savingsGoal || localData.savingsGoal,
          transactions: response.transactions || localData.transactions,
          syncedAt: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        };

        this.saveLocalData(updatedData);
        this.lastSyncTime = updatedData.syncedAt || '';
        this.isSyncing$.next(false);

        return {
          success: true,
          data: updatedData,
          message: 'Données synchronisées avec succès avec MySQL WAMP !',
        };
      }

      this.isSyncing$.next(false);
      return { success: false, message: 'Réponse WAMP invalide.' };
    } catch (e: any) {
      this.isSyncing$.next(false);
      this.isWampConnected$.next(false);
      return {
        success: false,
        message: 'Erreur lors de la synchronisation : ' + (e?.message || 'Connexion échouée'),
      };
    }
  }

  // 5. Effectuer un virement (Sauvegarde locale immédiate + Envoi WAMP)
  async executeSendMoney(
    recipientName: string,
    recipientPhone: string,
    amount: number,
    note: string
  ): Promise<{ localTx: Transaction; synced: boolean; newBalance: number }> {
    const localData = this.getLocalData();

    // 1. Déduction locale immédiate sur l'appareil
    localData.balanceXOF -= amount;
    const txRef = 'TX-OUT-' + Math.floor(100000 + Math.random() * 900000);
    const dateLabel = 'À l’instant';
    const timeLabel = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    const newTx: Transaction = {
      id: txRef,
      title: `Transfert vers ${recipientName || recipientPhone}`,
      subtitle: note || 'Transfert instantané PayPulse',
      category: 'transfer',
      categoryLabel: 'Transfert',
      icon: 'paper-plane',
      iconBg: 'rgba(99, 102, 241, 0.15)',
      iconColor: '#6366f1',
      amount: amount,
      type: 'debit',
      date: dateLabel,
      time: timeLabel,
      status: 'completed',
      reference: txRef,
      fees: 0,
    };

    localData.transactions.unshift(newTx);
    this.saveLocalData(localData);

    // 2. Synchronisation WAMP en arrière-plan
    let synced = false;
    try {
      if (this.isWampConnected$.value) {
        const res: any = await firstValueFrom(
          this.http.post(`${this.apiUrl}/send_money.php`, {
            user_id: 1,
            recipient_name: recipientName,
            recipient_phone: recipientPhone,
            amount: amount,
            note: note,
          })
        );
        if (res && res.success) {
          synced = true;
        }
      }
    } catch (e) {
      synced = false;
    }

    if (!synced) {
      this.addPendingSyncTransaction(newTx);
    }

    return { localTx: newTx, synced, newBalance: localData.balanceXOF };
  }

  // 6. Effectuer une recharge (Sauvegarde locale immédiate + Envoi WAMP)
  async executeTopUp(
    amount: number,
    method: string
  ): Promise<{ localTx: Transaction; synced: boolean; newBalance: number }> {
    const localData = this.getLocalData();

    // 1. Crédit local immédiat sur l'appareil
    localData.balanceXOF += amount;
    const txRef = 'DEP-VAL-' + Math.floor(100000 + Math.random() * 900000);
    const dateLabel = 'À l’instant';
    const timeLabel = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    const newTx: Transaction = {
      id: txRef,
      title: 'Recharge Compte Principal',
      subtitle: method === 'card' ? 'Par Carte Bancaire' : 'Par Virement Bancaire',
      category: 'topup',
      categoryLabel: 'Recharge',
      icon: 'wallet',
      iconBg: 'rgba(6, 182, 212, 0.15)',
      iconColor: '#06b6d4',
      amount: amount,
      type: 'credit',
      date: dateLabel,
      time: timeLabel,
      status: 'completed',
      reference: txRef,
      fees: 0,
    };

    localData.transactions.unshift(newTx);
    this.saveLocalData(localData);

    // 2. Synchronisation WAMP en arrière-plan
    let synced = false;
    try {
      if (this.isWampConnected$.value) {
        const res: any = await firstValueFrom(
          this.http.post(`${this.apiUrl}/top_up.php`, {
            user_id: 1,
            amount: amount,
            method: method,
          })
        );
        if (res && res.success) {
          synced = true;
        }
      }
    } catch (e) {
      synced = false;
    }

    if (!synced) {
      this.addPendingSyncTransaction(newTx);
    }

    return { localTx: newTx, synced, newBalance: localData.balanceXOF };
  }

  // File d'attente pour synchronisation hors-ligne
  private getPendingSyncTransactions(): Transaction[] {
    try {
      const saved = localStorage.getItem(this.PENDING_SYNC_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  }

  private addPendingSyncTransaction(tx: Transaction): void {
    const list = this.getPendingSyncTransactions();
    list.push(tx);
    localStorage.setItem(this.PENDING_SYNC_KEY, JSON.stringify(list));
  }

  private clearPendingSyncTransactions(): void {
    localStorage.removeItem(this.PENDING_SYNC_KEY);
  }

  setWampApiUrl(newUrl: string): void {
    this.apiUrl = newUrl.replace(/\/+$/, '');
    localStorage.setItem(this.API_URL_KEY, this.apiUrl);
    this.checkWampConnection();
  }
}
