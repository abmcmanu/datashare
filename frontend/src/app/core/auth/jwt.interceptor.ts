import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { AuthService } from './auth.service';

/**
 * Ajoute automatiquement <code>Authorization: Bearer &lt;jwt&gt;</code> sur toutes
 * les requêtes vers /api, à l'exception des endpoints publics signup/login.
 */
export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.getToken();

  const isAuthEndpoint = /\/auth\/(signup|login)$/.test(req.url);
  if (!token || isAuthEndpoint) {
    return next(req);
  }

  const authReq = req.clone({
    setHeaders: { Authorization: `Bearer ${token}` }
  });
  return next(authReq);
};
