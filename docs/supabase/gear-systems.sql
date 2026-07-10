-- Planned Supabase schema for saved gear systems.
-- Apply through the Supabase CLI or SQL editor after a project exists.
-- The local environment does not currently include the Supabase CLI.

create table if not exists public.gear_systems (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  definition jsonb not null,
  thumbnail_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_gear_system_owner_id()
returns trigger
language plpgsql
security invoker
as $$
begin
  if new.owner_id is null then
    new.owner_id := auth.uid();
  end if;

  return new;
end;
$$;

drop trigger if exists set_gear_system_owner_id on public.gear_systems;

create trigger set_gear_system_owner_id
before insert on public.gear_systems
for each row
execute function public.set_gear_system_owner_id();

create or replace function public.set_gear_system_updated_at()
returns trigger
language plpgsql
security invoker
as $$
begin
  new.updated_at := now();

  return new;
end;
$$;

drop trigger if exists set_gear_system_updated_at on public.gear_systems;

create trigger set_gear_system_updated_at
before update on public.gear_systems
for each row
execute function public.set_gear_system_updated_at();

create index if not exists gear_systems_owner_updated_idx
on public.gear_systems (owner_id, updated_at desc);

alter table public.gear_systems enable row level security;

grant select, insert, update, delete on public.gear_systems to authenticated;

create policy "Users can read their own gear systems"
on public.gear_systems
for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy "Users can create their own gear systems"
on public.gear_systems
for insert
to authenticated
with check ((select auth.uid()) = owner_id);

create policy "Users can update their own gear systems"
on public.gear_systems
for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "Users can delete their own gear systems"
on public.gear_systems
for delete
to authenticated
using ((select auth.uid()) = owner_id);
