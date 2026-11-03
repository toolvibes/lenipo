# SDKs für Python und Go

Erzeugt aus derselben OpenAPI-Beschreibung wie das TypeScript-SDK (`packages/sdk/openapi.json`):

| Sprache | Generator | Ziel |
| --- | --- | --- |
| Python | `openapi-python-client` 0.29.1 (MIT) | `sdks/python/client` (Paket `lenipo_client`) |
| Go | `oapi-codegen` v2.8.0 (Apache-2.0) | `sdks/go` (Modul `github.com/toolvibes/lenipo/sdks/go`, Paket `lenipo`) |

Neu erzeugen (braucht [uv](https://docs.astral.sh/uv/) und Go):

```bash
pnpm api:generate
pnpm sdk:generate
```

Anmeldung bei beiden mit einem persönlichen Zugriffstoken als `Authorization: Bearer lp_pat_…`.

## Bekannte Lücken

- **Python:** Automatisierungsregeln anlegen und ändern (`POST /api/v1/automation/rules`, `PUT /api/v1/automation/rules/{id}`) erzeugt der Generator nicht, weil die Bausteine einer Regel ineinander verschachtelt sind (Wenn/Sonst, Verzweigungen). Diese beiden Aufrufe gehen mit dem mitgelieferten `httpx`-Client direkt (`client.get_httpx_client().post(...)`).
- **Go:** Die Antwort-Typen heißen `…HTTPResponse` (z. B. `GetIssueHTTPResponse`), weil die API ein Schema `SetupStatusResponse` hat, mit dem die übliche Endung `…Response` kollidieren würde.
