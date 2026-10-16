# Authentication, roles, and user management

The frontend relies on the backend's cookie session. It stores no passwords, tokens, or identities of its own beyond what each response returns. The backend authorizes every request: hiding a route or button in this app is a usability measure, not a security boundary.

## Startup sequence

1. **Setup check**: `SetupProvider` (`src/setup/`) posts `{ "action": "setup.status" }` and expects exactly one row, `{ "initialized": boolean }`.
   - If `initialized` is `false`, every path shows "User setup is required. Please complete user setup in the Backend Admin Console." This app has no setup screen; the earlier in-app setup page was removed in `028e596`.
   - If the request fails, the app shows "Unable to check application setup" with **Retry**.
2. **Session restore**: once setup is complete, `AuthProvider` (`src/auth/AuthContext.tsx`) posts `{ "action": "auth.session" }`. If that call fails, the app falls back to signed out ("Unable to restore your session.").
3. **Routing**: protected routes need `authenticated: true` **and** `frontendAccess: true`. See [Architecture](ARCHITECTURE.md#startup-and-routing).

## Session payload

`auth.session`, `auth.login`, and `auth.logout` must return exactly one row in this shape. Unknown keys are rejected (`parseAuthSessionSnapshot` in `src/auth/authService.ts`):

```json
{
  "authenticated": true,
  "user": {
    "username": "jdoe",
    "backendRole": null,
    "frontendAccess": true,
    "frontendRole": "application-administrator"
  }
}
```

When signed out, the row is `{ "authenticated": false, "user": null }`.

| Field | Values | Used for |
| --- | --- | --- |
| `backendRole` | `null`, `read-only`, `data-operator`, `system-administrator` | Display ("Super Admin"), and super-admin-only actions in User Management |
| `frontendAccess` | boolean | Gate for every protected route |
| `frontendRole` | `null`, `application-administrator` | Gate for `/settings/users`. It must be `null` when `frontendAccess` is `false` |

## Signing in and out

`Login` posts `auth.login` with `username` and `password`. Backend error codes get specific messages: `INVALID_CREDENTIALS` (shows `attemptsRemaining` when provided) and `LOGIN_RATE_LIMITED` (shows `retryAfterSeconds`). **Sign out** posts `auth.logout`.

Session-related behavior:

- **Cross-tab sync**: sign-in, sign-out, and session expiry are announced on the `BroadcastChannel` named `generic-reporting-auth`. The message carries no identity. Every receiving tab re-checks `auth.session`, and treats a failed check as signed out.
- **Expiry**: any response with `401` and code `AUTHENTICATION_REQUIRED` signs the tab out and notifies the other tabs.
- **User switch isolation**: when the identity changes, the in-memory request cache is cleared, the old shared saved-view key is removed, filter values are discarded, and the protected page tree remounts (it is keyed by username).

## CSRF

`src/api/client.ts` attaches `X-CSRF-Token` only to these actions: `auth.login`, `auth.logout`, every `auth.frontendUsers.*` mutation, and `insert`/`update`/`delete`/`upsert`. The read actions `select` and `sql` do not carry it.

- The client fetches the token with `{ "action": "auth.csrf" }`. The response must contain one row with `csrfToken`, made of 64 lowercase hex characters.
- When a response sends `X-CSRF-Token`, that newer token replaces the stored one.
- A `403 CSRF_VALIDATION_FAILED` clears the token, and the request is retried once.
- All requests use `credentials: "include"`. For the session cookie to be sent, the API must be same-site with the page. See [Deployment](DEPLOYMENT.md#api-origin).

In development, the client rewrites `localhost` ↔ `127.0.0.1` in `VITE_API_URL` to match the page's hostname (`resolveApiUrl`), so a `SameSite=Lax` cookie still travels.

## Roles in this frontend

`src/config/frontendCapabilities.ts` decides which roles User Management can assign:

```ts
{ read: true, write: false, userManagement: true }
```

| Capability | Role it unlocks | Current state |
| --- | --- | --- |
| `userManagement` | `application-administrator` ("Admin") | Assignable |
| `write` | `data-operator` ("Data Operator") | **Not assignable**: there are no write features (roadmap 37) |
| `read` | `read-only` ("Read Only") | Assignable, and the default for new users |

## User Management (`/settings/users`)

Only users whose `frontendRole` is `application-administrator` can reach this page. `/settings` shows a link to it for admins, and "No settings are available for your account" for everyone else.

| Operation | Action | Who / rule |
| --- | --- | --- |
| List users | `auth.frontendUsers.list` | Admins |
| Create user (name, username, mobile, optional email, password + confirmation, role) | `auth.frontendUsers.create` | Admins |
| Edit profile (name, username, mobile, email) | `auth.frontendUsers.update` | Admins |
| Enable / disable | `auth.frontendUsers.enable` / `.disable` | Admins; not on your own account |
| Change password | `auth.frontendUsers.changePassword` | Admins |
| Delete | `auth.frontendUsers.delete` | Admins; not on your own account |
| Make Admin / Demote | `auth.frontendUsers.assignRole` | Only a signed-in `system-administrator` (Super Admin) |

Users whose `backendRole` is `system-administrator` are labelled **Backend Managed**, and this page offers no actions for them. Backend authorization is managed in the Backend Admin Console, which is not part of this repository.

The backend may enforce more rules than those listed here, such as password policy or uniqueness. The page shows the backend's message and validation details when it rejects a request.

## Tests

`src/auth/__tests__/` (`authFoundation`, `authFlow`, `routeProtection`, `sessionExpiration`, `crossTabSession`, `userSwitchRemount`, `userManagementService`), `src/setup/__tests__/setupFlow.test.tsx`, `src/pages/__tests__/UserManagement.test.tsx` and `SettingsIntegration.test.tsx`, and `src/api/__tests__/csrfActions.test.ts` / `client.test.ts`.

[Architecture](ARCHITECTURE.md) · [API reference](API-REFERENCE.md) · [Troubleshooting](TROUBLESHOOTING.md)
