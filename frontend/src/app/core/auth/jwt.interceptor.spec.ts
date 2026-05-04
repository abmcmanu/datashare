import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting
} from '@angular/common/http/testing';

import { jwtInterceptor } from './jwt.interceptor';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

describe('jwtInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(withInterceptors([jwtInterceptor])),
        provideHttpClientTesting()
      ]
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => httpMock.verify());

  it("ajoute Authorization quand un token existe et que ce n'est pas /auth/*", () => {
    sessionStorage.setItem('datashare.jwt', 'fake-token');

    http.get(`${environment.apiBaseUrl}/me/files`).subscribe();
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/me/files`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer fake-token');
    req.flush({});
  });

  it('ne touche pas à /auth/login même si un token est présent', () => {
    sessionStorage.setItem('datashare.jwt', 'fake-token');

    http.post(`${environment.apiBaseUrl}/auth/login`, { email: 'a', password: 'b' }).subscribe();
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/auth/login`);
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it("n'ajoute pas Authorization quand pas de token", () => {
    http.get(`${environment.apiBaseUrl}/health`).subscribe();
    const req = httpMock.expectOne(`${environment.apiBaseUrl}/health`);
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });
});
