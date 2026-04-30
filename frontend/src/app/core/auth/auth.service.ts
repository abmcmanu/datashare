import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface UserDto {
  id: string;
  email: string;
  createdAt: string;
}

export interface AuthResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: UserDto;
}

const TOKEN_KEY = 'datashare.jwt';
const USER_KEY = 'datashare.user';

/**
 * Service d'authentification — encapsule signup, login, logout et la persistance
 * du JWT (sessionStorage : effacé à la fermeture du navigateur, plus sûr que localStorage).
 *
 * Expose un <code>signal</code> {@code currentUser} consommé par les composants.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {

  private readonly api = `${environment.apiBaseUrl}/auth`;

  private readonly userSignal = signal<UserDto | null>(this.readUser());
  readonly currentUser = computed(() => this.userSignal());
  readonly isAuthenticated = computed(() => this.userSignal() !== null);

  constructor(private readonly http: HttpClient) {}

  // ---------- API ----------

  signup(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.api}/signup`, { email, password })
      .pipe(tap((res) => this.persist(res)));
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.api}/login`, { email, password })
      .pipe(tap((res) => this.persist(res)));
  }

  me(): Observable<UserDto> {
    return this.http.get<UserDto>(`${this.api}/me`);
  }

  logout(): void {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    this.userSignal.set(null);
  }

  // ---------- Token ----------

  getToken(): string | null {
    return sessionStorage.getItem(TOKEN_KEY);
  }

  // ---------- helpers privés ----------

  private persist(res: AuthResponse): void {
    sessionStorage.setItem(TOKEN_KEY, res.accessToken);
    sessionStorage.setItem(USER_KEY, JSON.stringify(res.user));
    this.userSignal.set(res.user);
  }

  private readUser(): UserDto | null {
    const raw = sessionStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as UserDto;
    } catch {
      return null;
    }
  }
}
