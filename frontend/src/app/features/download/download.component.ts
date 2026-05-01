import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/auth/auth.service';
import { FileService, FileMetadata } from '../../core/files/file.service';

type PageState = 'loading' | 'ready' | 'not-found' | 'error';

@Component({
  selector: 'ds-download',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './download.component.html',
  styleUrl: './download.component.scss'
})
export class DownloadComponent implements OnInit {
  protected readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  protected readonly fileService = inject(FileService);

  protected pageState = signal<PageState>('loading');
  protected metadata = signal<FileMetadata | null>(null);
  protected password = '';
  protected downloading = false;
  protected formError = signal<string | null>(null);
  protected token = '';

  protected get isExpired(): boolean {
    const m = this.metadata();
    if (!m) return false;
    return new Date(m.expiresAt) < new Date();
  }

  protected get daysUntilExpiry(): number {
    const m = this.metadata();
    if (!m) return 0;
    const diff = new Date(m.expiresAt).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  protected get alertState(): 'info' | 'warning' | 'error' {
    if (this.isExpired) return 'error';
    if (this.daysUntilExpiry <= 1) return 'warning';
    return 'info';
  }

  protected get alertMessage(): string {
    if (this.isExpired) return "Ce fichier n'est plus disponible en téléchargement car il a expiré.";
    if (this.daysUntilExpiry <= 1) return 'Ce fichier expirera demain.';
    return `Ce fichier expirera dans ${this.daysUntilExpiry} jour${this.daysUntilExpiry > 1 ? 's' : ''}.`;
  }

  protected get canDownload(): boolean {
    const m = this.metadata();
    if (!m || this.isExpired || this.downloading) return false;
    if (m.isPasswordProtected) return this.password.length > 0;
    return true;
  }

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.token = params['id'];
      this.loadMetadata();
    });
  }

  private loadMetadata(): void {
    this.pageState.set('loading');
    this.fileService.getMetadata(this.token).subscribe({
      next: (data) => {
        this.metadata.set(data);
        this.pageState.set('ready');
      },
      error: (err: HttpErrorResponse) => {
        if (err.status === 404) {
          this.pageState.set('not-found');
        } else {
          this.pageState.set('error');
        }
      }
    });
  }

  protected onDownload(): void {
    if (!this.canDownload) return;
    const m = this.metadata();
    if (!m) return;

    this.formError.set(null);
    this.downloading = true;

    const pwd = m.isPasswordProtected ? this.password : undefined;

    this.fileService.downloadFile(this.token, pwd).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = m.originalFilename;
        a.click();
        URL.revokeObjectURL(url);
        this.downloading = false;
      },
      error: (err: HttpErrorResponse) => {
        this.downloading = false;
        if (err.status === 401) {
          this.formError.set('Mot de passe incorrect.');
        } else if (err.status === 410) {
          this.formError.set("Ce fichier a expiré.");
          this.metadata.set({ ...m });
        } else {
          this.formError.set('Une erreur est survenue. Veuillez réessayer.');
        }
      }
    });
  }
}
