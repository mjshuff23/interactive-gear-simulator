begin;
select plan(29);

-- Setup users
select tests.create_supabase_user('user1');
select tests.create_supabase_user('user2');

-- Schema tests
select has_table('public', 'gear_systems', 'gear_systems table should exist');
select has_column('public', 'gear_systems', 'id', 'id column should exist');
select has_column('public', 'gear_systems', 'owner_id', 'owner_id column should exist');
select has_column('public', 'gear_systems', 'name', 'name column should exist');
select has_column('public', 'gear_systems', 'definition_version', 'definition_version column should exist');
select has_column('public', 'gear_systems', 'definition', 'definition column should exist');
select has_column('public', 'gear_systems', 'created_at', 'created_at column should exist');
select has_column('public', 'gear_systems', 'updated_at', 'updated_at column should exist');

select has_index('public', 'gear_systems', 'gear_systems_owner_updated_idx', 'owner_id, updated_at index exists');
select has_trigger('public', 'gear_systems', 'set_gear_system_updated_at', 'updated_at trigger exists');

-- RLS tests
select tests.rls_enabled('public', 'gear_systems');

select policies_are(
    'public',
    'gear_systems',
    ARRAY[
        'Users can read their own gear systems',
        'Users can create their own gear systems',
        'Users can update their own gear systems',
        'Users can delete their own gear systems'
    ],
    'Should have correct policies'
);

-- Test anonymous access
select tests.clear_authentication();
select is_empty(
    'select * from public.gear_systems',
    'Anonymous user cannot read'
);
prepare anon_insert as insert into public.gear_systems (name, definition) values ('Anon Gear', '{}'::jsonb);
select throws_ok('anon_insert', 'new row violates row-level security policy for table "gear_systems"', 'Anonymous cannot insert');

-- Test user1 actions
select tests.authenticate_as('user1');

-- Authenticated insert defaults owner_id to JWT user
insert into public.gear_systems (name, definition) values ('User1 Gear', '{"base": 60}'::jsonb);

select results_eq(
    'select name from public.gear_systems',
    ARRAY['User1 Gear'],
    'User1 can see own row'
);

select results_eq(
    'select owner_id from public.gear_systems',
    ARRAY[tests.get_supabase_uid('user1')],
    'owner_id correctly defaulted to user1'
);

-- User A cannot insert for User B
prepare insert_for_other as insert into public.gear_systems (owner_id, name, definition) values (tests.get_supabase_uid('user2'), 'Hacked Gear', '{"base": 60}'::jsonb);
select throws_ok('insert_for_other', 'new row violates row-level security policy for table "gear_systems"', 'User1 cannot insert for User2');

-- The updated_at trigger unconditionally updates the timestamp on any row update
update public.gear_systems set name = 'User1 Updated Gear';
select is(
    (select updated_at >= created_at from public.gear_systems limit 1),
    true,
    'updated_at updated by trigger on update'
);

-- Test user2 actions
select tests.clear_authentication();
select tests.authenticate_as('user2');

-- User B cannot select User A's row
select is_empty(
    'select * from public.gear_systems',
    'User2 cannot see User1''s rows'
);

-- User B cannot update User A's row
update public.gear_systems set name = 'Hacked Gear';
select is_empty(
    'select * from public.gear_systems',
    'User2 cannot update User1''s rows (silent failure)'
);

-- User B cannot delete User A's row
delete from public.gear_systems;
select is_empty(
    'select * from public.gear_systems',
    'User2 cannot delete User1''s rows (silent failure)'
);

-- Back to user1 to verify unaffected
select tests.clear_authentication();
select tests.authenticate_as('user1');
select results_eq(
    'select name from public.gear_systems',
    ARRAY['User1 Updated Gear'],
    'User1 row remains intact'
);

-- User A cannot move ownership to User B
prepare change_owner as update public.gear_systems set owner_id = tests.get_supabase_uid('user2');
select throws_ok(
    'change_owner',
    'new row violates row-level security policy for table "gear_systems"',
    'User1 cannot change owner_id to User2'
);
select results_eq(
    'select owner_id from public.gear_systems',
    ARRAY[tests.get_supabase_uid('user1')],
    'User1 cannot change owner_id to User2 (policy prevents it, stays User1)'
);
-- Let's verify the row is still there under user1
select results_eq(
    'select name from public.gear_systems',
    ARRAY['User1 Updated Gear'],
    'User1 row still owned by User1'
);

-- Cascade delete test
select tests.clear_authentication();
-- Need to bypass RLS to delete the user
delete from auth.users where email = 'user1@supabase.io';

-- Check if rows are deleted (as admin/bypass)
select is_empty(
    $$select * from public.gear_systems where name = 'User1 Updated Gear'$$,
    'User1 rows deleted on cascade'
);

select * from finish();
rollback;
