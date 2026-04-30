import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController
} from '@angular/common/http/testing';

import { HomeComponent } from './home.component';
import { ApiService, HealthResponse } from '../../core/services/api.service';
import { environment } from '../../../environments/environment';

describe('HomeComponent — ping E2E', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule, HomeComponent],
      providers: [ApiService]
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('appelle /health et passe à state=ok', () => {
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/health`);
    expect(req.request.method).toBe('GET');

    const fakeBody: HealthResponse = {
      status: 'UP',
      service: 'datashare-backend',
      version: '0.1.0',
      timestamp: new Date().toISOString()
    };
    req.flush(fakeBody);

    expect(fixture.componentInstance['state']().kind).toBe('ok');
  });
});
