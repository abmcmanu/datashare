import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController
} from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';

import { SignupComponent } from './signup.component';
import { environment } from '../../../../environments/environment';

describe('SignupComponent', () => {
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, SignupComponent],
      providers: [provideRouter([])]
    });
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));
  });

  afterEach(() => httpMock.verify());

  it('mots de passe différents → form invalide, pas d’appel HTTP', () => {
    const fixture = TestBed.createComponent(SignupComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;

    cmp.form.setValue({
      email: 'claire@example.com',
      password: 'S3cret!1234',
      passwordConfirm: 'autre1234'
    });
    expect(cmp.form.errors?.passwordsMismatch).toBeTrue();

    cmp.submit();
    httpMock.expectNone(`${environment.apiBaseUrl}/auth/signup`);
  });

  it('formulaire valide → POST /auth/signup + redirection /', () => {
    const fixture = TestBed.createComponent(SignupComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;

    cmp.form.setValue({
      email: 'claire@example.com',
      password: 'S3cret!1234',
      passwordConfirm: 'S3cret!1234'
    });
    expect(cmp.form.valid).toBeTrue();

    cmp.submit();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/signup`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.email).toBe('claire@example.com');
    req.flush({
      accessToken: 'tok',
      tokenType: 'Bearer',
      expiresIn: 900,
      user: { id: '1', email: 'claire@example.com', createdAt: new Date().toISOString() }
    });

    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });

  it('409 → message « compte déjà existant »', () => {
    const fixture = TestBed.createComponent(SignupComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance as any;

    cmp.form.setValue({
      email: 'claire@example.com',
      password: 'S3cret!1234',
      passwordConfirm: 'S3cret!1234'
    });
    cmp.submit();

    httpMock.expectOne(`${environment.apiBaseUrl}/auth/signup`).flush(
      { code: 'EMAIL_ALREADY_USED', message: 'L’email est déjà utilisé.' },
      { status: 409, statusText: 'Conflict' }
    );

    expect(cmp.errorMessage()).toBe('Un compte existe déjà avec cet email.');
  });
});
