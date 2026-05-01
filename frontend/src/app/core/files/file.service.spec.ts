import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController
} from '@angular/common/http/testing';

import { FileService, ONE_GIGABYTE } from './file.service';
import { environment } from '../../../environments/environment';

describe('FileService', () => {
  let service: FileService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [FileService]
    });
    service = TestBed.inject(FileService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  // ---------- validate ----------

  it('refuse un fichier vide', () => {
    const file = new File([], 'empty.txt', { type: 'text/plain' });
    expect(service.validate(file)?.code).toBe('EMPTY');
  });

  it('refuse un fichier > 1 Go avec le message exact de la maquette', () => {
    // simulate >1Go without allocating memory
    const file = new File(['x'], 'big.bin', { type: 'application/octet-stream' });
    Object.defineProperty(file, 'size', { value: ONE_GIGABYTE + 1 });
    const err = service.validate(file);
    expect(err?.code).toBe('TOO_LARGE');
    expect(err?.message).toBe('La taille des fichiers est limitée à 1 Go');
  });

  it('refuse une extension interdite (exe)', () => {
    const file = new File(['x'], 'virus.exe', { type: 'application/octet-stream' });
    Object.defineProperty(file, 'size', { value: 1024 });
    const err = service.validate(file);
    expect(err?.code).toBe('FORBIDDEN_EXTENSION');
  });

  it('accepte un fichier valide', () => {
    const file = new File(['hello'], 'photo.jpg', { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: 5 });
    expect(service.validate(file)).toBeNull();
  });

  // ---------- formatSize ----------

  it('formate les tailles en Mo / Go avec virgule française', () => {
    expect(service.formatSize(0)).toBe('0 o');
    expect(service.formatSize(1024)).toBe('1 Ko');
    expect(service.formatSize(2_650_000)).toMatch(/Mo$/);
    expect(service.formatSize(1_073_741_824)).toMatch(/Go$/);
  });

  // ---------- upload ----------

  it("envoie un POST multipart vers /files avec password et expiresInDays", (done) => {
    const file = new File(['hello'], 'photo.jpg', { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: 5 });

    service.upload(file, 3, 'secret123').subscribe({
      next: (event) => {
        if (event.kind === 'success') {
          expect(event.data.token).toBe('tok');
          done();
        }
      }
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/files`);
    expect(req.request.method).toBe('POST');
    const body = req.request.body as FormData;
    expect(body.get('expiresInDays')).toBe('3');
    expect(body.get('password')).toBe('secret123');
    expect(body.get('file')).toBeTruthy();

    req.flush({
      id: 'uuid-1',
      token: 'tok',
      downloadUrl: 'http://localhost/d/tok',
      originalFilename: 'photo.jpg',
      sizeBytes: 5,
      mimeType: 'image/jpeg',
      passwordRequired: true,
      createdAt: new Date().toISOString(),
      expiresAt: new Date().toISOString()
    });
  });
});
