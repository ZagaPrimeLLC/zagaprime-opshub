# ZagaPrime Ops Hub

One place for everything ZagaPrime runs: accounts → projects → resources, one-click console links, progress analytics, and a daily stack-news feed rated by criticality and time to implement.

- **Data:** schema `proj_opsdash` on the shared Supabase host (beta.zagram.store). The app connects with the scoped `opsdash_app` Postgres role — never the service key, never stored credentials. Bitwarden stays the vault; the dashboard stores deep links only.
- **Auth:** single-password login (`OPSHUB_PASSWORD`) with an HMAC session cookie (`SESSION_SECRET`). Default-closed: no env vars, no access.
- **News agent:** a scheduled Claude task scans provider changelogs daily and writes rated items into `proj_opsdash.stack_news`; the News tab reads and manages them.

## Environment variables

| Var | Purpose |
| --- | --- |
| `SUPABASE_DB_URL` | Pooler connection string for the `opsdash_app` role |
| `SUPABASE_DB_URL_ALT` | Optional fallback pooler host |
| `OPSHUB_PASSWORD` | Dashboard login password |
| `SESSION_SECRET` | Random string for session cookies |

## Develop

```bash
npm install
npm run dev
```

`/api/health` reports database connectivity.
