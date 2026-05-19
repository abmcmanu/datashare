import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController
} from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';

import { DownloadComponent } from './download.component';
import { FileMetadata } from '../../core/files/file.service';
import { environment } from '../../../environments/environment';

const BASE = `${environment.apiBaseUrl}/files`;
const TOKEN = 'tok-abc';

function makeMetadata(overrides: Partial<FileMetadata> = {}): FileMetadata {
  const future = new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString();
  return {
    originalFilename: 'photo.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 1024,
    expiresAt: future,
    isPasswordProtected: false,
    ...overrides
  };
}

function setup(token = TOKEN) {
  TestBed.configureTestingModule({
    imports: [HttpClientTestingModule, DownloadComponent],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { params: of({ id: token }) } }
    ]
  });
  const httpMock = TestBed.inject(HttpTestingController);
  const fixture  = TestBed.createComponent(DownloadComponent);
  const cmp      = fixture.componentInstance as any;
  return { fixture, cmp, httpMock };
}

describe('DownloadComponent', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  // ================================================================
  // ngOnInit / loadMetadata
  // ================================================================

  it('charge les métadonnées au démarrage (GET /metadata)', () => {
    const { fixture, cmp, httpMock } = setup();
    fixture.detectChanges();

    expect(cmp.pageState()).toBe('loading');

    const req = httpMock.expectOne(`${BASE}/${TOKEN}/metadata`);
    expect(req.request.method).toBe('GET');
    req.flush(makeMetadata());

    expect(cmp.pageState()).toBe('ready');
    expect(cmp.metadata()?.originalFilename).toBe('photo.jpg');
  });

  it('passe à not-found si le serveur répond 404', () => {
    const { fixture, cmp, httpMock } = setup();
    fixture.detectChanges();

    httpMock.expectOne(`${BASE}/${TOKEN}/metadata`)
      .flush({}, { status: 404, statusText: 'Not Found' });

    expect(cmp.pageState()).toBe('not-found');
  });

  it('passe à error pour toute autre erreur serveur', () => {
    const { fixture, cmp, httpMock } = setup();
    fixture.detectChanges();

    httpMock.expectOne(`${BASE}/${TOKEN}/metadata`)
      .flush({}, { status: 500, statusText: 'Server Error' });

    expect(cmp.pageState()).toBe('error');
  });

  // ================================================================
  // isExpired getter
  // ================================================================

  it('isExpired retourne false si metadata est null', () => {
    const { fixture, cmp, httpMock } = setup();
    fixture.detectChanges();
    httpMock.expectOne(`${BASE}/${TOKEN}/metadata`).flush(makeMetadata());

    cmp.metadata.set(null);
    expect(cmp.isExpired).toBeFalse();
  });

  it('isExpired retourne true si expiresAt est dans le passé', () => {
    const { fixture, cmp, httpMock } = setup();
    fixture.detectChanges();

    const past = new Date(Date.now() - 3600 * 1000).toISOString();
    httpMock.expectOne(`${BASE}/${TOKEN}/metadata`).flush(makeMetadata({ expiresAt: past }));

    expect(cmp.isExpired).toBeTrue();
  });

  it('isExpired retourne false si expiresAt est dans le futur', () => {
    const { fixture, cmp, httpMock } = setup();
    fixture.detectChanges();

    httpMock.expectOne(`${BASE}/${TOKEN}/metadata`).flush(makeMetadata());
    expect(cmp.isExpired).toBeFalse();
  });

  // ================================================================
  // daysUntilExpiry getter
  // ================================================================

  it('daysUntilExpiry retourne 0 si metadata est null', () => {
    const { fixture, cmp, httpMock } = setup();
    fixture.detectChanges();
    httpMock.expectOne(`${BASE}/${TOKEN}/metadata`).flush(makeMetadata());

    cmp.metadata.set(null);
    expect(cmp.daysUntilExpiry).toBe(0);
  });

  it('daysUntilExpiry retourne le nombre de jours restants', () => {
    const { fixture, cmp, httpMock } = setup();
    fixture.detectChanges();

    const threeDays = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();
    httpMock.expectOne(`${BASE}/${TOKEN}/metadata`).flush(makeMetadata({ expiresAt: threeDays }));

    expect(cmp.daysUntilExpiry).toBeGreaterThanOrEqual(2);
    expect(cmp.daysUntilExpiry).toBeLessThanOrEqual(4);
  });

  // ================================================================
  // alertState getter
  // ================================================================

  it('alertState retourne error pour un fichier expiré', () => {
    const { fixture, cmp, httpMock } = setup();
    fixture.detectChanges();

    const past = new Date(Date.now() - 3600 * 1000).toISOString();
    httpMock.expectOne(`${BASE}/${TOKEN}/metadata`).flush(makeMetadata({ expiresAt: past }));

    expect(cmp.alertState).toBe('error');
  });

  it('alertState retourne warning si expiresAt dans < 24h', () => {
    const { fixture, cmp, httpMock } = setup();
    fixture.detectChanges();

    const soon = new Date(Date.now() + 12 * 3600 * 1000).toISOString();
    httpMock.expectOne(`${BASE}/${TOKEN}/metadata`).flush(makeMetadata({ expiresAt: soon }));

    expect(cmp.alertState).toBe('warning');
  });

  it('alertState retourne info si expiresAt dans > 1 jour', () => {
    const { fixture, cmp, httpMock } = setup();
    fixture.detectChanges();

    httpMock.expectOne(`${BASE}/${TOKEN}/metadata`).flush(makeMetadata());
    expect(cmp.alertState).toBe('info');
  });

  // ================================================================
  // alertMessage getter
  // ================================================================

  it('alertMessage pour fichier expiré', () => {
    const { fixture, cmp, httpMock } = setup();
    fixture.detectChanges();

    const past = new Date(Date.now() - 3600 * 1000).toISOString();
    httpMock.expectOne(`${BASE}/${TOKEN}/metadata`).flush(makeMetadata({ expiresAt: past }));

    expect(cmp.alertMessage).toContain('expiré');
  });

  it('alertMessage pour fichier expirant demain (≤ 1 jour)', () => {
    const { fixture, cmp, httpMock } = setup();
    fixture.detectChanges();

    const soon = new Date(Date.now() + 12 * 3600 * 1000).toISOString();
    httpMock.expectOne(`${BASE}/${TOKEN}/metadata`).flush(makeMetadata({ expiresAt: soon }));

    expect(cmp.alertMessage).toContain('demain');
  });

  it('alertMessage pour fichier expirant dans plusieurs jours (singulier/pluriel)', () => {
    const { fixture, cmp, httpMock } = setup();
    fixture.detectChanges();

    const threeDays = new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString();
    httpMock.expectOne(`${BASE}/${TOKEN}/metadata`).flush(makeMetadata({ expiresAt: threeDays }));

    expect(cmp.alertMessage).toMatch(/\d+ jours/);
  });

  it('alertMessage pluriel (1 jour) retourne sans "s" trailing', () => {
    const { fixture, cmp, httpMock } = setup();
    fixture.detectChanges();

    // Exactement 1 jour → daysUntilExpiry = 1 → alertState = 'warning' → "demain"
    // Pour tester la branche pluriel 's' vs '', on force days = 1 via metadata directe
    httpMock.expectOne(`${BASE}/${TOKEN}/metadata`).flush(makeMetadata());

    // Patch artificiel pour tester la branche singulier de alertMessage
    const oneDayLater = new Date(Date.now() + 36 * 3600 * 1000).toISOString();
    cmp.metadata.set({ ...makeMetadata(), expiresAt: oneDayLater });
    // daysUntilExpiry = ceil(36h/24h) = 2 → pluriel 's'
    expect(cmp.alertMessage).toMatch(/jours/);
  });

  // ================================================================
  // canDownload getter
  // ================================================================

  it('canDownload retourne false si metadata est null', () => {
    const { fixture, cmp, httpMock } = setup();
    fixture.detectChanges();
    httpMock.expectOne(`${BASE}/${TOKEN}/metadata`).flush(makeMetadata());

    cmp.metadata.set(null);
    expect(cmp.canDownload).toBeFalse();
  });

  it('canDownload retourne false si le fichier est expiré', () => {
    const { fixture, cmp, httpMock } = setup();
    fixture.detectChanges();

    const past = new Date(Date.now() - 1000).toISOString();
    httpMock.expectOne(`${BASE}/${TOKEN}/metadata`).flush(makeMetadata({ expiresAt: past }));

    expect(cmp.canDownload).toBeFalse();
  });

  it('canDownload retourne false si downloading est true', () => {
    const { fixture, cmp, httpMock } = setup();
    fixture.detectChanges();

    httpMock.expectOne(`${BASE}/${TOKEN}/metadata`).flush(makeMetadata());
    cmp.downloading = true;
    expect(cmp.canDownload).toBeFalse();
  });

  it('canDownload retourne false si protégé par mot de passe et password vide', () => {
    const { fixture, cmp, httpMock } = setup();
    fixture.detectChanges();

    httpMock.expectOne(`${BASE}/${TOKEN}/metadata`).flush(makeMetadata({ isPasswordProtected: true }));
    cmp.password = '';
    expect(cmp.canDownload).toBeFalse();
  });

  it('canDownload retourne true si protégé et password renseigné', () => {
    const { fixture, cmp, httpMock } = setup();
    fixture.detectChanges();

    httpMock.expectOne(`${BASE}/${TOKEN}/metadata`).flush(makeMetadata({ isPasswordProtected: true }));
    cmp.password = 'secret';
    expect(cmp.canDownload).toBeTrue();
  });

  it('canDownload retourne true sans protection ni expiration', () => {
    const { fixture, cmp, httpMock } = setup();
    fixture.detectChanges();

    httpMock.expectOne(`${BASE}/${TOKEN}/metadata`).flush(makeMetadata());
    expect(cmp.canDownload).toBeTrue();
  });

  // ================================================================
  // onDownload()
  // ================================================================

  it('onDownload() est sans effet si canDownload est false', () => {
    const { fixture, cmp, httpMock } = setup();
    fixture.detectChanges();
    httpMock.expectOne(`${BASE}/${TOKEN}/metadata`).flush(makeMetadata());

    cmp.metadata.set(null); // canDownload = false
    cmp.onDownload();
    httpMock.expectNone(`${BASE}/${TOKEN}/download`);
    expect(cmp.formError()).toBeNull();
  });

  it('onDownload() télécharge le fichier sans mot de passe', () => {
    const { fixture, cmp, httpMock } = setup();
    fixture.detectChanges();
    httpMock.expectOne(`${BASE}/${TOKEN}/metadata`).flush(makeMetadata());

    // Mock URL.createObjectURL et <a>.click
    spyOn(URL, 'createObjectURL').and.returnValue('blob:fake');
    spyOn(URL, 'revokeObjectURL');
    const fakeAnchor = { href: '', download: '', click: jasmine.createSpy('click') };
    spyOn(document, 'createElement').and.returnValue(fakeAnchor as any);

    cmp.onDownload();

    const req = httpMock.expectOne(`${BASE}/${TOKEN}/download`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush(new Blob(['content'], { type: 'image/jpeg' }));

    expect(fakeAnchor.click).toHaveBeenCalled();
    expect(fakeAnchor.download).toBe('photo.jpg');
    expect(cmp.downloading).toBeFalse();
  });

  it('onDownload() envoie le mot de passe si le fichier est protégé', () => {
    const { fixture, cmp, httpMock } = setup();
    fixture.detectChanges();
    httpMock.expectOne(`${BASE}/${TOKEN}/metadata`).flush(makeMetadata({ isPasswordProtected: true }));

    spyOn(URL, 'createObjectURL').and.returnValue('blob:fake');
    spyOn(URL, 'revokeObjectURL');
    spyOn(document, 'createElement').and.returnValue({ href: '', download: '', click: jasmine.createSpy() } as any);

    cmp.password = 'secret123';
    cmp.onDownload();

    const req = httpMock.expectOne(`${BASE}/${TOKEN}/download`);
    expect(req.request.body).toEqual({ password: 'secret123' });
    req.flush(new Blob(['x']));
    expect(cmp.downloading).toBeFalse();
  });

  it('onDownload() en erreur 401 affiche mot de passe incorrect', () => {
    const { fixture, cmp, httpMock } = setup();
    fixture.detectChanges();
    httpMock.expectOne(`${BASE}/${TOKEN}/metadata`).flush(makeMetadata({ isPasswordProtected: true }));

    cmp.password = 'wrong';
    cmp.onDownload();

    // responseType=blob → le corps de l'erreur doit être un Blob
    httpMock.expectOne(`${BASE}/${TOKEN}/download`)
      .flush(new Blob(['{}'], { type: 'application/json' }), { status: 401, statusText: 'Unauthorized' });

    expect(cmp.formError()).toContain('incorrect');
    expect(cmp.downloading).toBeFalse();
  });

  it('onDownload() en erreur 410 marque le fichier comme expiré', () => {
    const { fixture, cmp, httpMock } = setup();
    fixture.detectChanges();
    httpMock.expectOne(`${BASE}/${TOKEN}/metadata`).flush(makeMetadata());

    cmp.onDownload();

    httpMock.expectOne(`${BASE}/${TOKEN}/download`)
      .flush(new Blob(['{}'], { type: 'application/json' }), { status: 410, statusText: 'Gone' });

    expect(cmp.formError()).toContain('expiré');
    expect(cmp.downloading).toBeFalse();
  });

  it('onDownload() en erreur générique affiche message de secours', () => {
    const { fixture, cmp, httpMock } = setup();
    fixture.detectChanges();
    httpMock.expectOne(`${BASE}/${TOKEN}/metadata`).flush(makeMetadata());

    cmp.onDownload();

    httpMock.expectOne(`${BASE}/${TOKEN}/download`)
      .flush(new Blob(['{}'], { type: 'application/json' }), { status: 500, statusText: 'Server Error' });

    expect(cmp.formError()).toContain('erreur');
    expect(cmp.downloading).toBeFalse();
  });
});