import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth-new.service';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (auth.isAuthenticated() || (await auth.validateSession())) {
    return true;
  }
  return router.createUrlTree(['/login']);
};