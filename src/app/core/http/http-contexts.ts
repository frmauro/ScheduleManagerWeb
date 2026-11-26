import { HttpContextToken } from '@angular/common/http';

/**
 * Marca requisições em que um `401` **não** significa sessão expirada
 * (ex.: `POST /auth/login` → `auth.invalid_credentials`).
 */
export const SKIP_SESSION_401 = new HttpContextToken<boolean>(() => false);

/** Marca requisições cujo `403` é tratado pela própria tela (sem toast global). */
export const SKIP_ERROR_TOAST = new HttpContextToken<boolean>(() => false);
