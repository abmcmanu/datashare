import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController
} from '@angular/common/http/testing';
import { HttpEventType } from '@angular/common/http';

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

  // ================================================================
  // validate()
  // ================================================================

  it('refuse un fichier vide (size=0)', () => {
    const file = new File([], 'empty.txt', { type: 'text/plain' });
    expect(service.validate(file)?.code).toBe('EMPTY');
  });

  it('refuse un fichier > 1 Go avec le message exact de la maquette', () => {
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
    expect(err?.message).toContain('.exe');
  });

  it('refuse les autres extensions interdites (bat, cmd, sh, ps1)', () => {
    for (const ext of ['bat', 'cmd', 'sh', 'ps1', 'vbs', 'com', 'msi', 'scr']) {
      const file = new File(['x'], `file.${ext}`, { type: 'application/octet-stream' });
      Object.defineProperty(file, 'size', { value: 1024 });
      expect(service.validate(file)?.code).toBe('FORBIDDEN_EXTENSION', `extension .${ext} devrait être refusée`);
    }
  });

  it('accepte un fichier valide (jpg, 5 octets)', () => {
    const file = new File(['hello'], 'photo.jpg', { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: 5 });
    expect(service.validate(file)).toBeNull();
  });

  it('accepte un fichier sans extension (pas de point)', () => {
    const file = new File(['data'], 'makefile', { type: 'text/plain' });
    Object.defineProperty(file, 'size', { value: 4 });
    expect(service.validate(file)).toBeNull();
  });

  it('accepte un fichier de taille exactement 1 Go', () => {
    const file = new File(['x'], 'exact.bin');
    Object.defineProperty(file, 'size', { value: ONE_GIGABYTE });
    expect(service.validate(file)).toBeNull();
  });

  // ================================================================
  // extensionOf()
  // ================================================================

  it('extensionOf retourne null pour un fichier sans point', () => {
    expect(service.extensionOf('makefile')).toBeNull();
  });

  it('extensionOf retourne null pour un fichier caché (.hidden)', () => {
    expect(service.extensionOf('.hidden')).toBeNull();
  });

  it('extensionOf retourne null pour un fichier se terminant par un point', () => {
    expect(service.extensionOf('file.')).toBeNull();
  });

  it('extensionOf retourne l\'extension en minuscules', () => {
    expect(service.extensionOf('Photo.JPG')).toBe('jpg');
    expect(service.extensionOf('archive.tar.gz')).toBe('gz');
    expect(service.extensionOf('doc.PDF')).toBe('pdf');
  });

  // ================================================================
  // formatSize()
  // ================================================================

  it('formate 0 octet', () => {
    expect(service.formatSize(0)).toBe('0 o');
  });

  it('formate les octets (< 1024)', () => {
    expect(service.formatSize(1)).toBe('1 o');
    expect(service.formatSize(1023)).toBe('1023 o');
  });

  it('formate en Ko (exactement 1024)', () => {
    expect(service.formatSize(1024)).toBe('1 Ko');
  });

  it('formate en Mo avec virgule française', () => {
    expect(service.formatSize(2_650_000)).toMatch(/Mo$/);
    expect(service.formatSize(2_650_000)).toContain(',');
  });

  it('formate en Go', () => {
    expect(service.formatSize(ONE_GIGABYTE)).toMatch(/Go$/);
  });

  it('formate en To', () => {
    expect(service.formatSize(ONE_GIGABYTE * 1024)).toMatch(/To$/);
  });

  it('formate les valeurs >= 10 sans décimale', () => {
    // 10 Mo = 10 * 1024 * 1024
    expect(service.formatSize(10 * 1024 * 1024)).toBe('10 Mo');
  });

  // ================================================================
  // upload()
  // ================================================================

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

  it("n'inclut pas le champ password si le password est vide", () => {
    const file = new File(['hello'], 'photo.jpg', { type: 'image/jpeg' });
    Object.defineProperty(file, 'size', { value: 5 });

    service.upload(file, 7, '').subscribe();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/files`);
    const body = req.request.body as FormData;
    expect(body.get('password')).toBeNull();

    req.flush({
      id: 'uuid-2', token: 'tok2', downloadUrl: '', originalFilename: 'photo.jpg',
      sizeBytes: 5, mimeType: 'image/jpeg', passwordRequired: false,
      createdAt: new Date().toISOString(), expiresAt: new Date().toISOString()
    });
  });

  it("émet les événements de progression", (done) => {
    const file = new File(['data'], 'data.bin');
    Object.defineProperty(file, 'size', { value: 1024 });

    const events: any[] = [];
    service.upload(file).subscribe({
      next: (e) => events.push(e),
      complete: () => {
        const progress = events.find(e => e.kind === 'progress');
        expect(progress).toBeTruthy();
        expect(progress.loaded).toBe(512);
        expect(progress.total).toBe(1024);
        expect(progress.ratio).toBeCloseTo(0.5, 5);
        done();
      }
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/files`);
    req.event({ type: HttpEventType.UploadProgress, loaded: 512, total: 1024 } as any);
    req.flush({
      id: '3', token: 'tok3', downloadUrl: '', originalFilename: 'data.bin',
      sizeBytes: 1024, mimeType: 'application/octet-stream', passwordRequired: false,
      createdAt: new Date().toISOString(), expiresAt: new Date().toISOString()
    });
  });

  it("utilise file.size comme total si event.total est absent", (done) => {
    const file = new File(['data'], 'data.bin');
    Object.defineProperty(file, 'size', { value: 2048 });

    const events: any[] = [];
    service.upload(file).subscribe({
      next: (e) => events.push(e),
      complete: () => {
        const progress = events.find(e => e.kind === 'progress');
        expect(progress.total).toBe(2048);
        done();
      }
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/files`);
    req.event({ type: HttpEventType.UploadProgress, loaded: 1024 } as any); // total absent
    req.flush({
      id: '4', token: 'tok4', downloadUrl: '', originalFilename: 'data.bin',
      sizeBytes: 2048, mimeType: 'application/octet-stream', passwordRequired: false,
      createdAt: new Date().toISOString(), expiresAt: new Date().toISOString()
    });
  });

  it("propage les erreurs HTTP de l'upload", (done) => {
    const file = new File(['x'], 'bad.txt');
    Object.defineProperty(file, 'size', { value: 1 });

    service.upload(file).subscribe({
      error: (err) => {
        expect(err.status).toBe(413);
        done();
      }
    });

    httpMock.expectOne(`${environment.apiBaseUrl}/files`)
      .flush({}, { status: 413, statusText: 'Too Large' });
  });

  // ================================================================
  // getMetadata()
  // ================================================================

  it('getMetadata() envoie un GET vers /files/:token/metadata', () => {
    let result: any;
    service.getMetadata('abc123').subscribe(r => { result = r; });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/files/abc123/metadata`);
    expect(req.request.method).toBe('GET');
    req.flush({
      originalFilename: 'photo.jpg',
      mimeType: 'image/jpeg',
      sizeBytes: 1024,
      expiresAt: new Date().toISOString(),
      isPasswordProtected: false
    });

    expect(result.originalFilename).toBe('photo.jpg');
    expect(result.isPasswordProtected).toBeFalse();
  });

  // ================================================================
  // downloadFile()
  // ================================================================

  it('downloadFile() envoie un POST vers /files/:token/download sans password', () => {
    let blob: Blob | undefined;
    service.downloadFile('abc123').subscribe(b => { blob = b; });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/files/abc123/download`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush(new Blob(['content']));
    expect(blob).toBeTruthy();
  });

  it('downloadFile() inclut le password si fourni', () => {
    service.downloadFile('abc123', 'secret').subscribe();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/files/abc123/download`);
    expect(req.request.body).toEqual({ password: 'secret' });
    req.flush(new Blob(['content']));
  });

  // ================================================================
  // listFiles()
  // ================================================================

  it('listFiles() envoie un GET vers /files et retourne la liste', () => {
    let files: any[] = [];
    service.listFiles().subscribe(f => { files = f; });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/files`);
    expect(req.request.method).toBe('GET');
    req.flush([
      { id: '1', token: 't1', originalFilename: 'a.pdf', mimeType: 'application/pdf',
        sizeBytes: 100, passwordRequired: false, createdAt: '', expiresAt: '', expired: false, tags: [] }
    ]);

    expect(files.length).toBe(1);
    expect(files[0].id).toBe('1');
  });

  // ================================================================
  // deleteFile()
  // ================================================================

  it('deleteFile() envoie un DELETE vers /files/:id', () => {
    let called = false;
    service.deleteFile('uuid-1').subscribe(() => { called = true; });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/files/uuid-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null);
    expect(called).toBeTrue();
  });

  // ================================================================
  // addTag()
  // ================================================================

  it('addTag() envoie un POST vers /files/:id/tags et retourne les tags', () => {
    let tags: string[] = [];
    service.addTag('uuid-1', 'important').subscribe(t => { tags = t; });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/files/uuid-1/tags`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ label: 'important' });
    req.flush(['important', 'urgent']);
    expect(tags).toEqual(['important', 'urgent']);
  });

  // ================================================================
  // removeTag()
  // ================================================================

  it('removeTag() envoie un DELETE vers /files/:id/tags/:label encodé', () => {
    let tags: string[] = [];
    service.removeTag('uuid-1', 'mon tag').subscribe(t => { tags = t; });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/files/uuid-1/tags/mon%20tag`);
    expect(req.request.method).toBe('DELETE');
    req.flush(['urgent']);
    expect(tags).toEqual(['urgent']);
  });
});