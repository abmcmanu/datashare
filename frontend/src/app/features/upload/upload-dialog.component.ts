import {
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Output,
  ViewChild,
  computed,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';

import {
  ClientValidationError,
  FileService,
  FileUploadResponse,
  ONE_GIGABYTE
} from '../../core/files/file.service';

type DialogState =
  | { kind: 'empty' }                              // pas encore de fichier sélectionné
  | { kind: 'selecting'; file: File; clientError: ClientValidationError | null }
  | { kind: 'uploading'; file: File; ratio: number }
  | { kind: 'success'; file: File; response: FileUploadResponse }
  | { kind: 'error'; file: File; message: string };

/**
 * Modale « Ajouter un fichier » — implémente US01 côté front.
 *
 * Reprend les 3 écrans de la maquette :
 *  1) Sélection du fichier + mot de passe (optionnel) + expiration
 *  2) Téléversement avec progression
 *  3) Confirmation avec lien copiable
 *
 * Émet `(closed)` quand l'utilisateur ferme la modale.
 */
@Component({
  selector: 'ds-upload-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './upload-dialog.component.html',
  styleUrl: './upload-dialog.component.scss'
})
export class UploadDialogComponent {

  @Output() closed = new EventEmitter<void>();
  @Output() uploaded = new EventEmitter<FileUploadResponse>();

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  protected readonly state = signal<DialogState>({ kind: 'empty' });
  protected readonly maxSizeBytes = ONE_GIGABYTE;
  protected readonly copySuccess = signal(false);

  protected readonly sel = computed(() => { const s = this.state(); return s.kind === 'selecting'  ? s : null; });
  protected readonly up  = computed(() => { const s = this.state(); return s.kind === 'uploading'  ? s : null; });
  protected readonly ok  = computed(() => { const s = this.state(); return s.kind === 'success'    ? s : null; });
  protected readonly err = computed(() => { const s = this.state(); return s.kind === 'error'      ? s : null; });

  /** Options du dropdown d'expiration (1..7 jours). */
  protected readonly expirationOptions = [
    { days: 1, label: 'Une journée' },
    { days: 2, label: '2 jours' },
    { days: 3, label: '3 jours' },
    { days: 4, label: '4 jours' },
    { days: 5, label: '5 jours' },
    { days: 6, label: '6 jours' },
    { days: 7, label: 'Une semaine' }
  ];

  protected readonly form = this.fb.nonNullable.group({
    password: ['', [Validators.minLength(6), Validators.maxLength(128)]],
    expiresInDays: [7, [Validators.required, Validators.min(1), Validators.max(7)]]
  });

  /** True quand on peut soumettre (fichier valide + form valide). */
  protected readonly canSubmit = computed(() => {
    const s = this.state();
    return s.kind === 'selecting' && s.clientError === null && this.form.valid;
  });

  constructor(
    private readonly fb: FormBuilder,
    private readonly fileService: FileService
  ) {}

  // ---------- Sélection du fichier ----------

  protected openPicker(): void {
    this.fileInput.nativeElement.click();
  }

  protected onFileChosen(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (file) {
      this.setFile(file);
    }
    input.value = ''; // permet de re-sélectionner le même fichier
  }

  /** Drag-and-drop sur la modale. */
  @HostListener('drop', ['$event'])
  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0] ?? null;
    if (file) this.setFile(file);
  }

  @HostListener('dragover', ['$event'])
  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  private setFile(file: File): void {
    const clientError = this.fileService.validate(file);
    this.state.set({ kind: 'selecting', file, clientError });
  }

  // ---------- Soumission ----------

  protected submit(): void {
    const s = this.state();
    if (s.kind !== 'selecting' || s.clientError !== null || this.form.invalid) {
      return;
    }
    const { password, expiresInDays } = this.form.getRawValue();
    this.state.set({ kind: 'uploading', file: s.file, ratio: 0 });

    this.fileService.upload(s.file, expiresInDays, password || undefined).subscribe({
      next: (event) => {
        if (event.kind === 'progress') {
          this.state.set({ kind: 'uploading', file: s.file, ratio: event.ratio });
        } else if (event.kind === 'success') {
          this.state.set({ kind: 'success', file: s.file, response: event.data });
          this.uploaded.emit(event.data);
        }
      },
      error: (err: HttpErrorResponse) => {
        this.state.set({
          kind: 'error',
          file: s.file,
          message: this.extractErrorMessage(err)
        });
      }
    });
  }

  private extractErrorMessage(err: HttpErrorResponse): string {
    if (err.status === 401)            return 'Tu dois être connecté pour téléverser un fichier.';
    if (err.status === 413)            return 'Le fichier dépasse la taille maximale autorisée (1 Go).';
    if (err.status === 415)            return 'Type de fichier non autorisé.';
    if (err.status === 0)              return 'Impossible de joindre le serveur.';
    return err.error?.message ?? 'Le téléversement a échoué.';
  }

  // ---------- Lien de téléchargement ----------

  protected async copyLink(): Promise<void> {
    const s = this.state();
    if (s.kind !== 'success') return;
    try {
      await navigator.clipboard.writeText(s.response.downloadUrl);
      this.copySuccess.set(true);
      setTimeout(() => this.copySuccess.set(false), 2000);
    } catch {
      // Fallback : sélectionner le texte (l'utilisateur peut Ctrl+C)
    }
  }

  // ---------- Helpers de template ----------

  protected formatSize(bytes: number): string {
    return this.fileService.formatSize(bytes);
  }

  /** Renvoie l'icône SVG appropriée selon l'extension. */
  protected fileIconClass(filename: string): 'image' | 'audio' | 'video' | 'doc' {
    const ext = this.fileService.extensionOf(filename) ?? '';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'heic'].includes(ext)) return 'image';
    if (['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext)) return 'audio';
    if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return 'video';
    return 'doc';
  }

  protected reset(): void {
    this.state.set({ kind: 'empty' });
    this.form.reset({ password: '', expiresInDays: 7 });
  }

  protected close(): void {
    this.closed.emit();
  }

  // Échap pour fermer
  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    this.close();
  }
}
