import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { AuthService } from '../services/auth-new.service';
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
  showBalance = false;
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
  pinDigits: string[] = ['', '', '', ''];
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

  // Idempotency key for transfers
  private sendKey = this.newKey();

  constructor(
    private auth: AuthService,
    private router: Router,
    private toastCtrl: ToastController,
    private api: ApiClientService
  ) {}

  private newKey(): string {
    return typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  async ngOnInit() {
    const name = this.auth.getCurrentUser()?.name || '';
    this.user = {
      name,
      phone: this.auth.getPhone(),
      initials: this.getInitials(name),
      verified: true,
      cashbackBalance: 0,
    };
    this.loadPinStatus();
    await this.generateMyQrCode();
    await this.refreshData();
  }

  // Actualise le solde et l'historique à chaque affichage de la page
  async ionViewWillEnter() {
    await this.refreshData();
    // Démarrer le rafraîchissement automatique toutes les 10 secondes
    this.startAutoRefresh();
  }

  async ionViewWillLeave() {
    // Arrêter le rafraîchissement automatique quand on quitte la page
    this.stopAutoRefresh();
  }

  // Rafraîchissement automatique toutes les 10 secondes
  private autoRefreshInterval: any = null;

  private startAutoRefresh() {
    if (this.autoRefreshInterval) return; // déjà démarré
    this.autoRefreshInterval = setInterval(() => {
      this.refreshData(false); // sans toast
    }, 5000); // 5 secondes
  }

  private stopAutoRefresh() {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
      this.autoRefreshInterval = null;
    }
  }

  // Pull-to-refresh handler
  async doRefresh(event: any) {
    await this.refreshData(true);
    event.target.complete();
  }

  private getInitials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0].toUpperCase())
      .join('');
  }

  // Le solde et l'historique viennent toujours du serveur
  async refreshData(showFeedback = false) {
    try {
      const res: any = await this.api.getTransactions();
      this.balanceXOF = res.balance;
      this.transactions = res.transactions.map((t: any) => this.mapTransaction(t));
      if (showFeedback) {
        this.showToast('Données à jour', 'success');
      }
    } catch (e: any) {
      this.showToast(e?.error?.message || 'Impossible de charger vos données.', 'danger');
    }
  }

  // Transforme une transaction du serveur en ligne d'historique de l'écran
  private mapTransaction(t: any): Transaction {
    const sent = !!t.is_sender;
    const other = (sent ? t.to_phone : t.from_phone) || '';
    const raw = String(t.created_at);
    const d = new Date(raw.includes('T') ? raw : raw.replace(' ', 'T') + 'Z');
    return {
      id: t.reference,
      title: sent ? `Envoi à ${other}` : `Reçu de ${other}`,
      subtitle: other,
      category: 'transfer',
      categoryLabel: 'Transfert',
      icon: sent ? 'paper-plane' : 'arrow-down',
      iconBg: sent ? 'rgba(99, 102, 241, 0.15)' : 'rgba(16, 185, 129, 0.15)',
      iconColor: sent ? '#6366f1' : '#10b981',
      amount: t.amount,
      type: sent ? 'debit' : 'credit',
      date: d.toLocaleDateString('fr-FR'),
      time: d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      status: t.status,
      reference: t.reference,
      fees: 0,
    };
  }

  openProfile() {
    this.showToast(`Connecté : ${this.user.phone || 'Numéro inconnu'}`, 'primary');
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
    // Validate recipient phone: exactly 8 digits after removing +, spaces, country code
    const recipientDigits = this.sendForm.recipientPhone.replace(/[^0-9]/g, '');
    if (!/^\d{8}$/.test(recipientDigits)) {
      this.showToast('Le numéro destinataire doit contenir exactement 8 chiffres.', 'danger');
      return;
    }
    if (this.sendPin.length !== 4) {
      this.showToast('Entrez votre PIN à 4 chiffres.', 'danger');
      return;
    }
    this.isSending = true;
    try {
      const res: any = await this.api.sendMoney(
        this.sendForm.recipientPhone, amountVal, this.sendPin, this.sendKey
      );
      this.balanceXOF = res.transaction.sender_new_balance; // le solde vient du serveur
      this.isSendModalOpen = false;
      this.sendForm = { recipientName: '', recipientPhone: '', amount: null, note: '', category: 'transfer' };
      this.sendKey = this.newKey();
      await this.showToast(`✅ ${this.formatAmount(amountVal)} envoyés`, 'success');
      await this.refreshData();
    } catch (e: any) {
      const msg = e?.error?.message || 'Envoi impossible. Vérifiez votre connexion.';
      await this.showToast(msg, 'danger');
    } finally {
      this.isSending = false;
      this.sendPin = '';
    }
  }

  // Pas encore disponible : seul le serveur peut modifier un solde
  private featureUnavailable(label: string) {
    this.showToast(`${label} n'est pas encore disponible dans cette version.`, 'warning');
  }

  async confirmTopUp() {
    this.isTopUpModalOpen = false;
    this.featureUnavailable('La recharge');
  }

  async confirmScannedDeposit() {
    this.isScannedDepositModalOpen = false;
    this.featureUnavailable('Le dépôt par QR code');
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
    this.isWithdrawModalOpen = false;
    this.featureUnavailable('Le retrait');
  }

  // ===== PIN SECURITY =====
  loadPinStatus() {
    this.isPinSetup = this.auth.hasPin();
  }

  openPinSetup() {
    this.pinDigits = ['', '', '', ''];
    this.pinConfirm = '';
    this.pinError = '';
    this.isPinModalOpen = true;
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
    const res = await this.auth.setPin(pin);
    if (!res.success) {
      this.pinError = res.message;
      return;
    }
    this.pinDigits = ['', '', '', ''];
    this.pinConfirm = '';
    this.isPinSetup = true;
    this.isPinModalOpen = false;
    this.showToast('PIN enregistré avec succès !', 'success');
  }

  moveFocus(event: Event, nextIndex: number) {
    const input = event.target as HTMLInputElement;
    if (input.value.length === 1 && nextIndex >= 0 && nextIndex < 4) {
      const nextInput = input.parentElement?.querySelectorAll('input')[nextIndex] as HTMLInputElement;
      nextInput?.focus();
    } else if (input.value.length === 0 && nextIndex === -1) {
      // Backspace handling - could move to previous if needed
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
