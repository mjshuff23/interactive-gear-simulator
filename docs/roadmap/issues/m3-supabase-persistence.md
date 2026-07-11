# Goal

Add Supabase-backed saved gear systems using TypeScript client code and secure Postgres RLS.

## Deliverables

- Supabase auth flow.
- `gear_systems` table with `owner_id`, `name`, `definition`, thumbnail URL, and timestamps.
- RLS policies for owner-only select, insert, update, and delete.
- Save, load, rename, and delete UI flows.
- TypeScript persistence tests with mocked Supabase client first.

## Acceptance Criteria

- Browser uses only publishable Supabase credentials.
- Service role keys are never exposed to Vite env vars.
- RLS uses `to authenticated` and owner checks with `(select auth.uid())`.
- Save/load works against a real Supabase project after env vars are configured, Supabase Auth is wired, and the user has an authenticated session.
