import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  email = '';
  password = '';
  error = signal<string | null>(null);
  loading = signal(false);

  constructor(private readonly auth: AuthService) {}

  async onSubmit(): Promise<void> {
    this.error.set(null);

    if (!this.email || !this.password) {
      this.error.set('Please fill in all fields');
      return;
    }

    this.loading.set(true);
    try {
      await this.auth.login({
        email: this.email,
        password: this.password,
      });
    } catch (err: any) {
      this.error.set(err.message || 'Login failed. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
