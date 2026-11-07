-- Family plan price levels (Constant, 2026-11-07). One family price, set by the oldest student's
-- grade: explore (grades 6-8), build (9-10), apply (11-12). The level a family pays for, and the
-- notice of a coming level change, are kept on the Stripe subscription and copied here so the
-- Plan and billing page and Home can show them. Parents can already read their own rows
-- (billing_subscriptions_parent_read); only the server writes.
-- level_notice: {"from","to","student","grade","cents","interval","starts_on","sent_on"} — shown
-- on Home and the billing page until starts_on (the next billing date, when the new price starts).

alter table billing_subscriptions add column if not exists level text check (level in ('explore', 'build', 'apply'));
alter table billing_subscriptions add column if not exists level_notice jsonb;
