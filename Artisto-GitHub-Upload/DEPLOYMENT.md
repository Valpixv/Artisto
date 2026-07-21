# Artisto deployment settings

## Vercel project

Import the repository as a new Vercel project and use these settings:

- Framework Preset: `Next.js`
- Root Directory: `.`
- Node.js Version: `24.x`
- Package Manager: `pnpm 10.34.5` (pinned by `packageManager` in `package.json`)
- Install Command: `pnpm install --frozen-lockfile`
- Build Command: `pnpm build`
- Output Directory: leave blank so Vercel uses the Next.js default
- Development Command: `pnpm dev`

Add these variables in Vercel Project Settings → Environment Variables. Apply
them to Production, Preview, and Development unless noted otherwise:

| Variable | Value/source | Exposure |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://kmcaoujnzpehuylaqrlx.supabase.co` | Browser-safe |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Settings → API Keys → Publishable key | Browser-safe |
| `SUPABASE_URL` | `https://kmcaoujnzpehuylaqrlx.supabase.co` | Server only |
| `SUPABASE_PUBLISHABLE_KEY` | Same Supabase publishable key | Server only |
| `SUPABASE_SECRET_KEY` | Supabase → Settings → API Keys → Secret key | Sensitive; server only |
| `SUPABASE_JWKS_URL` | `https://kmcaoujnzpehuylaqrlx.supabase.co/auth/v1/.well-known/jwks.json` | Server only |
| `NEXT_PUBLIC_GEOAPIFY_KEY` | Geoapify → MyProjects → Artisto → API Keys | Browser-visible by design |

Never prefix the Supabase secret with `NEXT_PUBLIC_`. After the first Vercel
deployment, copy the stable production URL before testing Google sign-in.

## Supabase Auth URL configuration

In Supabase → Authentication → URL Configuration:

- Site URL: `https://<your-production-domain>`
- Redirect URLs:
  - `http://localhost:3000/**`
  - `http://127.0.0.1:3000/**`
  - `https://<your-vercel-project>.vercel.app/**`
  - `https://*-<your-vercel-team-or-account-slug>.vercel.app/**`
  - `https://<your-custom-domain>/**` when a custom domain is connected

Use the exact stable production domain for Site URL. The wildcard entry is for
Vercel preview deployments, while production should also have its explicit URL.

In Google Cloud Console → APIs & Services → Credentials → the Web OAuth client:

- Authorized redirect URI:
  `https://kmcaoujnzpehuylaqrlx.supabase.co/auth/v1/callback`
- Optional authorized JavaScript origins:
  - `http://localhost:3000`
  - `https://<your-production-domain>`

The Google redirect URI is the Supabase callback, not a Vercel URL. Keep the
Google client secret only in Supabase's Google provider configuration.

## Geoapify restrictions

The Geoapify key is used in the browser for map tiles, autocomplete, and reverse
geocoding. In Geoapify MyProjects, restrict it with allowed HTTP referrers/origins:

- `http://localhost:3000/*`
- `http://127.0.0.1:3000/*`
- `https://<your-production-domain>/*`
- the exact Vercel preview origins you intend to test

If the Geoapify restriction UI supports a wildcard for your project, use
`https://*.vercel.app/*` for previews. Otherwise add each active preview origin
or use a separate restricted preview key. Keep CORS enabled for those origins.

## Database migrations

The live project has the Artisto schema and security migrations applied. For a
new Supabase project, apply every SQL file in `supabase/migrations` in filename
order before deploying. The final migration grants the server-only
`service_role` exactly the table/storage privileges required by admin APIs.

## Pre-deploy command sequence

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Do not deploy if any command fails.
