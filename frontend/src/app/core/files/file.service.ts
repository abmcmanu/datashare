import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpEventType, HttpRequest } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

// ---- Types alignés sur le contrat OpenAPI 3.0.3 ----

export interface FileUploadResponse {
  id: string;
  token: string;
  downloadUrl: string;
  originalFilename: string;
  sizeBytes: number;
  mimeType: string;
  passwordRequired: boolean;
  createdAt: string;
  expiresAt: string;
}

export interface FileMetadata {
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  expiresAt: string;
  isPasswordProtected: boolean;
}

export interface UserFileItem {
  id: string;
  token: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  passwordRequired: boolean;
  createdAt: string;
  expiresAt: string;
  expired: boolean;
  tags: string[];
}

export type UploadEvent =
  | { kind: 'progress'; loaded: number; total: number; ratio: number }
  | { kind: 'success'; data: FileUploadResponse };

// ---- Constantes côté client (doivent matcher application.yml) ----

export const ONE_GIGABYTE = 1_073_741_824;

export const FORBIDDEN_EXTENSIONS = [
  'exe', 'bat', 'cmd', 'sh', 'com', 'msi', 'scr', 'vbs', 'ps1'
];

export type ClientValidationError =
  | { code: 'TOO_LARGE'; message: string }
  | { code: 'FORBIDDEN_EXTENSION'; message: string }
  | { code: 'EMPTY'; message: string };

/**
 * Encapsule les appels REST liés aux fichiers (US01 ici, US02/US05/US06 plus tard).
 *
 * La validation côté client est doublée côté serveur (défense en profondeur).
 */
@Injectable({ providedIn: 'root' })
export class FileService {

  private readonly api = `${environment.apiBaseUrl}/files`;

  constructor(private readonly http: HttpClient) {}

  // ---------- Validation côté client ----------

  /**
   * Vérifie le fichier avant l'envoi (taille, extension).
   * @returns null si OK, sinon une ClientValidationError.
   */
  validate(file: File): ClientValidationError | null {
    if (!file || file.size === 0) {
      return { code: 'EMPTY', message: 'Le fichier est vide.' };
    }
    if (file.size > ONE_GIGABYTE) {
      return { code: 'TOO_LARGE', message: 'La taille des fichiers est limitée à 1 Go' };
    }
    const ext = this.extensionOf(file.name);
    if (ext && FORBIDDEN_EXTENSIONS.includes(ext)) {
      return {
        code: 'FORBIDDEN_EXTENSION',
        message: `Type de fichier non autorisé : .${ext}`
      };
    }
    return null;
  }

  // ---------- Upload (US01) ----------

  /**
   * Téléverse un fichier en multipart/form-data avec suivi de progression.
   *
   * @param file          le fichier choisi par l'utilisateur
   * @param expiresInDays 1..7 (par défaut 7)
   * @param password      mot de passe optionnel (≥ 6 caractères si renseigné)
   */
  upload(file: File, expiresInDays = 7, password?: string): Observable<UploadEvent> {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('expiresInDays', String(expiresInDays));
    if (password && password.length > 0) {
      form.append('password', password);
    }

    const request = new HttpRequest('POST', this.api, form, {
      reportProgress: true
    });

    return new Observable<UploadEvent>((subscriber) => {
      const sub = this.http.request<FileUploadResponse>(request).subscribe({
        next: (event: HttpEvent<FileUploadResponse>) => {
          if (event.type === HttpEventType.UploadProgress) {
            const total = event.total ?? file.size;
            subscriber.next({
              kind: 'progress',
              loaded: event.loaded,
              total,
              ratio: total > 0 ? event.loaded / total : 0
            });
          } else if (event.type === HttpEventType.Response && event.body) {
            subscriber.next({ kind: 'success', data: event.body });
            subscriber.complete();
          }
        },
        error: (err) => subscriber.error(err)
      });
      return () => sub.unsubscribe();
    });
  }

  // ---------- Download (US02) ----------

  getMetadata(token: string): Observable<FileMetadata> {
    return this.http.get<FileMetadata>(`${this.api}/${token}/metadata`);
  }

  downloadFile(token: string, password?: string): Observable<Blob> {
    return this.http.post(
      `${this.api}/${token}/download`,
      password ? { password } : {},
      { responseType: 'blob' }
    );
  }

  // ---------- History (US05) ----------

  listFiles(): Observable<UserFileItem[]> {
    return this.http.get<UserFileItem[]>(this.api);
  }

  deleteFile(id: string): Observable<void> {
    return this.http.delete<void>(`${this.api}/${id}`);
  }

  // ---------- Tags (US08) ----------

  addTag(fileId: string, label: string): Observable<string[]> {
    return this.http.post<string[]>(`${this.api}/${fileId}/tags`, { label });
  }

  removeTag(fileId: string, label: string): Observable<string[]> {
    return this.http.delete<string[]>(`${this.api}/${fileId}/tags/${encodeURIComponent(label)}`);
  }

  // ---------- Helpers ----------

  extensionOf(name: string): string | null {
    const idx = name.lastIndexOf('.');
    if (idx <= 0 || idx === name.length - 1) return null;
    return name.slice(idx + 1).toLowerCase();
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} o`;
    const units = ['Ko', 'Mo', 'Go', 'To'];
    let value = bytes / 1024;
    let i = 0;
    while (value >= 1024 && i < units.length - 1) {
      value /= 1024;
      i++;
    }
    const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
    return `${rounded.toString().replace('.', ',')} ${units[i]}`;
  }
}
