# Coolify deployment — studio.navroop.app

Deploys this fork to [coolify.navroop.app](https://coolify.navroop.app) as a single-domain stack.
`SELF_HOSTING.md` and `SELF_HOSTING_ADVANCED.md` are upstream's docs for the plain-Compose and Helm
paths — read them for how the app works; this file only covers what Coolify changes.

The web UI ships with upstream Multica branding. License condition 1(b) prohibits
changing it without a written branding waiver. The rebrand work is parked, undeployed,
on branch `brand/nr-ai-studio`. See [FORK.md](./FORK.md).

## Shape of the deployment

```
                    ┌── Path(`/ws`) ───────────────→ backend:8080   (WebSocket, exact path)
browser ─→ Traefik ─┤
        (TLS)       └── everything else ──→ frontend:3000
                                              │ proxy.ts rewrites, server-side:
                                              └─→ backend:8080   /api /v1 /auth /uploads /health /docs
```

One public domain. Nothing is published on the host; both app containers use `expose:` and Traefik
reaches them over the Docker network. **The backend is never publicly routable except on `/ws`.**

## Creating the resource

1. **New Resource → Docker Compose**, Git repo `rewathiinnovations/ai-studio.navroop.app`, branch
   `deploy/coolify`, compose file `docker-compose.coolify.yml`.
2. Set the domain to `https://studio.navroop.app` and enable HTTPS.
3. Set the environment variables below. Generate every secret fresh — never reuse an upstream
   default or an example value.
4. Deploy, then work through [Verifying a deploy](#verifying-a-deploy).

## Environment variables

### Required

| Variable | Value |
| --- | --- |
| `PUBLIC_ORIGIN` | `https://studio.navroop.app` |
| `PUBLIC_HOST` | `studio.navroop.app` |
| `JWT_SECRET` | `openssl rand -hex 32` |
| `POSTGRES_PASSWORD` | `openssl rand -hex 24` |

`PUBLIC_ORIGIN` and `PUBLIC_HOST` drive every URL in the file. Compose hard-fails on a missing
`JWT_SECRET` or `POSTGRES_PASSWORD` rather than starting with a weak one:

```
required variable JWT_SECRET is missing a value: JWT_SECRET must be set to a strong
random value — generate one with 'openssl rand -hex 32'
```

A production backend also refuses to boot on a recognised placeholder value, so a "temporary" secret
will not get you a running instance.

### `POSTGRES_PASSWORD` must be URL-safe — hex, not punctuation

`DATABASE_URL` is assembled by string interpolation:

```
postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
```

Nothing URL-encodes the password, so punctuation in it produces a URL the backend cannot parse. It
crash-loops before it ever opens a connection, and the only symptom is:

```
ERR unable to connect to database error="parse database url: cannot parse
postgres://multica:xxxxxx@postgres:5432/multica?sslmode=disable:
failed to parse as URL (net/url: invalid userinfo)"
```

Note the password is redacted in that message, which makes it look like a network or credential
problem rather than a quoting one. It is neither. `openssl rand -hex 24` is safe because hex has no
reserved characters. **This bit us on the first deploy**: left unset, Coolify generates its own
password containing punctuation, and the stack came up with a healthy Postgres, a healthy frontend,
and a backend restarting every 60s. Set the value explicitly.

If Postgres has already initialised, changing the variable is not enough — `POSTGRES_PASSWORD` only
applies at `initdb`. Realign the existing role, then redeploy:

```bash
docker exec -i $(docker ps -qf name=postgres-<uuid>) psql -U multica -d multica \
  -c "ALTER USER multica WITH PASSWORD '<new-hex-password>';"
```

### Coolify pre-seeds every compose variable

On first parse Coolify walks the compose file and creates an env var for each `${VAR}` it finds,
using the `:-default` where there is one. Two consequences:

- Creating a variable through the API returns `409 already exists`. Use `PATCH`, not `POST`.
- Defaults that reference another variable are stored **literally**. `CORS_ALLOWED_ORIGINS` arrives
  as the seven characters `${PUBLIC_ORIGIN}` and is never expanded, because Compose does not
  re-interpolate a value it has already substituted. Set these to a concrete origin by hand:
  `CORS_ALLOWED_ORIGINS`, `MULTICA_PUBLIC_URL`, `GOOGLE_REDIRECT_URI`. Getting
  `CORS_ALLOWED_ORIGINS` wrong is quiet — plain HTTP keeps working and only `/ws` 403s.

### Strongly recommended

**Email.** With neither Resend nor SMTP configured, login codes are only written to the backend log.
Set `RESEND_API_KEY` + `RESEND_FROM_EMAIL`, or the `SMTP_*` group. Without this, nobody but you can
sign in.

### Already handled by the compose file

You do not need to set these; they are listed so the defaults are not a surprise.

| Variable | Default | Why |
| --- | --- | --- |
| `ALLOW_SIGNUP` | `false` | private instance, invite-only |
| `COOKIE_DOMAIN` | empty | correct for a single domain; only needed for split subdomains |
| `MULTICA_TRUSTED_PROXIES` | private CIDRs | see below |
| `RATE_LIMIT_TRUSTED_PROXIES` | private CIDRs | see below |
| `MULTICA_VCS_INTEGRATION_ENABLED` | `false` | upstream defaults it **on** while `MULTICA_VCS_SECRET_KEY` is empty, which shows the UI for a feature that cannot work. Set both to enable it. |
| `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_WS_URL` | empty | see [Build time vs runtime](#build-time-vs-runtime) |
| `MULTICA_IMAGE_TAG` | `v0.4.35` | see [Backend image](#backend-image) |

**On the trusted-proxy defaults:** every request arrives from Traefik, so without these the backend
sees one client IP for the whole world and the per-IP limiter on `/auth/send-code` becomes 5
requests/minute *instance-wide*. The defaults cover the RFC-1918 ranges Docker allocates from.

## Build time vs runtime

This trips people up, so it is worth being explicit.

- **`NEXT_PUBLIC_*` is inlined into the JS bundle by `next build`.** Setting it in Coolify's runtime
  environment does nothing at all. Changing a `NEXT_PUBLIC_*` value needs a rebuild, not a restart.
- **`REMOTE_API_URL` and `DOCS_URL` are read per-request** by `apps/web/proxy.ts` via
  `runtimeRewriteDestination()`. Changing those takes effect on restart.

Both `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL` are deliberately **empty**:
`resolveBrowserApiBaseUrl()` returns `undefined`, so `CoreProvider` falls back to `apiBaseUrl=""`
and the browser makes same-origin relative requests, while `deriveWsUrl()` builds
`wss://<host>/ws` from `window.location`. Setting either would bake an origin into the bundle and
give up the single-domain, CORS-free setup.

## The `/ws` route is the fragile part

`apps/web/proxy.ts` lists `/ws` among the paths it forwards, but it forwards with
`NextResponse.rewrite()`, which carries HTTP only and **cannot** perform the WebSocket `Upgrade`
handshake — `SELF_HOSTING_ADVANCED.md:530` says so directly. Traefik has to reach the backend
itself, which is what these labels on the `backend` service do:

```yaml
- traefik.enable=true
- traefik.http.routers.nrws.rule=Host(`studio.navroop.app`) && Path(`/ws`)
- traefik.http.routers.nrws.priority=100
- traefik.http.routers.nrws.entrypoints=https
- traefik.http.routers.nrws.tls=true
- traefik.http.routers.nrws.tls.certresolver=letsencrypt
- traefik.http.services.nrws.loadbalancer.server.port=8080
```

`Path()` is an **exact** match, so a workspace slugged `ws-foo` still reaches the frontend.
`PathPrefix(`/ws`)` would swallow it. The explicit priority beats Coolify's generated Host-only
router for the frontend.

### The host in that rule cannot be a variable

It is written out in full deliberately. Coolify rewrites every `$` inside a **label** to `$$` before
handing the compose to Docker, and `$$` is Compose's escape for a literal `$`. So `${PUBLIC_HOST}`
arrives at Traefik as those fifteen characters, the rule tries to match a host literally named
`${PUBLIC_HOST}`, and it never fires. Verified in the generated file on the server:

```
53:  - 'traefik.http.routers.nrws.rule=Host(`$${PUBLIC_HOST}`) && Path(`/ws`)'
```

Coolify has to do this — a Traefik basic-auth hash looks like `$apr1$...` and would otherwise be
eaten as interpolation. Only `environment:` gets interpolated; labels never do. **When the domain
changes, edit this label by hand.**

This failed exactly this way on the first deploy here, and it is invisible from the outside: a plain
HTTP `GET /ws` still returns the backend's JSON, because `proxy.ts` forwards it. Only a real
`Upgrade` fails. Do not treat a non-404 on `/ws` as proof the route works — check Traefik's router
table.

Two more things to watch:

- **Coolify merges its own labels with these.** Confirm after the first deploy that the router
  survived and that the backend container is attached to the Coolify proxy network. This is the
  single most likely thing to fail silently.
- **`CORS_ALLOWED_ORIGINS` gates the WebSocket `Origin` check.** If it does not exactly match the
  browser's origin, `/ws` returns 403 while everything else keeps working.

The failure signature is specific and easy to misread: **the app loads, data renders, nothing ever
updates, and the console shows no errors.** If you see that, check `/ws` before anything else.

Do **not** add a blanket `/auth` rule at the edge. `isBackendAuthPath()` deliberately keeps
`/auth/callback` and `/auth/hg-sso/callback` on Next, and an edge rule would break OAuth login.

## Frontend image

Built from this checkout (`Dockerfile.web`), not `ghcr.io/multica-ai/multica-web`. Building
from source keeps the frontend pinned to the same commit as this compose file; the published
image would move independently.

The only build arg `Dockerfile.web` declares is `NEXT_PUBLIC_APP_VERSION`. (The `REMOTE_API_URL`
build arg in `.github/workflows/release.yml:284` is dead — nothing consumes it.)

## Backend image

Pinned to `ghcr.io/multica-ai/multica-backend:v0.4.35` — the newest tag published to GHCR. We
changed no Go code, so there is nothing to build, and `latest` would move the API under us without
warning. This checkout's `apps/web/package.json` is `0.4.36`, so the frontend runs one patch ahead
of the API.

Confirm a tag exists before bumping:

```bash
docker buildx imagetools inspect ghcr.io/multica-ai/multica-backend:v0.4.36
```

## Health endpoints

These are **not** interchangeable, and upstream's docs are easy to misread here:

| Endpoint | Meaning | Reachable via the domain? |
| --- | --- | --- |
| `/health` | **Liveness.** `{"status":"ok","pid":…,"commit":…}`. Returns 200 even with a dead database. | Yes — `proxy.ts` forwards it |
| `/healthz`, `/readyz` | **Readiness.** `{"status":"ok","checks":{"db":"ok","migrations":"ok"}}`, 503 when not ready. | No — `proxy.ts` does not forward these |

The container healthcheck therefore uses `/healthz`, from inside the container. It has a 180s
`start_period` because migrations run in `docker/entrypoint.sh` *before* the server binds, and a
cold database can take minutes. The image is bare `alpine:3.21` with no `curl`, so the check uses
busybox `wget`.

## Verifying a deploy

Check the running deployment, not the build log.

```bash
# 1. Liveness through the public proxy — proves Traefik reaches the frontend
#    and proxy.ts reaches the backend.
curl -fsS https://studio.navroop.app/health

# 2. Readiness — not routable, so ask the container. Expect
#    {"status":"ok","checks":{"db":"ok","migrations":"ok"}}
docker exec <backend> wget -qO- http://127.0.0.1:8080/healthz

# 3. Upstream branding is intact. Title and manifest both read Multica.
curl -fsS https://studio.navroop.app/login | grep -o '<title>[^<]*</title>'
curl -fsS https://studio.navroop.app/manifest.webmanifest

# 4. No parked-rebrand name in rendered HTML. Expect 0 on each path.
for p in / /login /changelog /about; do
  echo -n "$p "
  curl -fsS "https://studio.navroop.app$p" | grep -ci 'nr ai studio'
done

# 5. Repeat the title check for each locale — each must contain Multica.
for l in zh-Hans ja ko; do
  echo -n "$l "
  curl -fsS -H "Cookie: multica_locale=$l" https://studio.navroop.app/login \
    | grep -o '<title>[^<]*</title>'
done
```

Then in a browser, signed in:

- **`/uploads` works** — an avatar or attachment renders.
- **`/ws` works** — open the same issue in two tabs, change status in one, and confirm the other
  updates without a reload. Nothing else proves the Traefik label survived Coolify's label merge.
- **Locale switch** — set the UI to 中文 / 日本語 / 한국어 and re-check the tab title, the sidebar,
  and the onboarding flow.

## Operational notes

- **Uploads live in the `backend_uploads` volume** unless `S3_BUCKET` is set. Back it up, or move to
  object storage.
- **Postgres publishes nothing.** Use `docker exec` for `psql`.
- **A `NEXT_PUBLIC_*` change needs a rebuild.** A restart will not pick it up.
