import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { Auth } from '../services/auth';
import { DatabaseService } from '../services/database.service';

export interface Transaction {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  categoryLabel: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  amount: number;
  type: 'debit' | 'credit';
  date: string;
  time: string;
  status: 'completed' | 'pending' | 'failed';
  reference: string;
  fees: number;
}

export interface QuickContact {
  id: number;
  name: string;
  phone: string;
  initials: string;
  color: string;
}

export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  badge?: string;
  gradient: string;
}

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit {
  // User info
  user = {
    name: 'Mon Compte',
    phone: '',
    initials: 'MC',
    verified: false,
    cashbackBalance: 0,
  };

  // State
  showBalance = true;
  activeNavTab = 'home';
  transactionFilter: 'all' | 'debit' | 'credit' = 'all';
  searchQuery = '';
  selectedCurrency: 'XOF' | 'EUR' | 'USD' = 'XOF';
  isCardFrozen = false;
  cardView: 'balance' | 'virtual_card' = 'balance';

  // Balance values in base XOF
  balanceXOF = 0;
  monthlyExpense = 0;
  monthlyIncome = 0;

  // Currency exchange rates relative to XOF
  exchangeRates = {
    XOF: 1,
    EUR: 0.001524,
    USD: 0.001642,
  };

  // Modals visibility
  isSendModalOpen = false;
  isReceiveModalOpen = false;
  isScanModalOpen = false;
  isTopUpModalOpen = false;
  isTxDetailsModalOpen = false;
  isNotificationsModalOpen = false;
  isServicesModalOpen = false;

  // Active transaction in modal
  selectedTransaction: Transaction | null = null;

  // Send Money form
  sendForm = {
    recipientName: '',
    recipientPhone: '',
    amount: null as number | null,
    note: '',
    category: 'transfer',
  };

  // Top up form
  topUpAmount = 50000;
  topUpMethod = 'card';

  // Scanner state
  scanActiveTab: 'scan' | 'my_qr' = 'scan';

  // Quick preset amounts for transfers
  presetAmounts = [5000, 10000, 25000, 50000, 100000];

  // Quick contacts — vide pour un nouveau compte
  quickContacts: QuickContact[] = [];

  // Quick actions
  quickActions: QuickAction[] = [
    { id: 'send', label: 'Envoyer', icon: 'paper-plane', gradient: 'linear-gradient(135deg, #6366f1, #4f46e5)' },
    { id: 'receive', label: 'Demander', icon: 'arrow-down', gradient: 'linear-gradient(135deg, #10b981, #059669)' },
    { id: 'scan', label: 'Scanner QR', icon: 'qr-code', gradient: 'linear-gradient(135deg, #06b6d4, #0284c7)', badge: 'PRO' },
    { id: 'topup', label: 'Recharger', icon: 'wallet', gradient: 'linear-gradient(135deg, #f59e0b, #d97706)' },
    { id: 'bills', label: 'Factures', icon: 'receipt', gradient: 'linear-gradient(135deg, #ec4899, #be185d)' },
    { id: 'airtime', label: 'Crédit Tél', icon: 'phone-portrait', gradient: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' },
    { id: 'vault', label: 'Épargne', icon: 'shield-checkmark', gradient: 'linear-gradient(135deg, #14b8a6, #0f766e)' },
    { id: 'services', label: 'Plus', icon: 'grid', gradient: 'linear-gradient(135deg, #64748b, #334155)' },
  ];

  // Bills and utility providers
  billCategories = [
    { id: 'elec', name: 'Senelec / Électricité', icon: 'flash', color: '#f59e0b', due: '14 200 FCFA' },
    { id: 'water', name: 'Sénégalaise des Eaux', icon: 'water', color: '#06b6d4', due: '8 500 FCFA' },
    { id: 'internet', name: 'Fibre Orange & Wifi', icon: 'wifi', color: '#ff6600', due: '17 900 FCFA' },
    { id: 'canal', name: 'Canal+ & Télévision', icon: 'tv', color: '#10b981', due: 'Abonné' },
  ];

  // Savings goal
  savingsGoal = {
    title: '',
    current: 0,
    target: 0,
    percent: 0,
  };

  // Notifications — vide pour un nouveau compte
  notifications: any[] = [];

  // Transactions — vide pour un nouveau compte
  transactions: Transaction[] = [];

  // WAMP & Local DB State
  isWampConnected = false;
  isSyncing = false;
  lastSyncTime = '';
  wampApiUrl = 'http://127.0.0.1:8080';
  isDbSettingsModalOpen = false;

  constructor(
    private auth: Auth,
    private router: Router,
    private toastCtrl: ToastController,
    public dbService: DatabaseService
  ) {}

  async ngOnInit() {
    // Charger les données locales
    this.loadFromLocalDevice();

    // Récupérer le numéro de téléphone depuis l'auth
    const authPhone = this.auth.getPhone();
    if (authPhone) {
      this.user.phone = authPhone;
      // Générer les initiales depuis le numéro si pas de nom
      if (this.user.name === 'Mon Compte' && authPhone.length >= 2) {
        this.user.initials = authPhone.slice(-2);
      }
    }

    this.wampApiUrl = this.dbService.apiUrl;

    this.dbService.isWampConnected$.subscribe((connected) => {
      this.isWampConnected = connected;
    });

    this.dbService.isSyncing$.subscribe((syncing) => {
      this.isSyncing = syncing;
    });

    await this.syncDatabase();
  }

  openProfile() {
    this.showToast(`Connecté : ${this.user.phone || 'Numéro inconnu'}`, 'primary');
  }

  loadFromLocalDevice() {
    const local = this.dbService.getLocalData();
    this.user = local.user;
    this.balanceXOF = local.balanceXOF;
    this.transactions = local.transactions;
    this.quickContacts = local.contacts;
    this.savingsGoal = local.savingsGoal;
    this.lastSyncTime = local.syncedAt || 'Mode local';
  }

  async syncDatabase(showFeedback = false) {
    const res = await this.dbService.syncWithWamp();
    if (res.success && res.data) {
      this.balanceXOF = res.data.balanceXOF;
      this.transactions = res.data.transactions;
      this.lastSyncTime = res.data.syncedAt || '';
      if (showFeedback) {
        this.showToast('✅ Données synchronisées avec la base WAMP MySQL !', 'success');
      }
    } else if (showFeedback) {
      this.showToast(res.message || 'Mode local actif (Wamp non connecté)', 'warning');
    }
  }

  updateWampUrl() {
    this.dbService.setWampApiUrl(this.wampApiUrl);
    this.syncDatabase(true);
    this.isDbSettingsModalOpen = false;
  }

  // Formatting helpers
  get formattedBalance(): string {
    const rate = this.exchangeRates[this.selectedCurrency];
    const converted = this.balanceXOF * rate;

    if (this.selectedCurrency === 'XOF') {
      return new Intl.NumberFormat('fr-FR', {
        maximumFractionDigits: 0,
      }).format(converted) + ' FCFA';
    } else if (this.selectedCurrency === 'EUR') {
      return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
      }).format(converted);
    } else {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(converted);
    }
  }

  formatAmount(valXOF: number): string {
    const rate = this.exchangeRates[this.selectedCurrency];
    const converted = valXOF * rate;

    if (this.selectedCurrency === 'XOF') {
      return new Intl.NumberFormat('fr-FR', {
        maximumFractionDigits: 0,
      }).format(converted) + ' FCFA';
    } else if (this.selectedCurrency === 'EUR') {
      return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR',
      }).format(converted);
    } else {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(converted);
    }
  }

  get unreadNotificationCount(): number {
    return this.notifications.filter((n) => n.unread).length;
  }

  // Filtered transactions
  get filteredTransactions(): Transaction[] {
    return this.transactions.filter((tx) => {
      const matchType =
        this.transactionFilter === 'all' ? true : tx.type === this.transactionFilter;
      const matchSearch =
        !this.searchQuery ||
        tx.title.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        tx.categoryLabel.toLowerCase().includes(this.searchQuery.toLowerCase());
      return matchType && matchSearch;
    });
  }

  // Balance actions
  toggleBalance() {
    this.showBalance = !this.showBalance;
  }

  cycleCurrency() {
    if (this.selectedCurrency === 'XOF') this.selectedCurrency = 'EUR';
    else if (this.selectedCurrency === 'EUR') this.selectedCurrency = 'USD';
    else this.selectedCurrency = 'XOF';
  }

  toggleCardView() {
    this.cardView = this.cardView === 'balance' ? 'virtual_card' : 'balance';
  }

  toggleFreezeCard() {
    this.isCardFrozen = !this.isCardFrozen;
    const msg = this.isCardFrozen
      ? 'Carte virtuelle verrouillée temporairement.'
      : 'Carte virtuelle déverrouillée avec succès.';
    this.showToast(msg, this.isCardFrozen ? 'warning' : 'success');
  }

  // Quick Action Click
  handleQuickAction(actionId: string) {
    switch (actionId) {
      case 'send':
        this.openSendModal();
        break;
      case 'receive':
        this.isReceiveModalOpen = true;
        break;
      case 'scan':
        this.scanActiveTab = 'scan';
        this.isScanModalOpen = true;
        break;
      case 'topup':
        this.isTopUpModalOpen = true;
        break;
      case 'bills':
      case 'airtime':
      case 'services':
        this.isServicesModalOpen = true;
        break;
      case 'vault':
        this.showToast('Coffre d’épargne sécurisé à 4.5% d’intérêt annuel.', 'primary');
        break;
      default:
        this.isServicesModalOpen = true;
    }
  }

  // Contact quick tap
  selectContact(contact: QuickContact) {
    this.sendForm.recipientName = contact.name;
    this.sendForm.recipientPhone = contact.phone;
    this.isSendModalOpen = true;
  }

  openSendModal() {
    this.isSendModalOpen = true;
  }

  setPresetAmount(amount: number) {
    this.sendForm.amount = amount;
  }

  // Execute Send Money
  async confirmSendMoney() {
    if (!this.sendForm.amount || this.sendForm.amount <= 0) {
      this.showToast('Veuillez saisir un montant valide.', 'danger');
      return;
    }

    if (this.sendForm.amount > this.balanceXOF) {
      this.showToast('Solde insuffisant pour cette opération.', 'danger');
      return;
    }

    const recipient = this.sendForm.recipientName || this.sendForm.recipientPhone || 'Destinataire';
    const amountVal = Number(this.sendForm.amount);
    const noteVal = this.sendForm.note || 'Transfert instantané PayPulse';

    // Exécution avec sauvegarde locale sur l'appareil + Synchronisation WAMP MySQL
    const result = await this.dbService.executeSendMoney(
      recipient,
      this.sendForm.recipientPhone,
      amountVal,
      noteVal
    );

    this.balanceXOF = result.newBalance;
    this.monthlyExpense += amountVal;
    this.transactions.unshift(result.localTx);
    this.isSendModalOpen = false;

    // Reset form
    this.sendForm = {
      recipientName: '',
      recipientPhone: '',
      amount: null,
      note: '',
      category: 'transfer',
    };

    const statusMsg = result.synced
      ? `✅ Transfert de ${this.formatAmount(amountVal)} synchronisé avec WAMP MySQL !`
      : `📱 Transfert de ${this.formatAmount(amountVal)} enregistré sur l'appareil (mode local) !`;

    await this.showToast(statusMsg, 'success');
  }

  // Execute Top Up
  async confirmTopUp() {
    const amount = Number(this.topUpAmount);
    if (!amount || amount <= 0) {
      this.showToast('Veuillez entrer un montant valide.', 'danger');
      return;
    }

    // Exécution avec sauvegarde locale sur l'appareil + Synchronisation WAMP MySQL
    const result = await this.dbService.executeTopUp(amount, this.topUpMethod);

    this.balanceXOF = result.newBalance;
    this.monthlyIncome += amount;
    this.transactions.unshift(result.localTx);
    this.isTopUpModalOpen = false;

    const statusMsg = result.synced
      ? `✅ Recharge de ${this.formatAmount(amount)} synchronisée avec WAMP MySQL !`
      : `📱 Recharge de ${this.formatAmount(amount)} enregistrée sur l'appareil (mode local) !`;

    await this.showToast(statusMsg, 'success');
  }

  // Pay a bill
  async payBill(bill: any) {
    this.isServicesModalOpen = false;
    this.sendForm.recipientName = bill.name;
    this.sendForm.note = 'Paiement facture ' + bill.name;
    this.sendForm.amount = 14200;
    this.isSendModalOpen = true;
  }

  // Transaction details modal
  viewTransactionDetails(tx: Transaction) {
    this.selectedTransaction = tx;
    this.isTxDetailsModalOpen = true;
  }

  // Copy helper
  async copyToClipboard(text: string, label = 'Information') {
    if (navigator?.clipboard) {
      await navigator.clipboard.writeText(text);
    }
    this.showToast(`${label} copié dans le presse-papier !`, 'primary');
  }

  // Navigation tab change
  selectNavTab(tab: string) {
    this.activeNavTab = tab;
    if (tab === 'cards') {
      this.cardView = 'virtual_card';
    } else if (tab === 'scan') {
      this.scanActiveTab = 'scan';
      this.isScanModalOpen = true;
    } else if (tab === 'analytics') {
      this.showToast('Section Statistiques détaillées', 'primary');
    } else if (tab === 'profile') {
      this.showToast(`Connecté en tant que ${this.user.name}`, 'secondary');
    }
  }

  // Logout
  logout() {
    this.auth.logout();
    this.router.navigate(['/login'], { replaceUrl: true });
  }

  // Mark all notifications as read
  markNotificationsAsRead() {
    this.notifications.forEach((n) => (n.unread = false));
    this.showToast('Toutes les notifications sont marquées comme lues.', 'primary');
  }

  async showToast(message: string, color: string, duration = 3000) {
    const toast = await this.toastCtrl.create({
      message,
      color,
      duration,
      position: 'top',
      buttons: [
        {
          text: 'Fermer',
          role: 'cancel',
        },
      ],
    });
    await toast.present();
  }
}
