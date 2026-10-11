import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { Transaction, QuickContact } from '../home/home.page';

// Unique ID counter for transaction references
let txCounter = 0;

function generateUniqueRef(prefix: string): string {
  txCounter++;
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `${prefix}-${timestamp}-${txCounter}-${random}`;
}

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
    name: '',
    phone: '',
    initials: '',
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
  private readonly DB_VERSION_KEY = 'paypulse_db_version';
  private readonly DB_VERSION = 'v4_clean';

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
      const currentVersion = localStorage.getItem(this.DB_VERSION_KEY);
      if (currentVersion !== this.DB_VERSION) {
        // Nouvelle version : purge complète des anciennes données résiduelles
        localStorage.removeItem(this.STORAGE_KEY);
        localStorage.removeItem(this.PENDING_SYNC_KEY);
        localStorage.setItem(this.DB_VERSION_KEY, this.DB_VERSION);
        this.saveLocalData(DEFAULT_LOCAL_DATA);
        return JSON.parse(JSON.stringify(DEFAULT_LOCAL_DATA));
      }

      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.user && (parsed.user.name === 'Amadou Diallo' || parsed.user.name === 'Mon Compte')) {
          parsed.user.name = '';
          parsed.user.initials = '';
        }
        return parsed;
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
      if (data.user && (data.user.name === 'Amadou Diallo' || data.user.name === 'Mon Compte')) {
        data.user.name = '';
        data.user.initials = '';
      }
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Erreur lors de la sauvegarde locale sur l’appareil :', e);
    }
  }

  // Vérifier si le profil de l'utilisateur a déjà un nom
  async checkUserProfile(phone: string): Promise<{ exists: boolean; hasName: boolean; name: string }> {
    const local = this.getLocalData();

    // Vérification STRICTE : le téléphone stocké doit correspondre exactement au téléphone demandé
    const normalizePhone = (p: string) => (p || '').replace(/[\s+\-\(\).]/g, '');
    const storedPhoneNorm = normalizePhone(local.user?.phone || '');
    const phoneNorm = normalizePhone(phone);
    
    if (
      local.user &&
      storedPhoneNorm === phoneNorm &&         // correspondance normalisée obligatoire
      local.user.name &&
      local.user.name.trim().length > 0
    ) {
      return { exists: true, hasName: true, name: local.user.name };
    }

    try {
      const isConnected = await this.checkWampConnection();
      if (isConnected) {
        const res: any = await firstValueFrom(
          this.http.get(`${this.apiUrl}/get_data.php?phone=${encodeURIComponent(phone)}`)
        );
        if (res && res.success && res.user) {
          const userName = (res.user.name || '').trim();
          if (userName.length > 0 && userName !== 'Amadou Diallo' && userName !== 'Mon Compte') {
            // Only save if the phone matches (don't overwrite existing user's phone)
            const normalizePhone = (p: string) => (p || '').replace(/[\s+\-\(\).]/g, '');
            if (normalizePhone(local.user.phone || '') === normalizePhone(phone) || !local.user.phone) {
              local.user.name = userName;
              local.user.phone = phone;
              this.saveLocalData(local);
            }
            return { exists: true, hasName: true, name: userName };
          }
        }
      }
    } catch (e) {}

    return { exists: false, hasName: false, name: '' };
  }

  // Enregistrer le nom complet de l'utilisateur (Option 1)
  async saveUserProfile(phone: string, fullName: string): Promise<boolean> {
    const cleanName = fullName.trim();
    const local = this.getLocalData();
    local.user.name = cleanName;
    local.user.phone = phone;

    // Calcul des initiales
    const parts = cleanName.split(' ');
    local.user.initials = parts.map(p => p.charAt(0).toUpperCase()).join('').substring(0, 3);
    this.saveLocalData(local);

    try {
      if (this.isWampConnected$.value) {
        const res: any = await firstValueFrom(
          this.http.post(`${this.apiUrl}/update_profile.php`, {
            phone,
            name: cleanName,
          })
        );
        return !!(res && res.success);
      }
    } catch (e) {
      console.warn('Erreur mise à jour profil WAMP :', e);
    }
    return true;
  }

  // Réinitialisation forcée de la base de données
  resetLocalDatabase(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.PENDING_SYNC_KEY);
    localStorage.setItem(this.DB_VERSION_KEY, this.DB_VERSION);
    this.saveLocalData(DEFAULT_LOCAL_DATA);
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
  async syncWithWamp(userPhone?: string): Promise<{ success: boolean; data?: LocalAppData; message?: string }> {
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
      const localData = this.getLocalData();
      const phoneToUse = userPhone || localData.user?.phone || '';

      let response: any;
      if (pendingTxs.length > 0) {
        // Envoyer les transactions en attente à sync.php
        response = await firstValueFrom(
          this.http.post(`${this.apiUrl}/sync.php`, {
            user_id: 1,
            phone: phoneToUse,
            pending_transactions: pendingTxs,
          })
        );
        this.clearPendingSyncTransactions();
      } else {
        // Récupérer les données fraîches depuis MySQL en passant le numéro de téléphone
        const url = phoneToUse 
          ? `${this.apiUrl}/get_data.php?phone=${encodeURIComponent(phoneToUse)}`
          : `${this.apiUrl}/get_data.php?user_id=1`;
        response = await firstValueFrom(
          this.http.get(url)
        );
      }

      if (response && response.success) {
        const localData = this.getLocalData();

        const syncedUser = response.user || localData.user;
        if (syncedUser) {
          // Conserver le nom du profil local s'il existe déjà
          if (localData.user && localData.user.name) {
            syncedUser.name = localData.user.name;
            syncedUser.initials = localData.user.initials;
          } else {
            syncedUser.name = '';
            syncedUser.initials = '';
          }
          // Always use the phone we queried with (not WAMP user's phone)
          if (phoneToUse) {
            syncedUser.phone = phoneToUse;
          } else if (localData.user && localData.user.phone) {
            syncedUser.phone = localData.user.phone;
          }
        }

        // Mettre à jour avec les données MySQL certifiées
        const updatedData: LocalAppData = {
          user: syncedUser,
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
    const txRef = generateUniqueRef('TX-OUT');
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
        const localData = this.getLocalData();
        const userPhone = localData.user?.phone || '';
        const res: any = await firstValueFrom(
          this.http.post(`${this.apiUrl}/send_money.php`, {
            user_id: 1,
            phone: userPhone,
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
    const txRef = generateUniqueRef('DEP-VAL');
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
        const localData = this.getLocalData();
        const userPhone = localData.user?.phone || '';
        const res: any = await firstValueFrom(
          this.http.post(`${this.apiUrl}/top_up.php`, {
            user_id: 1,
            phone: userPhone,
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

  // 6. Dépôt direct vers un compte par QR Code
  async executeQrDeposit(
    recipientPhone: string,
    amount: number,
    note: string
  ): Promise<{ success: boolean; newBalance: number; localTx: Transaction; synced: boolean; message?: string }> {
    const localData = this.getLocalData();
    const isSelf = !localData.user.phone || localData.user.phone === recipientPhone;

    // Si c'est pour son propre compte, incrémenter le solde
    const newBal = isSelf ? localData.balanceXOF + amount : localData.balanceXOF;
    localData.balanceXOF = newBal;

    const txRef = generateUniqueRef('DEP-QR');
    const localTx: Transaction = {
      id: txRef,
      title: isSelf ? 'Dépôt reçu par QR Code' : `Dépôt vers ${recipientPhone}`,
      subtitle: note || 'Dépôt direct par Scan QR',
      category: 'deposit',
      categoryLabel: 'Dépôt',
      icon: isSelf ? 'arrow-down' : 'arrow-up-circle',
      iconBg: 'rgba(16, 185, 129, 0.15)',
      iconColor: '#10b981',
      amount: amount,
      type: isSelf ? 'credit' : 'debit',
      date: 'Aujourd’hui',
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      status: 'completed',
      reference: txRef,
      fees: 0,
    };

    localData.transactions.unshift(localTx);
    this.saveLocalData(localData);

    // Synchronisation WAMP
    let synced = false;
    try {
      if (this.isWampConnected$.value) {
        const res: any = await firstValueFrom(
          this.http.post(`${this.apiUrl}/deposit_qr.php`, {
            recipient_phone: recipientPhone,
            amount: amount,
            note: note,
          })
        );
        if (res && res.success) {
          synced = true;
          if (isSelf && res.newBalance !== undefined) {
            localData.balanceXOF = res.newBalance;
            this.saveLocalData(localData);
          }
        }
      }
    } catch (e) {
      synced = false;
    }

    if (!synced) {
      this.addPendingSyncTransaction(localTx);
    }

    return {
      success: true,
      newBalance: localData.balanceXOF,
      localTx,
      synced,
      message: synced
        ? `Dépôt de ${amount} FCFA synchronisé avec la base WAMP MySQL.`
        : `Dépôt de ${amount} FCFA enregistré sur l'appareil (mode local).`,
    };
  }

  setWampApiUrl(newUrl: string): void {
    this.apiUrl = newUrl.replace(/\/+$/, '');
    localStorage.setItem(this.API_URL_KEY, this.apiUrl);
    this.checkWampConnection();
  }

  // Delete user from WAMP database by phone number
  async deleteUserFromWamp(phone: string): Promise<{ success: boolean; message?: string }> {
    try {
      const res: any = await firstValueFrom(
        this.http.post(`${this.apiUrl}/delete_user.php`, {
          phone: phone,
        })
      );
      return { success: !!(res && res.success), message: res?.message };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Connexion échouée' };
    }
  }
}
