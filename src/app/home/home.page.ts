import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { AuthService } from '../services/auth-new.service';
import { DatabaseService } from '../services/database.service';
import { ApiClientService } from '../services/api-client.service';
import * as QRCode from 'qrcode';
import jsQR from 'jsqr';

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
    name: '',
    phone: '',
    initials: '',
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
  isScanModalOpen = false;
  isQrFullscreenModalOpen = false;
  isScannedDepositModalOpen = false;
  isTopUpModalOpen = false;
  isTxDetailsModalOpen = false;
  isNotificationsModalOpen = false;
  isServicesModalOpen = false;
  isWithdrawModalOpen = false;
  isPinModalOpen = false;

  // QR Code du compte
  myQrCodeDataUrl = '';

  // Dépôt après scan
  scannedRecipientPhone = '';
  scannedDepositAmount: number | null = 5000;
  scannedDepositNote = 'Dépôt direct par Scan QR';

  // Scanner et Caméra
  isCameraActive = false;
  cameraErrorMessage = '';
  private cameraStream: MediaStream | null = null;
  private scanAnimFrameId: any = null;

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

  // Withdrawal form
  withdrawalForm = {
    method: 'mobile_money',
    recipientPhone: '',
    amount: null as number | null,
    note: '',
  };

  // Withdrawal methods
  withdrawalMethods = [
    { id: 'mobile_money', name: 'Mobile Money', icon: 'phone-portrait-outline', color: '#f59e0b' },
    { id: 'bank_transfer', name: 'Virement Bancaire', icon: 'bank-outline', color: '#1D4ED8' },
    { id: 'airtime', name: 'Crédit Téléphonique', icon: 'call-outline', color: '#10b981' },
  ];

  // PIN Security
  isPinSetup = false;
  pinInput = '';
  pinConfirm = '';
  pinError = '';

  // Send Money
  sendPin = '';
  isSending = false;

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
    private auth: AuthService,
    private router: Router,
    private toastCtrl: ToastController,
    public dbService: DatabaseService,
    private api: ApiClientService
  ) {}

  async ngOnInit() {
    // Récupérer le numéro de téléphone depuis l'auth
    const authPhone = this.auth.getPhone();

    // Charger les données locales SEULEMENT si elles appartiennent à ce compte
    this.loadFromLocalDevice(authPhone);

    // Charger le statut PIN
    this.loadPinStatus();

    // Générer le QR Code dynamique du compte
    await this.generateMyQrCode();

    this.wampApiUrl = this.dbService.apiUrl;

    this.dbService.isWampConnected$.subscribe((connected) => {
      this.isWampConnected = connected;
    });

    this.dbService.isSyncing$.subscribe((syncing) => {
      this.isSyncing = syncing;
    });

    // Sync with the authenticated phone number (not from local data which may be empty)
    await this.syncDatabase(false, authPhone);
  }

  openProfile() {
    this.showToast(`Connecté : ${this.user.phone || 'Numéro inconnu'}`, 'primary');
  }

  loadFromLocalDevice(authPhone?: string) {
    const local = this.dbService.getLocalData();

    // Normalize phone numbers for comparison (remove +, spaces, dashes)
    const normalizePhone = (p: string) => (p || '').replace(/[\s+\-\(\).]/g, '');
    const storedPhone = normalizePhone(local.user?.phone || '');
    const authPhoneNorm = normalizePhone(authPhone || '');

    // Vérification cruciale : les données stockées appartiennent-elles à ce compte ?
    const isSameUser = !storedPhone || !authPhoneNorm || storedPhone === authPhoneNorm;

    if (!isSameUser) {
      // Autre utilisateur détecté sur cet appareil → réinitialiser proprement
      console.log(`Compte différent détecté (${storedPhone} ≠ ${authPhoneNorm}). Réinitialisation des données locales.`);
      this.dbService.resetLocalDatabase();
      // Repartir sur des données vides pour ce nouvel utilisateur
      this.user = { name: '', phone: authPhone || '', initials: '', verified: false, cashbackBalance: 0 };
      this.balanceXOF = 0;
      this.transactions = [];
      this.quickContacts = [];
      this.savingsGoal = { title: '', current: 0, target: 0, percent: 0 };
      this.lastSyncTime = 'Mode local';
      return;
    }

    // Même utilisateur → charger ses données normalement
    this.user = { ...local.user };
    if (authPhone) {
      this.user.phone = authPhone;
    }
    this.balanceXOF = local.balanceXOF;
    this.transactions = local.transactions;
    this.quickContacts = local.contacts;
    this.savingsGoal = local.savingsGoal;
    this.lastSyncTime = local.syncedAt || 'Mode local';
  }

  async syncDatabase(showFeedback = false, authPhone?: string) {
    const phoneToUse = authPhone || this.auth.getPhone();
    const res = await this.dbService.syncWithWamp(phoneToUse);
    if (res.success && res.data) {
      // Only update balance and transactions from WAMP
      // Preserve the current user's phone and name (don't overwrite with WAMP user_id=1 data)
      this.balanceXOF = res.data.balanceXOF;
      this.transactions = res.data.transactions;
      this.lastSyncTime = res.data.syncedAt || '';
      
      // Conserver le nom du profil local (ne pas écraser avec les données WAMP)
      const savedProfile = this.dbService.getLocalData();
      if (savedProfile.user && savedProfile.user.name) {
        this.user.name = savedProfile.user.name;
        this.user.initials = savedProfile.user.initials;
      }
      // Always use the authenticated phone, not WAMP data
      if (phoneToUse) {
        this.user.phone = phoneToUse;
      }
      if (showFeedback) {
        this.showToast('✅ Données synchronisées avec la base WAMP MySQL !', 'success');
      }
    } else if (showFeedback) {
      this.showToast(res.message || 'Mode local actif (Wamp non connecté)', 'warning');
    }
  }

  updateWampUrl() {
    this.dbService.setWampApiUrl(this.wampApiUrl);
    this.syncDatabase(true, this.auth.getPhone());
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
      case 'scan':
        this.openScanner();
        break;
      case 'topup':
        this.isTopUpModalOpen = true;
        break;
      case 'withdraw':
        this.openWithdrawModal();
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

  // ===== GESTION DU CODE QR DU COMPTE & SCAN =====
  async generateMyQrCode() {
    try {
      const phone = this.user.phone || '+22670000000';
      const payload = JSON.stringify({
        app: 'paypulse',
        action: 'deposit',
        phone: phone,
      });

      this.myQrCodeDataUrl = await QRCode.toDataURL(payload, {
        width: 380,
        margin: 2,
        color: {
          dark: '#1D4ED8',
          light: '#FFFFFF',
        },
        errorCorrectionLevel: 'M',
      });
    } catch (e) {
      console.error('Erreur génération QR Code :', e);
    }
  }

  openQrFullscreen() {
    this.isQrFullscreenModalOpen = true;
  }

  openScanner() {
    this.scanActiveTab = 'scan';
    this.isScanModalOpen = true;
    setTimeout(() => {
      this.startCamera();
    }, 350);
  }

  closeScanner() {
    this.stopCamera();
    this.isScanModalOpen = false;
  }

  async startCamera() {
    this.cameraErrorMessage = '';
    this.isCameraActive = false;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.cameraErrorMessage = 'Caméra indisponible ou non autorisée dans ce navigateur.';
      return;
    }

    try {
      this.cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });

      const video = document.getElementById('waveCameraVideo') as HTMLVideoElement;
      if (video) {
        video.srcObject = this.cameraStream;
        video.setAttribute('playsinline', 'true');
        await video.play();
        this.isCameraActive = true;
        this.scanVideoFrame(video);
      }
    } catch (err: any) {
      console.warn('Accès caméra non accordé :', err);
      this.cameraErrorMessage = 'Impossible d’accéder à la caméra. Utilisez l’import ou le test de scan.';
    }
  }

  stopCamera() {
    if (this.scanAnimFrameId) {
      cancelAnimationFrame(this.scanAnimFrameId);
      this.scanAnimFrameId = null;
    }
    if (this.cameraStream) {
      this.cameraStream.getTracks().forEach((track) => track.stop());
      this.cameraStream = null;
    }
    this.isCameraActive = false;
  }

  private scanVideoFrame(video: HTMLVideoElement) {
    if (!this.isScanModalOpen || this.scanActiveTab !== 'scan') {
      this.stopCamera();
      return;
    }

    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imgData.data, imgData.width, imgData.height, {
          inversionAttempts: 'dontInvert',
        });
        if (code && code.data) {
          this.onQrCodeScanned(code.data);
          return;
        }
      }
    }

    this.scanAnimFrameId = requestAnimationFrame(() => this.scanVideoFrame(video));
  }

  onQrCodeScanned(rawData: string) {
    this.stopCamera();
    this.isScanModalOpen = false;

    let phone = '';

    // 1. Tenter de parser du JSON
    try {
      const parsed = JSON.parse(rawData);
      if (parsed && (parsed.phone || parsed.account)) {
        phone = parsed.phone || parsed.account;
      }
    } catch (e) {}

    // 2. Format PAYPULSE:ACCOUNT:...
    if (!phone && rawData.includes('PAYPULSE:ACCOUNT:')) {
      phone = rawData.replace('PAYPULSE:ACCOUNT:', '').trim();
    }

    // 3. Détection de numéro de téléphone
    if (!phone) {
      const match = rawData.match(/(\+?\d[\d\s-]{6,15})/);
      if (match) {
        phone = match[0].trim();
      } else {
        phone = rawData.trim();
      }
    }

    if (!phone) {
      this.showToast('Code QR non reconnu comme un compte de paiement.', 'warning');
      return;
    }

    // Ouvrir le modal de dépôt pour ce compte
    this.scannedRecipientPhone = phone;
    this.scannedDepositAmount = 5000;
    this.scannedDepositNote = `Dépôt direct par QR Code`;
    this.isScannedDepositModalOpen = true;

    this.showToast(`🎯 Compte détecté : ${phone}`, 'success');
  }

  onFileQrSelected(event: any) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imgData.data, imgData.width, imgData.height);
          if (code && code.data) {
            this.onQrCodeScanned(code.data);
          } else {
            this.showToast('Aucun code QR détecté dans cette image.', 'warning');
          }
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  simulateScanTest(phoneToTest = '+226 70 88 99 00') {
    this.onQrCodeScanned(phoneToTest);
  }

  async confirmScannedDeposit() {
    if (!this.scannedDepositAmount || this.scannedDepositAmount <= 0) {
      this.showToast('Veuillez entrer un montant valide.', 'danger');
      return;
    }

    const amount = Number(this.scannedDepositAmount);
    const recipient = this.scannedRecipientPhone;
    const note = this.scannedDepositNote || 'Dépôt direct par Scan QR';

    const result = await this.dbService.executeQrDeposit(recipient, amount, note);

    if (result.success) {
      this.balanceXOF = result.newBalance;
      this.transactions.unshift(result.localTx);
      this.isScannedDepositModalOpen = false;

      const msg = result.synced
        ? `✅ Dépôt de ${this.formatAmount(amount)} effectué avec succès sur le compte ${recipient} (WAMP MySQL) !`
        : `📱 Dépôt de ${this.formatAmount(amount)} enregistré sur l'appareil pour le compte ${recipient} !`;

      await this.showToast(msg, 'success');
    } else {
      this.showToast('Erreur lors du dépôt sur le compte scanné.', 'danger');
    }
  }

  // Contact quick tap
  selectContact(contact: QuickContact) {
    this.sendForm.recipientPhone = contact.phone;
    this.sendForm.recipientName = contact.name;
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
    if (this.isSending) return;
    const amountVal = Number(this.sendForm.amount);
    if (!Number.isInteger(amountVal) || amountVal <= 0) {
      this.showToast('Veuillez saisir un montant valide.', 'danger');
      return;
    }
    if (!this.sendForm.recipientPhone) {
      this.showToast('Veuillez saisir le numéro du destinataire.', 'danger');
      return;
    }
    if (this.sendPin.length !== 4) {
      this.showToast('Entrez votre PIN à 4 chiffres.', 'danger');
      return;
    }
    // Verify PIN locally
    if (!this.auth.verifyPin(this.sendPin)) {
      this.showToast('PIN incorrect.', 'danger');
      return;
    }
    this.isSending = true;
    try {
      const res = await this.api.sendMoney(
        this.auth.getPhone(), this.sendForm.recipientPhone, amountVal, this.sendForm.note, this.sendForm.category
      );
      this.balanceXOF = res.newBalance;
      this.monthlyExpense += amountVal;
      this.isSendModalOpen = false;
      this.sendForm = { recipientName: '', recipientPhone: '', amount: null, note: '', category: 'transfer' };
      this.sendPin = '';
      await this.showToast(`✅ ${this.formatAmount(amountVal)} envoyés`, 'success');
    } catch (e: any) {
      const msg = e?.error?.message || 'Envoi impossible. Vérifiez votre connexion.';
      await this.showToast(msg, 'danger');
    } finally {
      this.isSending = false;
      this.sendPin = '';
    }
  }

  // Execute Top Up
  async confirmTopUp() {
    const amount = Number(this.topUpAmount);
    if (!amount || amount <= 0) {
      this.showToast('Veuillez entrer un montant valide.', 'danger');
      return;
    }

    try {
      const res = await this.api.topUp(this.auth.getPhone(), amount, this.topUpMethod);
      this.balanceXOF = res.newBalance;
      this.monthlyIncome += amount;
      this.isTopUpModalOpen = false;
      await this.showToast(`✅ Recharge de ${this.formatAmount(amount)} effectuée`, 'success');
    } catch (e: any) {
      const msg = e?.error?.message || 'Recharge impossible.';
      await this.showToast(msg, 'danger');
    }
  }

    await this.showToast(statusMsg, 'success');
  }

  // Pay a bill
  async payBill(bill: any) {
    this.isServicesModalOpen = false;
    this.sendForm.recipientPhone = bill.phone || '';
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
      this.openScanner();
    } else if (tab === 'analytics') {
      this.showToast('Section Statistiques détaillées', 'primary');
    } else if (tab === 'profile') {
      this.showToast(`Connecté : ${this.user.phone || 'Numéro inconnu'}`, 'secondary');
    }
  }

  // ===== WITHDRAWAL =====
  openWithdrawModal() {
    this.isWithdrawModalOpen = true;
  }

  async confirmWithdrawal() {
    if (!this.withdrawalForm.amount || this.withdrawalForm.amount <= 0) {
      this.showToast('Veuillez saisir un montant valide.', 'danger');
      return;
    }
    if (!this.withdrawalForm.recipientPhone) {
      this.showToast('Veuillez saisir le numéro de destination.', 'danger');
      return;
    }
    if (this.withdrawalForm.amount > this.balanceXOF) {
      this.showToast('Solde insuffisant pour ce retrait.', 'danger');
      return;
    }

    // Request PIN authorization
    if (!this.isPinSetup) {
      this.isWithdrawModalOpen = false;
      this.openPinSetup();
      return;
    }

    this.isWithdrawModalOpen = false;

    const amountVal = Number(this.withdrawalForm.amount);
    const methodLabel = this.withdrawalMethods.find(m => m.id === this.withdrawalForm.method)?.name || 'Retrait';

    // Deduct balance
    this.balanceXOF -= amountVal;
    this.monthlyExpense += amountVal;

    const txRef = 'WD-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 8);
    const dateLabel = 'À l’instant';
    const timeLabel = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    const newTx: Transaction = {
      id: txRef,
      title: `Retrait ${methodLabel}`,
      subtitle: this.withdrawalForm.note || `Vers ${this.withdrawalForm.recipientPhone}`,
      category: 'withdraw',
      categoryLabel: 'Retrait',
      icon: 'arrow-up',
      iconBg: 'rgba(239, 68, 68, 0.15)',
      iconColor: '#ef4444',
      amount: amountVal,
      type: 'debit',
      date: dateLabel,
      time: timeLabel,
      status: 'completed',
      reference: txRef,
      fees: 0,
    };

    this.transactions.unshift(newTx);

    // Reset form
    this.withdrawalForm = {
      method: 'mobile_money',
      recipientPhone: '',
      amount: null,
      note: '',
    };

    await this.showToast(`✅ Retrait de ${this.formatAmount(amountVal)} effectué !`, 'success');
  }

  // ===== PIN SECURITY =====
  loadPinStatus() {
    this.isPinSetup = this.auth.hasPin();
  }

  openPinSetup() {
    this.pinInput = '';
    this.pinConfirm = '';
    this.pinError = '';
    this.isPinModalOpen = true;
  }

  async confirmPinSetup() {
    if (!/^\d{4}$/.test(this.pinInput)) {
      this.pinError = 'Le PIN doit être à 4 chiffres.';
      return;
    }
    if (this.pinInput !== this.pinConfirm) {
      this.pinError = 'Les codes ne correspondent pas.';
      return;
    }
    const res = await this.auth.setPin(this.pinInput);
    if (!res.success) {
      this.pinError = res.message;
      return;
    }
    this.pinInput = '';
    this.pinConfirm = '';
    this.isPinSetup = true;
    this.isPinModalOpen = false;
    this.showToast('PIN enregistré avec succès !', 'success');
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
