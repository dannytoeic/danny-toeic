begin;

alter table public.class_updates
  add column if not exists year_month text;

update public.class_updates
set year_month = '2026-05'
where year_month is null or btrim(year_month) = '';

alter table public.class_updates
  alter column year_month set not null;

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
  ('2026-06', '800-tuthu', '', '[]')
on conflict (year_month, class_key) do nothing;

alter table public.class_updates enable row level security;

grant select on table public.class_updates to anon;
grant select, insert, update, delete on table public.class_updates to authenticated;
grant select, insert, update, delete on table public.class_updates to service_role;

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
end $$;

commit;
