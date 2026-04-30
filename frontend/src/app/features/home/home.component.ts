import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { ApiService, HealthResponse } from '../../core/services/api.service';
import { AuthService } from '../../core/auth/auth.service';

type PingState =
  | { kind: 'loading' }
  | { kind: 'ok'; data: HealthResponse }
  | { kind: 'error'; message: string };

@Component({
  selector: 'ds-home',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {

  protected readonly state = signal<PingState>({ kind: 'loading' });
  protected readonly auth = inject(AuthService);

  protected readonly okData = computed(() => {
    const s = this.state();
    return s.kind === 'ok' ? s.data : null;
  });
  protected readonly errorMessage = computed(() => {
    const s = this.state();
    return s.kind === 'error' ? s.message : null;
  });

  constructor(private readonly api: ApiService) {}

  ngOnInit(): void {
    this.api.health().subscribe({
      next: (data) => this.state.set({ kind: 'ok', data }),
      error: (err) =>
        this.state.set({
          kind: 'error',
          message: err?.message ?? 'Erreur de connexion au back-end'
        })
    });
  }

  logout(): void {
    this.auth.logout();
  }
}
