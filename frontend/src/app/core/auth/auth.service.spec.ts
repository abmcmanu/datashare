import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController
} from '@angular/common/http/testing';

import { AuthService, AuthResponse } from './auth.service';
import { environment } from '../../../environments/environment';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [AuthService]
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function fakeAuth(email = 'claire@example.com'): AuthResponse {
    return {
      accessToken: 'jwt.token.value',
      tokenType: 'Bearer',
      expiresIn: 900,
      user: { id: 'uuid-1', email, createdAt: new Date().toISOString() }
    };
  }

  it('signup persiste le token et met à jour currentUser', () => {
    service.signup('claire@example.com', 'S3cret!1234').subscribe((res) => {
      expect(res.accessToken).toBe('jwt.token.value');
    });

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/signup`);
    expect(req.request.method).toBe('POST');
    req.flush(fakeAuth());

    expect(service.getToken()).toBe('jwt.token.value');
    expect(service.isAuthenticated()).toBeTrue();
    expect(service.currentUser()?.email).toBe('claire@example.com');
  });

  it('login persiste le token et met à jour currentUser', () => {
    service.login('claire@example.com', 'S3cret!1234').subscribe();
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/login`);
    req.flush(fakeAuth());

    expect(service.getToken()).toBe('jwt.token.value');
    expect(service.isAuthenticated()).toBeTrue();
  });

  it('logout efface tout', () => {
    service.login('a@b.c', 'whatever8').subscribe();
    httpMock.expectOne(`${environment.apiBaseUrl}/auth/login`).flush(fakeAuth());

    service.logout();
    expect(service.getToken()).toBeNull();
    expect(service.isAuthenticated()).toBeFalse();
    expect(service.currentUser()).toBeNull();
  });

  it("ne persiste rien si l'API renvoie une erreur", () => {
    service.login('claire@example.com', 'wrong').subscribe({
      next: () => fail('should have errored'),
      error: () => {}
    });
    httpMock
      .expectOne(`${environment.apiBaseUrl}/auth/login`)
      .flush({ message: 'no' }, { status: 401, statusText: 'Unauthorized' });

    expect(service.getToken()).toBeNull();
    expect(service.isAuthenticated()).toBeFalse();
  });
});
