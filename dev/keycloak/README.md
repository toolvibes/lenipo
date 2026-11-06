# Keycloak für die Entwicklung

Ein lokaler Keycloak mit dem Realm `lenipo` zum Testen des OIDC-Logins.

```bash
docker compose --profile oidc up -d keycloak
```

- Keycloak: http://localhost:8180 (Admin-Konsole: `admin` / `admin`)
- Client `lenipo`, Secret `lenipo-dev-secret`, Redirect `http://localhost:5173/api/v1/auth/oidc/callback`
- Testperson `mira` / `lenipo-dev-mira` (E-Mail verifiziert, Gruppe `team-plattform`)

In `.env` die OIDC-Variablen aus `.env.example` einkommentieren, dann bietet die Login-Seite „Mit Keycloak (Entwicklung) anmelden“ an. Nur für die lokale Entwicklung; alle Zugangsdaten hier sind öffentlich.
