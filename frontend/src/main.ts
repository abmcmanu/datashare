import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';

import { AppComponent } from './app/app.component';
import { APP_ROUTES } from './app/app.routes';
import { jwtInterceptor } from './app/core/auth/jwt.interceptor';
import { errorInterceptor } from './app/core/auth/error.interceptor';

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient(withInterceptors([jwtInterceptor, errorInterceptor])),
    provideRouter(APP_ROUTES)
  ]
}).catch((err) => console.error(err));
