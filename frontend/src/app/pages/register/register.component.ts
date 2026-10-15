import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  displayName = '';
  email = '';
  password = '';
  confirmPassword = '';
  error = signal<string | null>(null);
  loading = signal(false);

  constructor(private readonly auth: AuthService) {}

  async onSubmit(): Promise<void> {
    this.error.set(null);

    if (!this.displayName || !this.email || !this.password) {
      this.error.set('Please fill in all fields');
      return;
    }

    if (this.password.length < 6) {
      this.error.set('Password must be at least 6 characters');
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.error.set('Passwords do not match');
      return;
    }

    this.loading.set(true);
    try {
      await this.auth.register({
        email: this.email,
        password: this.password,
        displayName: this.displayName,
      });
    } catch (err: any) {
      this.error.set(err.message || 'Registration failed. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
