# TheCOE

The inner circle of **Anaplan** — a dedicated pairing site for North American hiring teams and the modelers, architects, and admins who run the platform. Architected to expand to other **EPM** platforms (Pigment, OneStream, Workday Adaptive, etc.) on demand.

**Free for everyone.** TheCOE is a free job board supported by display advertising; there are no posting fees, no subscription, and no transaction layer. Listings go through a quick admin moderation pass before going live to keep the board high-signal.

Stack: **Next.js** (App Router) on Vercel, **Supabase** (Postgres + Auth + Storage), **Resend** (transactional email), **Plausible** (privacy-friendly analytics), **Google AdSense** (display advertising — added in a follow-up pass).

## Go-live scope

The site launches as **Anaplan-only**. Other platforms are already seeded in the `public.platforms` table but marked `is_active = false` — they don't appear in public filters, employer job forms, or the public listings. Admin forms continue to show all platforms for internal testing.

To activate another platform later (e.g. Pigment):

```sql
update public.platforms set is_active = true where slug = 'pigment';
```

The platform filter dropdown auto-appears once more than one platform is active.

## Design

UI follows **Swiss / International Typographic Style** at a broad level: modular grid, neo-grotesque typography (Geist), neutral field, single accent, hairline borders, minimal motion. See the project build plan for full product constraints.

## Local development

```bash
cd web-apps/thecoe
npm install
cp .env.example .env.local
# Optional: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
# when you have a Supabase project. Without them, the app uses in-repo mock listings.
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Data source

- **No Supabase env:** `/jobs` uses **mock listings** from [`lib/dev-mock-data.ts`](./lib/dev-mock-data.ts) so you can build UI without cloud setup.
- **With Supabase env:** Run all SQL migrations under [`supabase/migrations/`](./supabase/migrations/) **in chronological order** in the Supabase SQL editor (or via the Supabase CLI). The list grows over time; the `payments_and_stripe` migration in the original go-live sequence is dropped by a later migration (`20260601120000_drop_payments_and_moderation_flow.sql`) when you migrate an existing dataset to the free / ad-supported model. On a fresh DB, applying everything in order yields the current schema with no payment tables.

  Then `/jobs` reads **live `open` jobs** from Postgres.

### Admin (Phase 3)

1. In **Authentication → Providers**, enable **Email** and create a user (email + password), or use the Auth API.
2. In the **SQL editor**, grant admin (uses `auth.users.id`):

   ```sql
   insert into public.admin_profiles (user_id)
   values ('<paste-user-uuid-from-auth-users>');
   ```

3. Under **Authentication → URL configuration**, add redirect URL: `http://localhost:3000/auth/callback` (and your production origin when you deploy).
4. Sign in at [`/login`](http://localhost:3000/login), then open [`/admin/jobs`](http://localhost:3000/admin/jobs) to manage organizations and listings.

Without Supabase env vars, `/admin/*` shows a short “configure Supabase” message instead of the dashboard.

### Employer dashboard (Phase 4)

1. Create the employer's organization at [`/admin/organizations/new`](http://localhost:3000/admin/organizations/new).
2. Create the user in **Supabase Studio → Authentication → Users** (email + password). Copy the user's UID.
3. Open **Admin → Organizations → Members**, paste the UID, pick `owner` or `member`, and add.
4. The user can now sign in at `/login` and manage drafts at `/employer/<slug>/jobs`.

Employer rules (enforced in RLS + server actions):

- Can only create/edit `employer`-kind listings for their org, always starting as `draft`.
- Cannot flip status to `open` or `rejected` — those transitions belong to the admin moderation queue (`/admin/moderation`).
- Can submit drafts and rejected listings for review (`pending_review`), withdraw a pending submission, pause a live listing (`unpublished`), and close live listings via the close-with-outcome flow.

### Public "Post a job" flow (Phase 6)

Anyone can start at [`/post`](http://localhost:3000/post) → [`/signup`](http://localhost:3000/signup). The signup form creates, in one atomic submission:

1. A Supabase Auth user (email + password).
2. A `public.organizations` row (scoped to one user — slug collision retries 5 times).
3. A `public.organization_members` row with `role = 'owner'`.

It then tries to sign the user in and land them on `/employer/<slug>/jobs/new?welcome=1`. If the Supabase project enforces email confirmation, they're routed to `/signup/verify` instead. The company workspace is already provisioned; they just need to confirm their email and sign in.

Admin-managed onboarding (`/admin/organizations/new` + `/admin/organizations/<id>/members`) remains available as the fallback for assisted onboarding.

### Moderation queue (free + ad-supported model)

Listings are free; the moderation queue replaces the old Stripe-checkout publish path.

Submission flow:

1. Employer fills in a draft (`/employer/<slug>/jobs/new` or `/edit`).
2. Employer clicks **Submit for review** — the listing's status flips to `pending_review`.
3. Confirmation page: `/employer/<slug>/jobs/<id>/submitted`.
4. Admin opens [`/admin/moderation`](http://localhost:3000/admin/moderation), reads the full description on the per-listing review page, and either:
   - **Approves** — status flips to `open`, `published_at` is stamped, and the listing appears on the public board immediately.
   - **Rejects** with a moderator note — status flips to `rejected` and the note is shown to the employer on their dashboard and edit page so they can rework and resubmit.
5. Employers can withdraw a submission (back to `draft`) at any time before a decision is made.

Defense in depth: the `apply_job_outcome` trigger refuses to record a close-with-outcome unless the job is currently `open`, so closing a draft or pending listing is a no-op.

### Discovery & SEO (Phase 7a)

- `/jobs` has a full-text search input backed by a Postgres `tsvector` (`websearch_to_tsquery`) generated column on title / summary / description / location.
- Sitemap at `/sitemap.xml` enumerates all `open` job URLs plus static pages. `robots.txt` allows crawling and disallows `/admin`, `/employer`, `/login`, `/signup`, `/api`, `/auth`.
- Employer-posted listings emit schema.org `JobPosting` JSON-LD for Google Jobs indexing (syndicated listings are intentionally excluded to avoid duplicate-content penalties).
- `NEXT_PUBLIC_APP_URL` is used as the canonical base; set it to your production origin before launch.

### Newsletter (Phase 7b)

- Public form at [`/newsletter`](http://localhost:3000/newsletter) with double opt-in.
- Confirmation flow: `subscribeToNewsletter` server action → email confirmation link → `/newsletter/confirm?token=...` marks `confirmed_at`.
- Unsubscribe flow: `/newsletter/unsubscribe?token=...` renders a POST form (to defeat email-client link prefetching).
- Admin counts and recent subscribers at [`/admin/newsletter`](http://localhost:3000/admin/newsletter).
- Email provider is pluggable via [`lib/email/send.ts`](./lib/email/send.ts). With `RESEND_API_KEY` unset, messages are logged to the server console (including the confirm link) — useful for local dev before you wire a provider.

### Job alerts (Phase 7c)

- From any filtered `/jobs` view, a CTA deep-links to [`/alerts`](http://localhost:3000/alerts) with the current filter set pre-selected.
- Double opt-in confirmation, unsubscribe via POST form (same pattern as newsletter).
- Filters are stored as JSONB so new filter dimensions can be added without migrations.
- Digest cron at `GET/POST /api/cron/job-alerts`, authenticated with `Authorization: Bearer $CRON_SECRET`. Weekly cadence, 20-job cap, dedupes against the previous digest. With no email provider configured, the cron runs end-to-end and logs outgoing emails to the console (nothing is lost).
- Admin summary and 50-row recent list at [`/admin/alerts`](http://localhost:3000/admin/alerts).

Local cron test:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/job-alerts
```

For production on Vercel, add to `vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/job-alerts", "schedule": "0 13 * * 1" },
    { "path": "/api/cron/profile-digest", "schedule": "0 14 * * 1" }
  ]
}
```

(Mondays at 09:00 ET for filter alerts, 10:00 ET for the profile-match digest.)

### Profile-match digest (Phase H)

- Weekly per-candidate digest of new Anaplan roles that match a candidate's
  profile (work auth + remote/hybrid/on-site preferences). Distinct from the
  filter-alerts digest above, which is anonymous and filter-driven.
- Opt-in is on by default; candidates can flip it from `/me/profile` →
  Email preferences. Stored on `candidate_profiles.digest_opt_in`.
- Send tracking: `digest_last_sent_at` enforces ≥6 days between sends and
  `digest_last_job_ids` dedupes job IDs across runs.
- Quiet weeks (zero matches) do **not** advance `digest_last_sent_at`, so
  the candidate doesn't lose a week's worth of cadence.
- Cron entry: `GET/POST /api/cron/profile-digest`, same `Bearer
  $CRON_SECRET` auth.

### Admin analytics dashboard (Phase J)

- `/admin/analytics` surfaces two views from
  [`supabase/migrations/20260510120000_analytics_views.sql`](./supabase/migrations/20260510120000_analytics_views.sql):
  - `job_time_to_first_applicant` — per-job latency from `published_at` to
    the first application. The page computes P25/P50/P75 across jobs that
    have at least one applicant, and lists open jobs still waiting at zero
    so admins can triage stale listings.
  - `applicant_funnel_role_family` — submitted/under-review/shortlisted/
    rejected/hired/withdrawn counts grouped by role family, with a hire
    rate that excludes withdrawn applications.
- Both views run with `security_invoker = on` so they inherit RLS from the
  underlying tables. Admins read the full picture via the admin RLS
  policies on `jobs` and `job_applications`.

### Observability & analytics (Phase 7d)

- **Structured logging.** All noteworthy server events (signup, moderation
  decisions, cron digests, failures) emit single-line JSON via
  [`lib/observability.ts`](./lib/observability.ts). Vercel Logs and most
  log-drain tools parse these automatically. To upgrade to Sentry, install
  `@sentry/nextjs` and forward `captureException` to `Sentry.captureException`
  — no other call sites need to change.
- **Privacy-friendly analytics.** Set `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` and the
  Plausible script loads globally from [`components/analytics.tsx`](./components/analytics.tsx).
  Cookieless, no consent banner required in most jurisdictions.

### Legal pages

- [`/privacy`](http://localhost:3000/privacy) and [`/terms`](http://localhost:3000/terms)
  ship with full working copy covering employer accounts, free listings,
  newsletter, job alerts, and a placeholder advertising/cookies disclosure
  ready to expand once display ads are wired up. These are drafts: have
  counsel review before go-live, especially sections 13 (governing law)
  and 11 (liability cap), which are placeholders you&rsquo;ll want to confirm
  with your lawyer.

## Scripts

| Command   | Description        |
| --------- | ------------------ |
| `npm run dev` | Development server |
| `npm run build` | Production build   |
| `npm run lint`  | ESLint               |

## Environment

See [`.env.example`](./.env.example). Client-exposed keys use the `NEXT_PUBLIC_` prefix. The service role key must only run on the server (e.g. webhooks, trusted scripts).

## Repository

Create a GitHub repository and set the remote from this monorepo path:

```bash
git remote add thecoe https://github.com/<org>/thecoe.git
git subtree push --prefix=web-apps/thecoe thecoe main
```

Alternatively keep `web-apps/thecoe` as the root of a standalone clone and push that directory’s history only (your choice).

## Migrations

SQL migrations live under [`supabase/migrations`](./supabase/migrations/).
