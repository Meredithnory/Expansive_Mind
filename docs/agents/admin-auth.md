# Admin login and MFA

`ADMIN_EMAILS` and an admin session are different checks.

Allowlist: `isAdminIdentity` in `src/app/lib/admin-identity.ts`. Unlimited quota uses `isAdminUser` in `src/app/lib/admin.ts`. The allowlist alone does not open `/admin`.

Pages: `src/middleware.ts` leaves `/admin/login` open and requires cookie `admin_session` for every other `/admin` path. It does not read an email out of `auth_token`.

APIs: `withAdmin` needs the user cookie, `isAdminUser`, and `hasAdminSession` (cookie `admin_session`, role `admin`, same user id).

UI: `src/app/admin/login/page.tsx`.

1. `POST` `src/app/api/admin/login/route.ts`. Five attempts per 15 minutes per IP. A missing user still runs bcrypt against a dummy hash. A non-admin gets the same failure as a bad password. This step sets no session cookie.
2. If `adminTotpEnabled`, the stage is `verify`. Otherwise the stage is `setup`: a new secret, a QR code, and the secret encrypted inside a 10-minute `admin_mfa` JWT. The same token is returned as JSON `mfaToken` so verify still works when the cookie is dropped.
3. `POST` `src/app/api/admin/login/totp/route.ts`. It reads the `admin_mfa` cookie first, then `mfaToken`. Eight attempts per 15 minutes per IP and user. `verifyTotpCode` in `src/app/lib/admin-totp.ts` uses a 30-second period, window 1, and rejects a reused `adminTotpLastStep`. The secret is AES-256-GCM with a key derived from `JWT_SECRET`.
4. On success the encrypted secret is stored, `adminTotpEnabled` is set, `auth_token` lasts 24 hours, `admin_session` lasts 4 hours, and `admin_mfa` is cleared. `recordAdminAction` in `src/app/lib/admin-audit.ts` writes `admin.totp.enabled` on setup and `admin.login` on every success.

User login (`src/app/api/login/route.ts`) signs `{ id, email, tokenVersion }`. Admin completion issues `auth_token` from `createAuthSessionToken` in `src/app/lib/admin-session.ts`. Those issuers stay separate.

## Leave alone

- Do not skip TOTP for an allowlisted email.
- Do not make middleware check the JWT email.
- Do not put the TOTP secret in `admin_session`. It stays encrypted on the user and, only during setup, inside the short-lived MFA token.
- Do not edit `src/app/lib/admin-session.ts` or `src/app/api/admin/login/` to rebuild authenticator login. That fix is already in flight.
