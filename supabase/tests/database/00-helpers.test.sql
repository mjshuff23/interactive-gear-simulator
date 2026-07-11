begin;

select plan(0);

create schema if not exists tests;

create or replace function tests.get_supabase_uid(identifier text) returns uuid as $$
begin
    return md5(identifier)::uuid;
end;
$$ language plpgsql;

create or replace function tests.create_supabase_user(identifier text) returns void as $$
declare
    user_id uuid;
begin
    user_id := tests.get_supabase_uid(identifier);
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
    values (user_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', identifier || '@supabase.io', 'encrypted_password', now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
    insert into auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), user_id, format('{"sub":"%s","email":"%s"}', user_id::text, identifier || '@supabase.io')::jsonb, 'email', now(), now(), now());
end;
$$ language plpgsql;

create or replace function tests.authenticate_as(identifier text) returns void as $$
declare
    user_id uuid;
begin
    user_id := tests.get_supabase_uid(identifier);
    perform set_config('request.jwt.claims', format('{"sub":"%s","email":"%s","role":"authenticated"}', user_id::text, identifier || '@supabase.io'), true);
    perform set_config('role', 'authenticated', true);
end;
$$ language plpgsql;

create or replace function tests.clear_authentication() returns void as $$
begin
    perform set_config('request.jwt.claims', '', true);
    perform set_config('role', 'anon', true);
end;
$$ language plpgsql;

create or replace function tests.rls_enabled(schema_name text, table_name text) returns text as $$
begin
    return is(
        (select relrowsecurity from pg_class where relname = table_name and relnamespace = (select oid from pg_namespace where nspname = schema_name)),
        true,
        format('RLS should be enabled on %I.%I', schema_name, table_name)
    );
end;
$$ language plpgsql;

select * from finish();

-- IMPORTANT: We COMMIT instead of ROLLBACK here so that the 'tests' schema 
-- and its functions persist for the subsequent test files!
commit;
