import { APP_INITIALIZER, ApplicationConfig, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { MatSnackBarModule } from '@angular/material/snack-bar';

import { routes } from './app.routes';
import { ConfigService } from './config/config.service';
import { ThemeService } from './services/theme.service';

export function initApp(config: ConfigService, theme: ThemeService) {
  return async () => {
    await config.load();
    theme.init();
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(),
    provideAnimationsAsync(),
    MatSnackBarModule,
    {
      provide: APP_INITIALIZER,
      useFactory: initApp,
      deps: [ConfigService, ThemeService],
      multi: true,
    },
  ],
};
