begin;

create table if not exists public.promotion_area (
  area_key text primary key,
  is_enabled boolean not null default false,
  title text not null default '',
  images jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.promotion_area (area_key, is_enabled, title, images)
values ('main_pagoda_week', false, '파고다위크 안내', '[]'::jsonb)
on conflict (area_key) do nothing;

alter table public.promotion_area enable row level security;

grant select on table public.promotion_area to anon;
grant select on table public.promotion_area to authenticated;
grant select, insert, update, delete on table public.promotion_area to service_role;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'promotion_area'
      and policyname = 'promotion_area_anon_active_select'
  ) then
    create policy promotion_area_anon_active_select
      on public.promotion_area
      for select
      to anon
      using (
        is_enabled = true
        and jsonb_typeof(images) = 'array'
        and jsonb_array_length(images) > 0
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'promotion_area'
      and policyname = 'promotion_area_authenticated_active_select'
  ) then
    create policy promotion_area_authenticated_active_select
      on public.promotion_area
      for select
      to authenticated
      using (
        is_enabled = true
        and jsonb_typeof(images) = 'array'
        and jsonb_array_length(images) > 0
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'promotion_area'
      and policyname = 'promotion_area_service_role_all'
  ) then
    create policy promotion_area_service_role_all
      on public.promotion_area
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end $$;

commit;
