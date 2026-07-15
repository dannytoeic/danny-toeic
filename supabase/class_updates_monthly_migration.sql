begin;

alter table public.class_updates
  add column if not exists year_month text;

update public.class_updates
set year_month = '2026-05'
where year_month is null or btrim(year_month) = '';

alter table public.class_updates
  alter column year_month set not null;

alter table public.student_accounts
  add column if not exists class_keys_by_month jsonb not null default '{}'::jsonb;

create table if not exists public.student_month_permissions (
  student_id text,
  username text not null,
  year_month text not null,
  class_keys jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (username, year_month)
);

create table if not exists public.student_class_access_ranges (
  id uuid primary key default gen_random_uuid(),
  student_id text not null,
  year_month text not null,
  class_key text not null,
  start_card_id text,
  start_order integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, year_month, class_key)
);

update public.student_accounts
set class_keys_by_month = jsonb_build_object(month_key, to_jsonb(class_keys))
where class_keys_by_month = '{}'::jsonb
  and month_key is not null
  and btrim(month_key) <> ''
  and class_keys is not null
  and array_length(class_keys, 1) > 0;

insert into public.student_month_permissions (student_id, username, year_month, class_keys)
select
  student_id,
  username,
  permissions.key,
  permissions.value
from public.student_accounts
cross join lateral jsonb_each(class_keys_by_month) as permissions(key, value)
where username is not null
  and btrim(username) <> ''
  and jsonb_typeof(permissions.value) = 'array'
on conflict (username, year_month) do update
set
  student_id = excluded.student_id,
  class_keys = excluded.class_keys,
  updated_at = now();

do $$
declare
  constraint_row record;
  index_row record;
begin
  for constraint_row in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'class_updates'
      and con.contype in ('p', 'u')
      and (
        select array_agg(att.attname order by keys.ordinality)
        from unnest(con.conkey) with ordinality as keys(attnum, ordinality)
        join pg_attribute att
          on att.attrelid = con.conrelid
         and att.attnum = keys.attnum
      ) = array['class_key']
  loop
    execute format(
      'alter table public.class_updates drop constraint %I',
      constraint_row.conname
    );
  end loop;

  for index_row in
    select idx_rel.relname as index_name
    from pg_index idx
    join pg_class idx_rel on idx_rel.oid = idx.indexrelid
    join pg_class tbl on tbl.oid = idx.indrelid
    join pg_namespace nsp on nsp.oid = tbl.relnamespace
    where nsp.nspname = 'public'
      and tbl.relname = 'class_updates'
      and idx.indisunique
      and not exists (
        select 1
        from pg_constraint con
        where con.conindid = idx.indexrelid
      )
      and (
        select array_agg(att.attname order by keys.ordinality)
        from unnest(idx.indkey) with ordinality as keys(attnum, ordinality)
        join pg_attribute att
          on att.attrelid = idx.indrelid
         and att.attnum = keys.attnum
      ) = array['class_key']
  loop
    execute format('drop index if exists public.%I', index_row.index_name);
  end loop;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'class_updates'
      and con.conname = 'class_updates_year_month_class_key_key'
  ) then
    alter table public.class_updates
      add constraint class_updates_year_month_class_key_key
      unique (year_month, class_key);
  end if;
end $$;

insert into public.class_updates (year_month, class_key, global_notice_text, cards)
values
  ('2026-05', '600-monwed', '', '[]'),
  ('2026-05', '600-tuthu', '', '[]'),
  ('2026-05', '800-monwed', '', '[]'),
  ('2026-05', '800-tuthu', '', '[]'),
  ('2026-06', '600-monwed', '', '[]'),
  ('2026-06', '600-tuthu', '', '[]'),
  ('2026-06', '800-monwed', '', '[]'),
  ('2026-06', '800-tuthu', '', '[]'),
  ('2026-07', '600-monwed', '', '[]'),
  ('2026-07', '600-tuthu', '', '[]'),
  ('2026-07', '800-monwed', '', '[]'),
  ('2026-07', '800-tuthu', '', '[]')
on conflict (year_month, class_key) do nothing;

alter table public.class_updates enable row level security;
alter table public.student_month_permissions enable row level security;
alter table public.student_class_access_ranges enable row level security;

grant select on table public.class_updates to anon;
grant select, insert, update, delete on table public.class_updates to authenticated;
grant select, insert, update, delete on table public.class_updates to service_role;
grant select, insert, update, delete on table public.student_month_permissions to authenticated;
grant select, insert, update, delete on table public.student_month_permissions to service_role;
grant select, insert, update, delete on table public.student_class_access_ranges to authenticated;
grant select, insert, update, delete on table public.student_class_access_ranges to service_role;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'class_updates'
      and policyname = 'class_updates_anon_select'
  ) then
    create policy class_updates_anon_select
      on public.class_updates
      for select
      to anon
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'class_updates'
      and policyname = 'class_updates_authenticated_select'
  ) then
    create policy class_updates_authenticated_select
      on public.class_updates
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'class_updates'
      and policyname = 'class_updates_service_role_all'
  ) then
    create policy class_updates_service_role_all
      on public.class_updates
      for all
      to service_role
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'student_month_permissions'
      and policyname = 'student_month_permissions_service_role_all'
  ) then
    create policy student_month_permissions_service_role_all
      on public.student_month_permissions
      for all
      to service_role
      using (true)
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'student_class_access_ranges'
      and policyname = 'student_class_access_ranges_service_role_all'
  ) then
    create policy student_class_access_ranges_service_role_all
      on public.student_class_access_ranges
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

commit;
