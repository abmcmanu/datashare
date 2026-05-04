import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController
} from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';

import { LoginComponent } from './login.component';
import { environment } from '../../../../environments/environment';

describe('LoginComponent', () => {
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, LoginComponent],
      providers: [provideRouter([])]
    });
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));
  });

  afterEach(() => httpMock.verify());

  it('formulaire invalide => submit ne declenche aucun appel HTTP', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;

    cmp.submit();
    httpMock.expectNone(`${environment.apiBaseUrl}/auth/login`);
    expect(cmp.form.invalid).toBeTrue();
  });

  it('formulaire valide => POST /auth/login + navigate(/dashboard)', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;

    cmp.form.setValue({ email: 'claire@example.com', password: 'S3cret!1234' });
    cmp.submit();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/login`);
    expect(req.request.method).toBe('POST');
    req.flush({
      accessToken: 'tok',
      tokenType: 'Bearer',
      expiresIn: 900,
      user: { id: '1', email: 'claire@example.com', createdAt: new Date().toISOString() }
    });

    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it('401 => message erreur invalide', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;

    cmp.form.setValue({ email: 'claire@example.com', password: 'wrong' });
    cmp.submit();

    httpMock.expectOne(`${environment.apiBaseUrl}/auth/login`).flush(
      { code: 'INVALID_CREDENTIALS' },
      { status: 401, statusText: 'Unauthorized' }
    );

    expect(cmp.errorMessage()).toBe('Email ou mot de passe invalide.');
  });

  it('status 0 => message serveur injoignable', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;

    cmp.form.setValue({ email: 'claire@example.com', password: 'S3cret!1234' });
    cmp.submit();

    httpMock.expectOne(`${environment.apiBaseUrl}/auth/login`).error(new ProgressEvent('error'));

    expect(cmp.errorMessage()).toBe('Impossible de joindre le serveur.');
  });

  it('500 => message erreur generique du serveur', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;

    cmp.form.setValue({ email: 'claire@example.com', password: 'S3cret!1234' });
    cmp.submit();

    httpMock.expectOne(`${environment.apiBaseUrl}/auth/login`).flush(
      { message: 'Erreur interne' },
      { status: 500, statusText: 'Internal Server Error' }
    );

    expect(cmp.errorMessage()).toBe('Erreur interne');
  });
});