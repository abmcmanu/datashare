import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ApiService, HealthResponse } from '../../core/services/api.service';

type PingState =
  | { kind: 'loading' }
  | { kind: 'ok'; data: HealthResponse }
  | { kind: 'error'; message: string };

/**
 * Page d'accueil — réplique de la maquette « Tu veux partager un fichier ? »
 * et affiche en bas le résultat du ping E2E vers /api/v1/health, prouvant
 * que la chaîne front → proxy → back est opérationnelle dès l'init.
 */
@Component({
  selector: 'ds-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  protected readonly state = signal<PingState>({ kind: 'loading' });

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
}
