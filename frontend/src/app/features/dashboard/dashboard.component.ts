import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';

import { AuthService } from '../../core/auth/auth.service';
import { FileService, UserFileItem } from '../../core/files/file.service';
import { UserAvatarComponent } from '../../shared/user-avatar/user-avatar.component';

@Component({
  selector: 'ds-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, UserAvatarComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  protected readonly router = inject(Router);
  protected readonly fileService = inject(FileService);

  protected mobileMenuOpen = false;
  protected currentTab = signal<'tous' | 'actifs' | 'expire'>('actifs');
  protected selectedTag = signal<string | null>(null);
  protected loading = signal(true);
  protected error = signal<string | null>(null);
  protected files = signal<UserFileItem[]>([]);
  protected fileToDelete = signal<UserFileItem | null>(null);
  protected deleting = signal(false);
  protected mobileActionsFile = signal<UserFileItem | null>(null);
  protected tagInputs: Record<string, string> = {};

  protected allTags = computed(() => {
    const tags = new Set<string>();
    for (const f of this.files()) {
      for (const t of f.tags) tags.add(t);
    }
    return [...tags].sort();
  });

  protected filteredFiles = computed(() => {
    const tab = this.currentTab();
    const tag = this.selectedTag();
    return this.files().filter(f => {
      if (tab === 'actifs' && f.expired) return false;
      if (tab === 'expire' && !f.expired) return false;
      if (tag && !f.tags.includes(tag)) return false;
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

  protected askDelete(file: UserFileItem): void {
    this.fileToDelete.set(file);
  }

  protected confirmDelete(): void {
    const file = this.fileToDelete();
    if (!file) return;

    this.deleting.set(true);
    this.error.set(null);
    this.fileService.deleteFile(file.id).subscribe({
      next: () => {
        this.files.update(list => list.filter(f => f.id !== file.id));
        this.fileToDelete.set(null);
        this.deleting.set(false);
      },
      error: () => {
        this.error.set('Impossible de supprimer ce fichier.');
        this.fileToDelete.set(null);
        this.deleting.set(false);
      }
    });
  }

  protected cancelDelete(): void {
    this.fileToDelete.set(null);
  }

  protected toggleMobileActions(file: UserFileItem | null): void {
    this.mobileActionsFile.set(file);
  }

  protected mobileAskDelete(file: UserFileItem): void {
    this.mobileActionsFile.set(null);
    this.fileToDelete.set(file);
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

  protected toggleTagFilter(tag: string): void {
    this.selectedTag.set(this.selectedTag() === tag ? null : tag);
  }

  protected getUserName(): string {
    return this.auth.currentUser()?.email?.split('@')[0] ?? 'Utilisateur';
  }

  protected addTag(file: UserFileItem): void {
    const label = (this.tagInputs[file.id] || '').trim();
    if (!label || label.length > 30) return;
    if (file.tags.includes(label.toLowerCase())) return;

    this.fileService.addTag(file.id, label).subscribe({
      next: (tags) => {
        this.updateFileTags(file.id, tags);
        this.tagInputs[file.id] = '';
      }
    });
  }

  protected removeTag(file: UserFileItem, label: string): void {
    this.fileService.removeTag(file.id, label).subscribe({
      next: (tags) => this.updateFileTags(file.id, tags)
    });
  }

  protected onTagKeydown(event: KeyboardEvent, file: UserFileItem): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.addTag(file);
    }
  }

  private updateFileTags(fileId: string, tags: string[]): void {
    this.files.update(list =>
      list.map(f => f.id === fileId ? { ...f, tags } : f)
    );
  }
}
