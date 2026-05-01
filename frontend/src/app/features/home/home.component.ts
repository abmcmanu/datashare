import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

import { ApiService, HealthResponse } from '../../core/services/api.service';
import { AuthService } from '../../core/auth/auth.service';
import { UploadDialogComponent } from '../upload/upload-dialog.component';

type PingState =
  | { kind: 'loading' }
  | { kind: 'ok'; data: HealthResponse }
  | { kind: 'error'; message: string };

@Component({
  selector: 'ds-home',
  standalone: true,
  imports: [CommonModule, RouterLink, UploadDialogComponent],
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

  /** Ouverture / fermeture de la modale d'upload (US01). */
  protected readonly uploadOpen = signal(false);

  constructor(
    private readonly api: ApiService,
    private readonly router: Router
  ) {}

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

  /**
   * Le bouton central déclenche l'upload :
   *  - si l'utilisateur est connecté → ouvre la modale (US01)
   *  - sinon → redirige vers /login (US01 réservée aux authentifiés)
   */
  protected onUploadClick(): void {
    if (this.auth.isAuthenticated()) {
      this.uploadOpen.set(true);
    } else {
      this.router.navigate(['/login']);
    }
  }

  protected closeUpload(): void {
    this.uploadOpen.set(false);
  }

}
