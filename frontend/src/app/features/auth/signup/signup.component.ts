import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { AuthService } from '../../../core/auth/auth.service';

/**
 * Validateur croisé : password et passwordConfirm doivent être identiques.
 */
const passwordsMatch: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const p1 = group.get('password')?.value;
  const p2 = group.get('passwordConfirm')?.value;
  return p1 && p2 && p1 !== p2 ? { passwordsMismatch: true } : null;
};

/**
 * Page de création de compte (US03)
 */
@Component({
  selector: 'ds-signup',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './signup.component.html',
  styleUrl: '../auth-card.scss'
})
export class SignupComponent {

  protected readonly form = this.fb.nonNullable.group(
    {
      email: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
      password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(72)]],
      passwordConfirm: ['', [Validators.required]]
    },
    { validators: passwordsMatch }
  );

  protected readonly submitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  constructor(
    private readonly fb: FormBuilder,
    private readonly auth: AuthService,
    private readonly router: Router
  ) {}

  submit(): void {
    if (this.form.invalid || this.submitting()) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, password } = this.form.getRawValue();
    this.submitting.set(true);
    this.errorMessage.set(null);

    this.auth.signup(email, password).subscribe({
      next: () => {
        this.submitting.set(false);
        this.router.navigate(['/']);
      },
      error: (err: HttpErrorResponse) => {
        this.submitting.set(false);
        this.errorMessage.set(this.extractMessage(err));
      }
    });
  }

  private extractMessage(err: HttpErrorResponse): string {
    if (err.status === 409) return 'Un compte existe déjà avec cet email.';
    if (err.status === 400) return err.error?.message ?? 'Données invalides.';
    if (err.status === 0)   return 'Impossible de joindre le serveur.';
    return err.error?.message ?? 'Une erreur est survenue.';
  }
}
