import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

/**
 * Réponse du endpoint /api/v1/health côté back-end.
 */
export interface HealthResponse {
  status: 'UP' | 'DOWN';
  service: string;
  version: string;
  timestamp: string;
}

/**
 * Service d'API central — encapsule les appels REST vers le back-end DataShare.
 * Utilisé pour le moment uniquement par le ping E2E (HomeComponent).
 */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly baseUrl = environment.apiBaseUrl;

  constructor(private readonly http: HttpClient) {}

  health(): Observable<HealthResponse> {
    return this.http.get<HealthResponse>(`${this.baseUrl}/health`);
  }
}
