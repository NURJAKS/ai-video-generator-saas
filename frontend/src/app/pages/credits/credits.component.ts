import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  priceUsd: number;
}

@Component({
  selector: 'app-credits',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  templateUrl: './credits.component.html',
  styleUrl: './credits.component.scss'
})
export class CreditsComponent implements OnInit {
  private api = inject(ApiService);
  private auth = inject(AuthService);

  // Signals for state
  userBalance = signal<number>(this.auth.user()?.creditBalance || 0);
  loadingPackages = signal<boolean>(true);
  packages = signal<CreditPackage[]>([]);
  purchasing = signal<string | null>(null);
  error = signal<string>('');

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    this.loadingPackages.set(true);
    this.error.set('');
    
    try {
      // 1. Fetch user profile to get fresh balance
      const me = await this.api.get<any>('/auth/me');
      if (me && me.creditBalance !== undefined) {
        this.userBalance.set(me.creditBalance);
        this.auth.updateUser({ creditBalance: me.creditBalance }); // Ensure auth service is in sync
      }

      // 2. Fetch packages (assume endpoint is /credits/packages)
      const pkgs = await this.api.get<CreditPackage[]>('/credits/packages');
      this.packages.set(pkgs);
    } catch (e: any) {
      this.error.set(e.message || 'Failed to load credit packages.');
    } finally {
      this.loadingPackages.set(false);
    }
  }

  async purchasePackage(pkg: CreditPackage) {
    if (this.purchasing() !== null) return;
    
    this.purchasing.set(pkg.id);
    this.error.set('');

    try {
      // Simulate real purchase API call (e.g. Stripe checkout or direct top-up endpoint)
      // Since it's a test environment, maybe there's a manual top-up endpoint
      // We'll call a generic buy endpoint or admin manual top-up for now.
      
      const res = await this.api.post<any>(`/credits/buy`, { packageId: pkg.id });
      
      // Update balance
      if (res && res.newBalance !== undefined) {
        this.userBalance.set(res.newBalance);
        this.auth.updateUser({ creditBalance: res.newBalance });
      } else {
        // Fallback: refresh profile
        this.loadData();
      }
      
    } catch (e: any) {
      this.error.set(e.message || 'Failed to purchase credits. Please try again.');
    } finally {
      this.purchasing.set(null);
    }
  }
}
