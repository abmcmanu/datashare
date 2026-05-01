import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { AuthService } from '../../core/auth/auth.service';
import { FileService, UserFileItem } from '../../core/files/file.service';
import { UserAvatarComponent } from '../../shared/user-avatar/user-avatar.component';

@Component({
  selector: 'ds-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, UserAvatarComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly router = inject(Router);
  protected readonly fileService = inject(FileService);

  protected mobileMenuOpen = false;
  protected currentTab = signal<'tous' | 'actifs' | 'expire'>('tous');
  protected loading = signal(true);
  protected error = signal<string | null>(null);
  protected files = signal<UserFileItem[]>([]);

  protected filteredFiles = computed(() => {
    const tab = this.currentTab();
    return this.files().filter(f => {
      if (tab === 'actifs') return !f.expired;
      if (tab === 'expire') return f.expired;
      return true;
    });
  });

  ngOnInit(): void {
    if (!this.auth.isAuthenticated()) {
      this.router.navigate(['/login']);
      return;
    }
    this.loadFiles();
  }

  private loadFiles(): void {
    this.loading.set(true);
    this.error.set(null);
    this.fileService.listFiles().subscribe({
      next: (data) => {
        this.files.set(data);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.error.set('Impossible de charger vos fichiers.');
        this.loading.set(false);
      }
    });
  }

  protected deleteFile(file: UserFileItem): void {
    this.fileService.deleteFile(file.id).subscribe({
      next: () => {
        this.files.update(list => list.filter(f => f.id !== file.id));
      },
      error: () => {
        this.error.set('Impossible de supprimer ce fichier.');
      }
    });
  }

  protected formatExpiresLabel(file: UserFileItem): string {
    if (file.expired) return 'Expiré';
    const diff = new Date(file.expiresAt).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    if (days <= 1) return 'Expire demain';
    return `Expire dans ${days} jours`;
  }

  protected logout(): void {
    this.auth.logout();
    this.router.navigate(['/']);
  }

  protected toggleMobileMenu(): void {
    this.mobileMenuOpen = !this.mobileMenuOpen;
  }

  protected setTab(tab: 'tous' | 'actifs' | 'expire'): void {
    this.currentTab.set(tab);
  }

  protected getUserName(): string {
    return this.auth.currentUser()?.email?.split('@')[0] ?? 'Utilisateur';
  }
}
