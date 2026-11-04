# ScholarTasks

AI college planning for students and parents. Grades, test prep, scholarships, state aid, applications and deadline reminders in one app.

Website: https://scholartasks.com

## What's here

| Folder | What it is |
| --- | --- |
| `packages/core` | The rules engine shared by web and phone: state-pack schema, scholarship GPA calculator, program eligibility, reminder schedule |
| `packs/states`, `packs/regions` | State and region packs (data, not code). Georgia and the Academic Common Market are drafts |
| `supabase/migrations` | Database schema: parent-owned family accounts, student permissions, row-level security, tamper-evident audit log |
| `supabase/tests` | Database checks for permissions and the audit log |
| `apps/web` | Website (Next.js): Georgia HOPE / Zell Miller checker, sign-in, parent family page (add children, invite codes, permissions), student join page |
| `apps/mobile` | Phone app (Expo), not started yet |

Planning documents: [market research](https://claude.ai/artifact/JPXxjFU7KnEGAmu5fr5kDz), [product plan](https://claude.ai/artifact/6MVmoDnFyhei4Sen2zzNiq), [MVP build spec](https://claude.ai/artifact/3FGoj7yxL9nBxufCAgCqXu).

## Run it

```sh
pnpm install
pnpm validate-packs     # checks every state and region pack
pnpm test               # rules engine tests
pnpm --filter @scholartasks/web dev   # website on http://localhost:3000
./supabase/tests/run.sh # database checks (needs a local PostgreSQL; set PGHOST/PGUSER)
```

## Turning on sign-in

Sign-in uses Supabase (email links, no passwords).

1. Create a free project at supabase.com.
2. Run the files in `supabase/migrations` in order (SQL editor, or `supabase db push`).
3. Copy `apps/web/.env.example` to `apps/web/.env.local` and fill in the project URL and anon key.

Without the keys, the sign-in, family and join pages show a "not connected yet" notice.

## Turning on payments (Stripe)

Plans live at `/billing`: Family plan ($12.99/month or $99/year), the Study Coach add-on ($4.99/month or $39/year) and 100 extra AI messages ($2.99). Prices are in `apps/web/lib/billing.ts`.

1. In Stripe (test mode first), copy the secret key into Vercel as `STRIPE_SECRET_KEY`.
2. Add a webhook endpoint `https://<site>/api/billing/webhook` with events `checkout.session.completed`, `checkout.session.async_payment_succeeded` and `customer.subscription.*`, and put its signing secret in Vercel as `STRIPE_WEBHOOK_SECRET`.
3. Save the Customer portal settings in Stripe once, so Manage billing works.

Paid message packs are used only after a person's free daily AI uses run out. Nothing is locked behind a plan yet; that switch comes before launch.

## Switching on a new state

Nothing state-specific lives in app code. To add a state:

1. Copy `packs/states/GA.json` to `packs/states/XX.json` and fill in its programs, GPA formula, forms and deadlines, with a `source_url` for each program.
2. Run `pnpm validate-packs` and add test transcripts for the state's GPA formula in `packages/core/test`.
3. Have a reviewer verify every value against the state agency, then set `verification.last_verified`.
4. Move `status` from `draft` to `review`, then `beta` (invited schools only), then `live`.

A pack cannot be `live` without a verification date; validation refuses it.

## Data status

All pack data is **draft** and taken from third-party summaries. It must be verified with each state agency (for Georgia, GSFC) before any student relies on it.
