import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController
} from '@angular/common/http/testing';

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

  it("démarre dans l'état empty", () => {
    const fixture = TestBed.createComponent(UploadDialogComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;
    expect(cmp.state().kind).toBe('empty');
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

    req.flush({
      id: '1',
      token: 'abc',
      downloadUrl: 'http://localhost/d/abc',
      originalFilename: 'photo.jpg',
      sizeBytes: 1024,
      mimeType: 'image/jpeg',
      passwordRequired: false,
      createdAt: new Date().toISOString(),
      expiresAt: new Date().toISOString()
    });
  });

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
});
