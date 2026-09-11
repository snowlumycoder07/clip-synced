# Clipboard Sync (D1 version)

Same API as before, backed by Cloudflare D1 (SQLite) instead of KV.
D1's free tier allows 100,000 writes/day and 5,000,000 reads/day — far
above KV's 1,000 writes/day limit.

## Endpoints (unchanged)
- `POST /api/upload` — body `{"text": "..."}` or raw text -> stores as latest
- `GET  /api/latest`  -> `{ text, updatedAt }`
- `GET  /api/history` -> last 20 entries

All require header `x-api-key: YOUR_SECRET`.

## Setup

### 1. Create the D1 database
From Termux (or anywhere with wrangler):
```bash
npx wrangler d1 create clipboard-db
```
This prints a `database_id` — you'll need it if you use `wrangler.toml`,
but since you're deploying via the Pages dashboard, you don't need
`wrangler.toml` at all. Just note the database name.

### 2. Create the table
```bash
npx wrangler d1 execute clipboard-db --file=./schema.sql --remote
```
(`--remote` runs it against the actual hosted D1 database, not local.)

### 3. Bind it in the Pages dashboard
- Go to your Pages project → **Settings** → **Bindings** (or **Functions → D1 database bindings**)
- Add binding:
  - **Variable name:** `DB` (must match exactly — code uses `env.DB`)
  - **D1 database:** select `clipboard-db`

### 4. Keep your existing `CLIPBOARD_SECRET`
Same as before — Settings → Environment variables → `CLIPBOARD_SECRET` (encrypted).

### 5. Redeploy
Bindings only apply on a fresh deploy. Push any small change or use
"Retry deployment" from the Deployments tab.

## Usage (same as before)

```bash
# upload
curl -X POST https://YOUR-PROJECT.pages.dev/api/upload \
  -H "x-api-key: YOUR_SECRET" \
  --data-binary "some text"

# fetch latest
curl https://YOUR-PROJECT.pages.dev/api/latest \
  -H "x-api-key: YOUR_SECRET"

# history
curl https://YOUR-PROJECT.pages.dev/api/history \
  -H "x-api-key: YOUR_SECRET"
```

## Live push (WebSocket via Durable Object)

`/api/ws` now gives real-time, instant-push clipboard sync between multiple
machines using a Durable Object (`ClipRelay`), instead of polling. When one
client uploads, every other connected client gets it pushed immediately —
no delay, no repeated HTTP requests.

### Setup
Durable Object bindings can't be added through the Pages dashboard UI, so
`wrangler.toml` (included in this repo) declares the `CLIP_RELAY` binding.
Your existing `DB` (D1) binding stays exactly as configured in the Pages
dashboard — `wrangler.toml` intentionally does not redeclare it.

Just commit and push this repo to GitHub as normal; Cloudflare Pages reads
`wrangler.toml` during the build and provisions the Durable Object binding
and migration automatically. No local `wrangler` install needed.

Your existing `CLIPBOARD_SECRET` environment variable is reused as-is — no
new secret needed.

### Connect
```
wss://YOUR-PROJECT.pages.dev/api/ws?key=YOUR_SECRET
```

Client protocol (JSON messages over the socket):
- Server → client on connect: `{"type":"clip","text":"...","updatedAt":"..."}`
  (or `{"type":"welcome"}` if nothing has ever been uploaded yet)
- Client → server to publish a new clip: `{"type":"upload","text":"..."}`
- Server → client ack: `{"type":"ack","updatedAt":"..."}`
- Either side may send `{"type":"ping"}` → server replies `{"type":"pong"}`
  (recommended every ~20s to keep the connection alive)
- Errors: `{"type":"error","error":"..."}` (e.g. `"unauthorized"`, `"no_text"`)

Every upload through `/api/ws` is also mirrored into the same D1 `clips`
table, so `/api/latest` and `/api/history` stay fully in sync with the
live-push path — you can use either the WebSocket or the old REST endpoints
interchangeably.

## Notes
- Table `clips` stores every upload permanently (unlike the old KV version
  which only kept a rolling 20-item history + 1 latest key). If you want
  to prune old rows periodically, run:
  ```sql
  DELETE FROM clips WHERE id NOT IN (SELECT id FROM clips ORDER BY id DESC LIMIT 100);
  ```
- D1 free tier: 5GB storage, 100k writes/day, 5M reads/day — plenty for
  personal clipboard syncing even with heavy use.
