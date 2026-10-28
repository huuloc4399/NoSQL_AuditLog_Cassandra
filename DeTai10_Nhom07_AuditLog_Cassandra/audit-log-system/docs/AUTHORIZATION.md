# Authentication and authorization v2

The demo has exactly two application roles: `ADMIN` and `USER`.

| Endpoint group | USER | ADMIN |
| --- | --- | --- |
| GET `/api/health` | Public | Public |
| POST `/api/auth/register`, `/api/auth/login` | Public | Public |
| `/api/auth/me`, `/api/auth/logout`, `/api/auth/change-password` | Own account | Own account |
| GET `/api/logs`, `/api/logs/detail`, `/api/logs/:id`, `/api/logs/stats/summary` | Read | Read |
| POST `/api/logs` | Denied | Allowed |
| `/api/services`, `/api/users` and subroutes | Denied | Allowed |
| POST `/api/demo/my-actions` | Own simulated scenarios | Allowed |
| Other `/api/demo/*`, `/api/logs/ttl-demo`, `/api/logs/ttl-status/:id` | Denied | Allowed |
| GET `/api/system/status` | Denied | Allowed |
| POST `/api/shop/events` | Authenticated simulated events | Authenticated simulated events |

The backend verifies JWTs, checks that the account still exists and is active, and authorizes using the account's current role. Deleted, disabled, missing, expired and invalid sessions return 401. Insufficient permissions return 403. Self-registration ignores a supplied role and always creates `USER`. User-management role inputs accept only `ADMIN` and `USER`.

The frontend verifies stored sessions using `/auth/me` before showing protected routes. It does not grant access using a role saved in browser storage. Menu visibility and route guards match backend authorization.

USER now lands on **Nếp Store** at `/`: product browsing, cart, checkout and local order history. `/demo` redirects USER to the store; ADMIN retains the audit dashboard and original scenario console. Products are a static frontend catalog. Carts and simulated orders stay in browser localStorage, scoped by account and API/preview mode; another browser does not share that history. Browser storage can be changed or cleared by the person using the machine and is not a server-side authorization boundary.

The shop API only accepts `POST /api/shop/events`. It identifies the actor from the authenticated session and rejects supplied identity, role, internal and shipping fields. It records three audit copies in Cassandra without storing products, carts or orders. Local state is updated after audit acknowledgement; these are separate writes, not one transaction. Payment outcomes and amounts are simulated client data, not verified financial transactions. The former product/cart/order CRUD routes have been removed.

Both roles can read the shared demo audit dataset. The log API does not restrict reads to the current account's events; menu labels do not imply private audit history.

The older `/demo/my-actions` API remains available for compatibility, with nine fixed scenarios that only create simulated audit events. Bulk daily data, account/service management, TTL and infrastructure remain ADMIN-only. Browser-only preview is labeled and stores shop state separately per account.

When loading existing Cassandra accounts, any non-ADMIN legacy role maps to USER. Existing accounts replace in-memory seed accounts. No schema change is needed. Fresh databases receive `admin / admin123` and `user / user12345` for demonstration. Administrators cannot delete, disable or demote themselves; the last active administrator is protected.

`npm run demo` in the frontend selects a separate browser-only Axios adapter with simulated accounts, events and expiration. It never connects to Cassandra. This mode demonstrates UI behavior, not production authentication or database TTL. It is visibly labeled throughout. Normal dev and production builds use the existing backend API.

JWT storage and stateless logout semantics remain those of the original educational project: logout clears the client token and writes an event; it does not revoke a copied JWT. Account changes are checked by backend middleware. Passwords remain bcrypt hashes in the real backend and are omitted from API user responses. The browser simulation uses local test credentials and must contain only demonstration data.

Validation: `npm run test:rbac` exercises the real Express router, authentication and authorization over loopback HTTP with stubbed database dependencies. It covers forged, expired, disabled and deleted sessions, server-side role checks, admin-only mutations, safe user responses and forced USER registration. Cassandra integration is tested separately by the existing `npm test` suite when Cassandra is available.
