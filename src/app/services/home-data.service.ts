// Home Data Service - Uses Node.js API backend
// Fetches balance, transactions, and handles transfers

import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ApiClientService } from './api-client.service';
import { AuthService } from './auth-new.service';

export interface AccountData {
  balance: number;
  currency: string;
  transactions: TransactionData[];
}

export interface TransactionData {
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

@Injectable({
  providedIn: 'root',
})
export class HomeDataService {
  private accountData$ = new BehaviorSubject<AccountData | null>(null);
  private loading$ = new BehaviorSubject<boolean>(false);

  public accountDataObs$ = this.accountData$.asObservable();
  public loadingObs$ = this.loading$.asObservable();

  constructor(
    private api: ApiClientService,
    private auth: AuthService
  ) {}

  async loadAccountData(): Promise<AccountData | null> {
    this.loading$.next(true);
    try {
      const phone = this.auth.getPhone();
      const res = await this.api.getTransactions(phone);
      if (res.success) {
        const data: AccountData = {
          balance: res.balance,
          currency: res.currency,
          transactions: res.transactions || [],
        };
        this.accountData$.next(data);
        return data;
      }
    } catch (err) {
      console.error('Load account data error:', err);
    }
    this.loading$.next(false);
    return null;
  }

  getBalance(): number {
    return this.accountData$.value?.balance || 0;
  }

  getCurrency(): string {
    return this.accountData$.value?.currency || 'XOF';
  }

  getTransactions(): TransactionData[] {
    return this.accountData$.value?.transactions || [];
  }

  async sendMoney(recipientPhone: string, amount: number, pin: string): Promise<any> {
    this.loading$.next(true);
    try {
      const phone = this.auth.getPhone();
      const res = await this.api.sendMoney(phone, recipientPhone, amount, pin);
      if (res.success) {
        // Refresh data
        await this.loadAccountData();
      }
      return res;
    } catch (err: any) {
      return { success: false, message: err?.message || 'Transfert échoué' };
    } finally {
      this.loading$.next(false);
    }
  }
}

export default HomeDataService;