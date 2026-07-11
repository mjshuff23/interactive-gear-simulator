create table public.gear_systems (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,
  name text not null
    check (char_length(trim(name)) between 1 and 120),
  definition_version smallint not null default 1
    check (definition_version = 1),
  definition jsonb not null
    check (jsonb_typeof(definition) = 'object')
    check (octet_length(definition::text) <= 1048576),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create trigger set_gear_system_updated_at
before update on public.gear_systems
for each row
execute function public.set_gear_system_updated_at();

create index gear_systems_owner_updated_idx
on public.gear_systems (owner_id, updated_at desc, id);

alter table public.gear_systems enable row level security;

revoke all on public.gear_systems from anon;
grant select, insert, update, delete on public.gear_systems to authenticated;

create policy "Users can read their own gear systems"
on public.gear_systems
for select
to authenticated
using (
  (select auth.uid()) is not null
  and (select auth.uid()) = owner_id
);

create policy "Users can create their own gear systems"
on public.gear_systems
for insert
to authenticated
with check (
  (select auth.uid()) is not null
  and (select auth.uid()) = owner_id
);

create policy "Users can update their own gear systems"
on public.gear_systems
for update
to authenticated
using (
  (select auth.uid()) is not null
  and (select auth.uid()) = owner_id
)
with check (
  (select auth.uid()) is not null
  and (select auth.uid()) = owner_id
);

create policy "Users can delete their own gear systems"
on public.gear_systems
for delete
to authenticated
using (
  (select auth.uid()) is not null
  and (select auth.uid()) = owner_id
);
