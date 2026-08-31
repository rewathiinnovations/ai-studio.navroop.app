# Coolify deployment — studio.navroop.app

Deploys this fork to [coolify.navroop.app](https://coolify.navroop.app) as a single-domain stack.
`SELF_HOSTING.md` and `SELF_HOSTING_ADVANCED.md` are upstream's docs for the plain-Compose and Helm
paths — read them for how the app works; this file only covers what Coolify changes.

Branding changes are documented separately in [FORK.md](./FORK.md).

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
   `brand/nr-ai-studio`, compose file `docker-compose.coolify.yml`.
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
  environment does nothing at all. The brand name is compiled in the same way, which is why
  **a brand change needs a rebuild, not a restart.**
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
- traefik.http.routers.nrws.rule=Host(`${PUBLIC_HOST}`) && Path(`/ws`)
- traefik.http.routers.nrws.priority=100
- traefik.http.routers.nrws.entrypoints=https
- traefik.http.routers.nrws.tls=true
- traefik.http.routers.nrws.tls.certresolver=letsencrypt
- traefik.http.services.nrws.loadbalancer.server.port=8080
```

`Path()` is an **exact** match, so a workspace slugged `ws-foo` still reaches the frontend.
`PathPrefix(`/ws`)` would swallow it. The explicit priority beats Coolify's generated Host-only
router for the frontend.

Two things to watch:

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

Built from this checkout (`Dockerfile.web`), not `ghcr.io/multica-ai/multica-web`. We changed
`apps/web`, so the upstream image would serve upstream's branding.

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

# 3. No leaked brand name in rendered text. Expect no output.
for p in / /login; do
  curl -fsS "https://studio.navroop.app$p" | grep -o 'Multica'
done
# On `/` this DOES match inside href="…" — see the third caveat in FORK.md.
# It must not appear as visible text, and /login must be clean.

# 4. Repeat for each locale.
for l in zh-Hans ja ko; do
  curl -fsS -H "Cookie: multica_locale=$l" https://studio.navroop.app/login | grep -c 'Multica'
done

# 5. Title and manifest both read NR AI Studio.
curl -fsS https://studio.navroop.app/login | grep -o '<title>[^<]*</title>'
curl -fsS https://studio.navroop.app/manifest.webmanifest
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
- **A brand or `NEXT_PUBLIC_*` change needs a rebuild.** A restart will not pick it up.
