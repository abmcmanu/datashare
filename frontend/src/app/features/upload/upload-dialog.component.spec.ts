import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController
} from '@angular/common/http/testing';
import { HttpEventType } from '@angular/common/http';

import { UploadDialogComponent } from './upload-dialog.component';
import { ONE_GIGABYTE } from '../../core/files/file.service';
import { environment } from '../../../environments/environment';

describe('UploadDialogComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, UploadDialogComponent]
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function makeFile(name: string, size: number, type = 'application/octet-stream'): File {
    const f = new File(['x'], name, { type });
    Object.defineProperty(f, 'size', { value: size });
    return f;
  }

  function makeSuccessResponse() {
    return {
      id: '1',
      token: 'abc',
      downloadUrl: 'http://localhost/d/abc',
      originalFilename: 'photo.jpg',
      sizeBytes: 1024,
      mimeType: 'image/jpeg',
      passwordRequired: false,
      createdAt: new Date().toISOString(),
      expiresAt: new Date().toISOString()
    };
  }

  // ========== État initial ==========

  it("démarre dans l'état empty", () => {
    const fixture = TestBed.createComponent(UploadDialogComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;
    expect(cmp.state().kind).toBe('empty');
  });

  it('canSubmit est false dans l\'état empty', () => {
    const fixture = TestBed.createComponent(UploadDialogComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;
    expect(cmp.canSubmit()).toBeFalse();
  });

  // ========== Sélection de fichier — setFile / onFileChosen / onDrop ==========

  it("passe à 'selecting' avec clientError=null pour un fichier valide", () => {
    const fixture = TestBed.createComponent(UploadDialogComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;

    cmp['setFile'](makeFile('photo.jpg', 1024, 'image/jpeg'));
    expect(cmp.state().kind).toBe('selecting');
    expect(cmp.state().clientError).toBeNull();
    expect(cmp.canSubmit()).toBeTrue();
  });

  it("passe à 'selecting' avec une erreur TOO_LARGE pour un fichier > 1 Go", () => {
    const fixture = TestBed.createComponent(UploadDialogComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;

    cmp['setFile'](makeFile('big.bin', ONE_GIGABYTE + 1));
    expect(cmp.state().kind).toBe('selecting');
    expect(cmp.state().clientError?.code).toBe('TOO_LARGE');
    expect(cmp.canSubmit()).toBeFalse();
  });

  it("passe à 'selecting' avec FORBIDDEN_EXTENSION pour un .exe", () => {
    const fixture = TestBed.createComponent(UploadDialogComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;

    cmp['setFile'](makeFile('virus.exe', 1024));
    expect(cmp.state().clientError?.code).toBe('FORBIDDEN_EXTENSION');
    expect(cmp.canSubmit()).toBeFalse();
  });

  it("onFileChosen sans fichier ne change pas l'état", () => {
    const fixture = TestBed.createComponent(UploadDialogComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;

    const fakeEvent = { target: { files: null, value: '' } } as unknown as Event;
    cmp.onFileChosen(fakeEvent);
    expect(cmp.state().kind).toBe('empty');
  });

  it('onFileChosen avec un fichier valide passe à selecting', () => {
    const fixture = TestBed.createComponent(UploadDialogComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;

    const file = makeFile('doc.pdf', 2048, 'application/pdf');
    const fakeEvent = { target: { files: [file], value: '' } } as unknown as Event;
    cmp.onFileChosen(fakeEvent);
    expect(cmp.state().kind).toBe('selecting');
  });

  it('onDrop avec un fichier valide passe à selecting', () => {
    const fixture = TestBed.createComponent(UploadDialogComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;

    const file = makeFile('image.png', 512, 'image/png');
    const fakeEvent = {
      preventDefault: jasmine.createSpy('preventDefault'),
      dataTransfer: { files: [file] }
    } as unknown as DragEvent;
    cmp.onDrop(fakeEvent);
    expect(fakeEvent.preventDefault).toHaveBeenCalled();
    expect(cmp.state().kind).toBe('selecting');
  });

  it('onDrop sans fichier ne change pas l\'état', () => {
    const fixture = TestBed.createComponent(UploadDialogComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;

    const fakeEvent = {
      preventDefault: jasmine.createSpy('preventDefault'),
      dataTransfer: { files: [] }
    } as unknown as DragEvent;
    cmp.onDrop(fakeEvent);
    expect(cmp.state().kind).toBe('empty');
  });

  it('onDragOver appelle preventDefault', () => {
    const fixture = TestBed.createComponent(UploadDialogComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;

    const fakeEvent = { preventDefault: jasmine.createSpy('preventDefault') } as unknown as DragEvent;
    cmp.onDragOver(fakeEvent);
    expect(fakeEvent.preventDefault).toHaveBeenCalled();
  });

  // ========== openPicker ==========

  it("openPicker() simule un clic sur l'input file", () => {
    const fixture = TestBed.createComponent(UploadDialogComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;
    const clickSpy = spyOn(cmp.fileInput.nativeElement, 'click');
    cmp.openPicker();
    expect(clickSpy).toHaveBeenCalled();
  });

  // ========== close / reset / escape ==========

  it('close() émet l\'événement closed', () => {
    const fixture = TestBed.createComponent(UploadDialogComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;
    let closed = false;
    cmp.closed.subscribe(() => { closed = true; });
    cmp.close();
    expect(closed).toBeTrue();
  });

  it('onEscape() appelle close()', () => {
    const fixture = TestBed.createComponent(UploadDialogComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;
    const spy = spyOn(cmp, 'close');
    cmp.onEscape();
    expect(spy).toHaveBeenCalled();
  });

  it('reset() remet l\'état à empty et réinitialise le formulaire', () => {
    const fixture = TestBed.createComponent(UploadDialogComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;

    cmp['setFile'](makeFile('photo.jpg', 1024));
    cmp.form.patchValue({ password: 'secret', expiresInDays: 3 });
    cmp.reset();

    expect(cmp.state().kind).toBe('empty');
    expect(cmp.form.value.password).toBe('');
    expect(cmp.form.value.expiresInDays).toBe(7);
  });

  // ========== submit — guards ==========

  it("submit() est sans effet quand l'état n'est pas 'selecting'", () => {
    const fixture = TestBed.createComponent(UploadDialogComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;

    cmp.submit();
    httpMock.expectNone(`${environment.apiBaseUrl}/files`);
  });

  it('submit() est sans effet quand clientError est non nul', () => {
    const fixture = TestBed.createComponent(UploadDialogComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;

    cmp['setFile'](makeFile('big.bin', ONE_GIGABYTE + 1));
    cmp.submit();
    httpMock.expectNone(`${environment.apiBaseUrl}/files`);
  });

  it('submit() est sans effet quand le formulaire est invalide', () => {
    const fixture = TestBed.createComponent(UploadDialogComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;

    cmp['setFile'](makeFile('photo.jpg', 1024, 'image/jpeg'));
    cmp.form.patchValue({ expiresInDays: 99 }); // invalide (max=7)
    cmp.submit();
    httpMock.expectNone(`${environment.apiBaseUrl}/files`);
  });

  // ========== submit — succès ==========

  it("submit envoie le multipart, transitionne uploading → success", (done) => {
    const fixture = TestBed.createComponent(UploadDialogComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;

    cmp['setFile'](makeFile('photo.jpg', 1024, 'image/jpeg'));
    fixture.detectChanges();

    cmp.uploaded.subscribe((res: any) => {
      expect(res.token).toBe('abc');
      expect(cmp.state().kind).toBe('success');
      done();
    });

    cmp.submit();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/files`);
    expect(req.request.method).toBe('POST');

    req.flush(makeSuccessResponse());
  });

  it("submit avec mot de passe inclut le password dans le form", (done) => {
    const fixture = TestBed.createComponent(UploadDialogComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;

    cmp['setFile'](makeFile('photo.jpg', 1024, 'image/jpeg'));
    cmp.form.patchValue({ password: 'secret123' });
    fixture.detectChanges();

    cmp.uploaded.subscribe(() => done());
    cmp.submit();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/files`);
    const body = req.request.body as FormData;
    expect(body.get('password')).toBe('secret123');
    req.flush(makeSuccessResponse());
  });

  it("submit envoie un événement de progression", () => {
    const fixture = TestBed.createComponent(UploadDialogComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;

    cmp['setFile'](makeFile('photo.jpg', 1024, 'image/jpeg'));
    cmp.submit();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/files`);
    req.event({ type: HttpEventType.UploadProgress, loaded: 512, total: 1024 } as any);

    expect(cmp.state().kind).toBe('uploading');
    expect(cmp.state().ratio).toBeCloseTo(0.5, 5);

    req.flush(makeSuccessResponse());
  });

  // ========== submit — erreurs HTTP ==========

  it("traite l'erreur 413 du back avec un message lisible", () => {
    const fixture = TestBed.createComponent(UploadDialogComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;

    cmp['setFile'](makeFile('photo.jpg', 1024, 'image/jpeg'));
    cmp.submit();

    httpMock.expectOne(`${environment.apiBaseUrl}/files`)
      .flush({ message: 'too large' }, { status: 413, statusText: 'Payload Too Large' });

    expect(cmp.state().kind).toBe('error');
    expect(cmp.state().message).toContain('1 Go');
  });

  it("traite l'erreur 401 avec un message connecté", () => {
    const fixture = TestBed.createComponent(UploadDialogComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;

    cmp['setFile'](makeFile('photo.jpg', 1024, 'image/jpeg'));
    cmp.submit();

    httpMock.expectOne(`${environment.apiBaseUrl}/files`)
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(cmp.state().kind).toBe('error');
    expect(cmp.state().message).toContain('connecté');
  });

  it("traite l'erreur 415 avec un message type non autorisé", () => {
    const fixture = TestBed.createComponent(UploadDialogComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;

    cmp['setFile'](makeFile('photo.jpg', 1024, 'image/jpeg'));
    cmp.submit();

    httpMock.expectOne(`${environment.apiBaseUrl}/files`)
      .flush({}, { status: 415, statusText: 'Unsupported Media Type' });

    expect(cmp.state().kind).toBe('error');
    expect(cmp.state().message).toContain('non autorisé');
  });

  it("traite l'erreur status=0 (réseau) avec message serveur injoignable", () => {
    const fixture = TestBed.createComponent(UploadDialogComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;

    cmp['setFile'](makeFile('photo.jpg', 1024, 'image/jpeg'));
    cmp.submit();

    httpMock.expectOne(`${environment.apiBaseUrl}/files`).error(new ProgressEvent('error'));

    expect(cmp.state().kind).toBe('error');
    expect(cmp.state().message).toContain('serveur');
  });

  it("traite une erreur inconnue avec le message de l'API", () => {
    const fixture = TestBed.createComponent(UploadDialogComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;

    cmp['setFile'](makeFile('photo.jpg', 1024, 'image/jpeg'));
    cmp.submit();

    httpMock.expectOne(`${environment.apiBaseUrl}/files`)
      .flush({ message: 'Quota dépassé' }, { status: 429, statusText: 'Too Many Requests' });

    expect(cmp.state().kind).toBe('error');
    expect(cmp.state().message).toBe('Quota dépassé');
  });

  it("traite une erreur sans message avec le message générique", () => {
    const fixture = TestBed.createComponent(UploadDialogComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;

    cmp['setFile'](makeFile('photo.jpg', 1024, 'image/jpeg'));
    cmp.submit();

    httpMock.expectOne(`${environment.apiBaseUrl}/files`)
      .flush(null, { status: 500, statusText: 'Internal Server Error' });

    expect(cmp.state().kind).toBe('error');
    expect(cmp.state().message).toBe('Le téléversement a échoué.');
  });

  // ========== fileIconClass ==========

  it('fileIconClass retourne image pour jpg / png / gif / webp / svg / bmp / heic', () => {
    const fixture = TestBed.createComponent(UploadDialogComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;
    expect(cmp.fileIconClass('photo.jpg')).toBe('image');
    expect(cmp.fileIconClass('image.png')).toBe('image');
    expect(cmp.fileIconClass('anim.gif')).toBe('image');
    expect(cmp.fileIconClass('img.webp')).toBe('image');
    expect(cmp.fileIconClass('logo.svg')).toBe('image');
    expect(cmp.fileIconClass('bmp.bmp')).toBe('image');
    expect(cmp.fileIconClass('photo.heic')).toBe('image');
    expect(cmp.fileIconClass('photo.jpeg')).toBe('image');
  });

  it('fileIconClass retourne audio pour mp3 / wav / ogg / m4a / aac / flac', () => {
    const fixture = TestBed.createComponent(UploadDialogComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;
    expect(cmp.fileIconClass('song.mp3')).toBe('audio');
    expect(cmp.fileIconClass('sound.wav')).toBe('audio');
    expect(cmp.fileIconClass('audio.ogg')).toBe('audio');
    expect(cmp.fileIconClass('track.m4a')).toBe('audio');
    expect(cmp.fileIconClass('music.aac')).toBe('audio');
    expect(cmp.fileIconClass('lossless.flac')).toBe('audio');
  });

  it('fileIconClass retourne video pour mp4 / mov / avi / mkv / webm', () => {
    const fixture = TestBed.createComponent(UploadDialogComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;
    expect(cmp.fileIconClass('video.mp4')).toBe('video');
    expect(cmp.fileIconClass('clip.mov')).toBe('video');
    expect(cmp.fileIconClass('film.avi')).toBe('video');
    expect(cmp.fileIconClass('movie.mkv')).toBe('video');
    expect(cmp.fileIconClass('stream.webm')).toBe('video');
  });

  it('fileIconClass retourne doc pour les autres extensions', () => {
    const fixture = TestBed.createComponent(UploadDialogComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;
    expect(cmp.fileIconClass('document.pdf')).toBe('doc');
    expect(cmp.fileIconClass('archive.zip')).toBe('doc');
    expect(cmp.fileIconClass('text.txt')).toBe('doc');
    expect(cmp.fileIconClass('noextension')).toBe('doc');
  });

  // ========== copyLink ==========

  it('copyLink() est sans effet si l\'état n\'est pas success', fakeAsync(() => {
    const fixture = TestBed.createComponent(UploadDialogComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;
    // état empty, ne doit pas lever d'erreur
    cmp.copyLink();
    tick();
    expect(cmp.copySuccess()).toBeFalse();
  }));

  it('copyLink() copie le lien et passe copySuccess à true', fakeAsync(() => {
    const fixture = TestBed.createComponent(UploadDialogComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;

    const mockClipboard = { writeText: jasmine.createSpy('writeText').and.returnValue(Promise.resolve()) };
    Object.defineProperty(navigator, 'clipboard', { value: mockClipboard, configurable: true });

    cmp.state.set({
      kind: 'success',
      file: makeFile('photo.jpg', 1024),
      response: makeSuccessResponse()
    });

    cmp.copyLink();
    tick();

    expect(mockClipboard.writeText).toHaveBeenCalledWith('http://localhost/d/abc');
    expect(cmp.copySuccess()).toBeTrue();

    tick(2000);
    expect(cmp.copySuccess()).toBeFalse();
  }));

  it('copyLink() gère l\'échec du clipboard sans erreur (fallback silencieux)', fakeAsync(() => {
    const fixture = TestBed.createComponent(UploadDialogComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;

    const mockClipboard = { writeText: jasmine.createSpy('writeText').and.returnValue(Promise.reject(new Error('denied'))) };
    Object.defineProperty(navigator, 'clipboard', { value: mockClipboard, configurable: true });

    cmp.state.set({
      kind: 'success',
      file: makeFile('photo.jpg', 1024),
      response: makeSuccessResponse()
    });

    cmp.copyLink();
    tick();
    expect(cmp.copySuccess()).toBeFalse();
  }));

  // ========== formatSize (proxy) ==========

  it('formatSize délègue à FileService', () => {
    const fixture = TestBed.createComponent(UploadDialogComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;
    expect(cmp.formatSize(1024)).toBe('1 Ko');
    expect(cmp.formatSize(0)).toBe('0 o');
  });

  // ========== computed sel / up / ok / err ==========

  it('les computed sel/up/ok/err renvoient null si l\'état ne correspond pas', () => {
    const fixture = TestBed.createComponent(UploadDialogComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;

    // état empty → tout null
    expect(cmp.sel()).toBeNull();
    expect(cmp.up()).toBeNull();
    expect(cmp.ok()).toBeNull();
    expect(cmp.err()).toBeNull();
  });

  it('le computed up() renvoie l\'état uploading', () => {
    const fixture = TestBed.createComponent(UploadDialogComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;

    cmp.state.set({ kind: 'uploading', file: makeFile('f.txt', 1), ratio: 0.4 });
    expect(cmp.up()).not.toBeNull();
    expect(cmp.up().ratio).toBeCloseTo(0.4);
    expect(cmp.sel()).toBeNull();
    expect(cmp.ok()).toBeNull();
    expect(cmp.err()).toBeNull();
  });

  it('le computed err() renvoie l\'état error', () => {
    const fixture = TestBed.createComponent(UploadDialogComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;

    cmp.state.set({ kind: 'error', file: makeFile('f.txt', 1), message: 'Oops' });
    expect(cmp.err()).not.toBeNull();
    expect(cmp.err().message).toBe('Oops');
  });
});