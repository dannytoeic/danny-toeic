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

update public.student_accounts
set class_keys_by_month = jsonb_build_object(month_key, to_jsonb(class_keys))
where class_keys_by_month = '{}'::jsonb
  and month_key is not null
  and btrim(month_key) <> ''
  and class_keys is not null
  and array_length(class_keys, 1) > 0;

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
  ('2026-07', '600-monwed', '', '[
    {"id":"2026-07-600-monwed-day1","createdAt":"2026-07-01T00:00:00.000Z","isPinned":false,"dayLabel":"Day 1","dateLabel":"","noticeText":"","videos":[{"id":"2026-07-600-monwed-day1-rc","role":"rc","url":""},{"id":"2026-07-600-monwed-day1-lc","role":"lc","url":""}],"audios":[],"extras":[],"memoText":"","type":"lesson_day"},
    {"id":"2026-07-600-monwed-day2","createdAt":"2026-07-01T00:00:00.000Z","isPinned":false,"dayLabel":"Day 2","dateLabel":"","noticeText":"","videos":[{"id":"2026-07-600-monwed-day2-rc","role":"rc","url":""},{"id":"2026-07-600-monwed-day2-lc","role":"lc","url":""}],"audios":[],"extras":[],"memoText":"","type":"lesson_day"},
    {"id":"2026-07-600-monwed-day3","createdAt":"2026-07-01T00:00:00.000Z","isPinned":false,"dayLabel":"Day 3","dateLabel":"","noticeText":"","videos":[{"id":"2026-07-600-monwed-day3-rc","role":"rc","url":""},{"id":"2026-07-600-monwed-day3-lc","role":"lc","url":""}],"audios":[],"extras":[],"memoText":"","type":"lesson_day"},
    {"id":"2026-07-600-monwed-day4","createdAt":"2026-07-01T00:00:00.000Z","isPinned":false,"dayLabel":"Day 4","dateLabel":"","noticeText":"","videos":[{"id":"2026-07-600-monwed-day4-rc","role":"rc","url":""},{"id":"2026-07-600-monwed-day4-lc","role":"lc","url":""}],"audios":[],"extras":[],"memoText":"","type":"lesson_day"},
    {"id":"2026-07-600-monwed-day5","createdAt":"2026-07-01T00:00:00.000Z","isPinned":false,"dayLabel":"Day 5","dateLabel":"","noticeText":"","videos":[{"id":"2026-07-600-monwed-day5-rc","role":"rc","url":""},{"id":"2026-07-600-monwed-day5-lc","role":"lc","url":""}],"audios":[],"extras":[],"memoText":"","type":"lesson_day"},
    {"id":"2026-07-600-monwed-day6","createdAt":"2026-07-01T00:00:00.000Z","isPinned":false,"dayLabel":"Day 6","dateLabel":"","noticeText":"","videos":[{"id":"2026-07-600-monwed-day6-rc","role":"rc","url":""},{"id":"2026-07-600-monwed-day6-lc","role":"lc","url":""}],"audios":[],"extras":[],"memoText":"","type":"lesson_day"},
    {"id":"2026-07-600-monwed-day7","createdAt":"2026-07-01T00:00:00.000Z","isPinned":false,"dayLabel":"Day 7","dateLabel":"","noticeText":"","videos":[{"id":"2026-07-600-monwed-day7-rc","role":"rc","url":""},{"id":"2026-07-600-monwed-day7-lc","role":"lc","url":""}],"audios":[],"extras":[],"memoText":"","type":"lesson_day"},
    {"id":"2026-07-600-monwed-day8","createdAt":"2026-07-01T00:00:00.000Z","isPinned":false,"dayLabel":"Day 8","dateLabel":"","noticeText":"","videos":[{"id":"2026-07-600-monwed-day8-rc","role":"rc","url":""},{"id":"2026-07-600-monwed-day8-lc","role":"lc","url":""}],"audios":[],"extras":[],"memoText":"","type":"lesson_day"},
    {"id":"2026-07-600-monwed-day9","createdAt":"2026-07-01T00:00:00.000Z","isPinned":false,"dayLabel":"Day 9","dateLabel":"","noticeText":"","videos":[{"id":"2026-07-600-monwed-day9-rc","role":"rc","url":""},{"id":"2026-07-600-monwed-day9-lc","role":"lc","url":""}],"audios":[],"extras":[],"memoText":"","type":"lesson_day"}
  ]'),
  ('2026-07', '600-tuthu', '', '[
    {"id":"2026-07-600-tuthu-day1","createdAt":"2026-07-01T00:00:00.000Z","isPinned":false,"dayLabel":"Day 1","dateLabel":"","noticeText":"","videos":[{"id":"2026-07-600-tuthu-day1-rc","role":"rc","url":""},{"id":"2026-07-600-tuthu-day1-lc","role":"lc","url":""}],"audios":[],"extras":[],"memoText":"","type":"lesson_day"},
    {"id":"2026-07-600-tuthu-day2","createdAt":"2026-07-01T00:00:00.000Z","isPinned":false,"dayLabel":"Day 2","dateLabel":"","noticeText":"","videos":[{"id":"2026-07-600-tuthu-day2-rc","role":"rc","url":""},{"id":"2026-07-600-tuthu-day2-lc","role":"lc","url":""}],"audios":[],"extras":[],"memoText":"","type":"lesson_day"},
    {"id":"2026-07-600-tuthu-day3","createdAt":"2026-07-01T00:00:00.000Z","isPinned":false,"dayLabel":"Day 3","dateLabel":"","noticeText":"","videos":[{"id":"2026-07-600-tuthu-day3-rc","role":"rc","url":""},{"id":"2026-07-600-tuthu-day3-lc","role":"lc","url":""}],"audios":[],"extras":[],"memoText":"","type":"lesson_day"},
    {"id":"2026-07-600-tuthu-day4","createdAt":"2026-07-01T00:00:00.000Z","isPinned":false,"dayLabel":"Day 4","dateLabel":"","noticeText":"","videos":[{"id":"2026-07-600-tuthu-day4-rc","role":"rc","url":""},{"id":"2026-07-600-tuthu-day4-lc","role":"lc","url":""}],"audios":[],"extras":[],"memoText":"","type":"lesson_day"},
    {"id":"2026-07-600-tuthu-day5","createdAt":"2026-07-01T00:00:00.000Z","isPinned":false,"dayLabel":"Day 5","dateLabel":"","noticeText":"","videos":[{"id":"2026-07-600-tuthu-day5-rc","role":"rc","url":""},{"id":"2026-07-600-tuthu-day5-lc","role":"lc","url":""}],"audios":[],"extras":[],"memoText":"","type":"lesson_day"},
    {"id":"2026-07-600-tuthu-day6","createdAt":"2026-07-01T00:00:00.000Z","isPinned":false,"dayLabel":"Day 6","dateLabel":"","noticeText":"","videos":[{"id":"2026-07-600-tuthu-day6-rc","role":"rc","url":""},{"id":"2026-07-600-tuthu-day6-lc","role":"lc","url":""}],"audios":[],"extras":[],"memoText":"","type":"lesson_day"},
    {"id":"2026-07-600-tuthu-day7","createdAt":"2026-07-01T00:00:00.000Z","isPinned":false,"dayLabel":"Day 7","dateLabel":"","noticeText":"","videos":[{"id":"2026-07-600-tuthu-day7-rc","role":"rc","url":""},{"id":"2026-07-600-tuthu-day7-lc","role":"lc","url":""}],"audios":[],"extras":[],"memoText":"","type":"lesson_day"},
    {"id":"2026-07-600-tuthu-day8","createdAt":"2026-07-01T00:00:00.000Z","isPinned":false,"dayLabel":"Day 8","dateLabel":"","noticeText":"","videos":[{"id":"2026-07-600-tuthu-day8-rc","role":"rc","url":""},{"id":"2026-07-600-tuthu-day8-lc","role":"lc","url":""}],"audios":[],"extras":[],"memoText":"","type":"lesson_day"},
    {"id":"2026-07-600-tuthu-day9","createdAt":"2026-07-01T00:00:00.000Z","isPinned":false,"dayLabel":"Day 9","dateLabel":"","noticeText":"","videos":[{"id":"2026-07-600-tuthu-day9-rc","role":"rc","url":""},{"id":"2026-07-600-tuthu-day9-lc","role":"lc","url":""}],"audios":[],"extras":[],"memoText":"","type":"lesson_day"}
  ]'),
  ('2026-07', '800-monwed', '', '[
    {"id":"2026-07-800-monwed-day1","createdAt":"2026-07-01T00:00:00.000Z","isPinned":false,"dayLabel":"Day 1","dateLabel":"","noticeText":"","videos":[{"id":"2026-07-800-monwed-day1-main","role":"main","url":""}],"audios":[],"extras":[],"memoText":"","type":"lesson_day"},
    {"id":"2026-07-800-monwed-day2","createdAt":"2026-07-01T00:00:00.000Z","isPinned":false,"dayLabel":"Day 2","dateLabel":"","noticeText":"","videos":[{"id":"2026-07-800-monwed-day2-main","role":"main","url":""}],"audios":[],"extras":[],"memoText":"","type":"lesson_day"},
    {"id":"2026-07-800-monwed-day3","createdAt":"2026-07-01T00:00:00.000Z","isPinned":false,"dayLabel":"Day 3","dateLabel":"","noticeText":"","videos":[{"id":"2026-07-800-monwed-day3-main","role":"main","url":""}],"audios":[],"extras":[],"memoText":"","type":"lesson_day"},
    {"id":"2026-07-800-monwed-day4","createdAt":"2026-07-01T00:00:00.000Z","isPinned":false,"dayLabel":"Day 4","dateLabel":"","noticeText":"","videos":[{"id":"2026-07-800-monwed-day4-main","role":"main","url":""}],"audios":[],"extras":[],"memoText":"","type":"lesson_day"},
    {"id":"2026-07-800-monwed-day5","createdAt":"2026-07-01T00:00:00.000Z","isPinned":false,"dayLabel":"Day 5","dateLabel":"","noticeText":"","videos":[{"id":"2026-07-800-monwed-day5-main","role":"main","url":""}],"audios":[],"extras":[],"memoText":"","type":"lesson_day"},
    {"id":"2026-07-800-monwed-day6","createdAt":"2026-07-01T00:00:00.000Z","isPinned":false,"dayLabel":"Day 6","dateLabel":"","noticeText":"","videos":[{"id":"2026-07-800-monwed-day6-main","role":"main","url":""}],"audios":[],"extras":[],"memoText":"","type":"lesson_day"},
    {"id":"2026-07-800-monwed-day7","createdAt":"2026-07-01T00:00:00.000Z","isPinned":false,"dayLabel":"Day 7","dateLabel":"","noticeText":"","videos":[{"id":"2026-07-800-monwed-day7-main","role":"main","url":""}],"audios":[],"extras":[],"memoText":"","type":"lesson_day"},
    {"id":"2026-07-800-monwed-day8","createdAt":"2026-07-01T00:00:00.000Z","isPinned":false,"dayLabel":"Day 8","dateLabel":"","noticeText":"","videos":[{"id":"2026-07-800-monwed-day8-main","role":"main","url":""}],"audios":[],"extras":[],"memoText":"","type":"lesson_day"}
  ]'),
  ('2026-07', '800-tuthu', '', '[
    {"id":"2026-07-800-tuthu-day1","createdAt":"2026-07-01T00:00:00.000Z","isPinned":false,"dayLabel":"Day 1","dateLabel":"","noticeText":"","videos":[{"id":"2026-07-800-tuthu-day1-main","role":"main","url":""}],"audios":[],"extras":[],"memoText":"","type":"lesson_day"},
    {"id":"2026-07-800-tuthu-day2","createdAt":"2026-07-01T00:00:00.000Z","isPinned":false,"dayLabel":"Day 2","dateLabel":"","noticeText":"","videos":[{"id":"2026-07-800-tuthu-day2-main","role":"main","url":""}],"audios":[],"extras":[],"memoText":"","type":"lesson_day"},
    {"id":"2026-07-800-tuthu-day3","createdAt":"2026-07-01T00:00:00.000Z","isPinned":false,"dayLabel":"Day 3","dateLabel":"","noticeText":"","videos":[{"id":"2026-07-800-tuthu-day3-main","role":"main","url":""}],"audios":[],"extras":[],"memoText":"","type":"lesson_day"},
    {"id":"2026-07-800-tuthu-day4","createdAt":"2026-07-01T00:00:00.000Z","isPinned":false,"dayLabel":"Day 4","dateLabel":"","noticeText":"","videos":[{"id":"2026-07-800-tuthu-day4-main","role":"main","url":""}],"audios":[],"extras":[],"memoText":"","type":"lesson_day"},
    {"id":"2026-07-800-tuthu-day5","createdAt":"2026-07-01T00:00:00.000Z","isPinned":false,"dayLabel":"Day 5","dateLabel":"","noticeText":"","videos":[{"id":"2026-07-800-tuthu-day5-main","role":"main","url":""}],"audios":[],"extras":[],"memoText":"","type":"lesson_day"},
    {"id":"2026-07-800-tuthu-day6","createdAt":"2026-07-01T00:00:00.000Z","isPinned":false,"dayLabel":"Day 6","dateLabel":"","noticeText":"","videos":[{"id":"2026-07-800-tuthu-day6-main","role":"main","url":""}],"audios":[],"extras":[],"memoText":"","type":"lesson_day"},
    {"id":"2026-07-800-tuthu-day7","createdAt":"2026-07-01T00:00:00.000Z","isPinned":false,"dayLabel":"Day 7","dateLabel":"","noticeText":"","videos":[{"id":"2026-07-800-tuthu-day7-main","role":"main","url":""}],"audios":[],"extras":[],"memoText":"","type":"lesson_day"},
    {"id":"2026-07-800-tuthu-day8","createdAt":"2026-07-01T00:00:00.000Z","isPinned":false,"dayLabel":"Day 8","dateLabel":"","noticeText":"","videos":[{"id":"2026-07-800-tuthu-day8-main","role":"main","url":""}],"audios":[],"extras":[],"memoText":"","type":"lesson_day"}
  ]')
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
