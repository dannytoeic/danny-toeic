create extension if not exists "pgcrypto";

create table if not exists public.invest_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  brokerage text not null default '한국투자증권',
  account_type text not null check (account_type in ('위탁', 'ISA', '연금', 'CMA', '기타')),
  role text not null,
  cash_amount numeric(18, 2) not null default 0,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invest_holdings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.invest_accounts(id) on delete cascade,
  symbol text not null,
  name text not null,
  asset_class text not null check (asset_class in ('반도체', '미국ETF', '현금', '스윙', '기타')),
  quantity numeric(18, 6) not null default 0,
  avg_price numeric(18, 2) not null default 0,
  current_price numeric(18, 2) not null default 0,
  target_weight numeric(8, 4) not null default 0,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invest_cash (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.invest_accounts(id) on delete cascade,
  amount numeric(18, 2) not null default 0,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invest_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade unique,
  total_capital numeric(18, 2) not null default 50000000,
  defensive_cash_target_type text not null check (defensive_cash_target_type in ('percentage', 'fixed')) default 'percentage',
  defensive_cash_target_value numeric(18, 2) not null default 20,
  semiconductor_max_weight numeric(8, 4) not null default 60,
  us_etf_target_weight numeric(8, 4) not null default 38,
  swing_max_weight numeric(8, 4) not null default 5,
  yearly_target_rate numeric(8, 4) not null default 114,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invest_watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  name text not null,
  market text not null default 'KR',
  category text not null,
  alert_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invest_alert_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  symbol text not null,
  rule_type text not null,
  threshold_value numeric(18, 4) not null,
  action_message text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invest_alert_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  rule_id uuid references public.invest_alert_rules(id) on delete set null,
  symbol text not null,
  message text not null,
  severity text not null check (severity in ('info', 'warning', 'danger')),
  triggered_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists public.invest_buy_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references public.invest_accounts(id) on delete set null,
  symbol text not null,
  name text not null,
  planned_amount numeric(18, 2) not null default 0,
  planned_quantity numeric(18, 6) not null default 0,
  planned_date date not null,
  status text not null default 'planned',
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.invest_market_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  symbol text not null,
  price numeric(18, 2) not null,
  change_rate numeric(10, 4),
  high_1m numeric(18, 2),
  high_3m numeric(18, 2),
  high_6m numeric(18, 2),
  drawdown_from_3m_high numeric(10, 4),
  ma20 numeric(18, 2),
  ma60 numeric(18, 2),
  captured_at timestamptz not null default now()
);

alter table public.invest_accounts enable row level security;
alter table public.invest_holdings enable row level security;
alter table public.invest_cash enable row level security;
alter table public.invest_settings enable row level security;
alter table public.invest_watchlist enable row level security;
alter table public.invest_alert_rules enable row level security;
alter table public.invest_alert_logs enable row level security;
alter table public.invest_buy_plans enable row level security;
alter table public.invest_market_snapshots enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.invest_accounts,
  public.invest_holdings,
  public.invest_cash,
  public.invest_settings,
  public.invest_watchlist,
  public.invest_alert_rules,
  public.invest_alert_logs,
  public.invest_buy_plans,
  public.invest_market_snapshots
to authenticated;

revoke all on
  public.invest_accounts,
  public.invest_holdings,
  public.invest_cash,
  public.invest_settings,
  public.invest_watchlist,
  public.invest_alert_rules,
  public.invest_alert_logs,
  public.invest_buy_plans,
  public.invest_market_snapshots
from anon;

create policy "invest_accounts_owner_select" on public.invest_accounts for select to authenticated using (auth.uid() = user_id);
create policy "invest_accounts_owner_insert" on public.invest_accounts for insert to authenticated with check (auth.uid() = user_id);
create policy "invest_accounts_owner_update" on public.invest_accounts for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "invest_accounts_owner_delete" on public.invest_accounts for delete to authenticated using (auth.uid() = user_id);

create policy "invest_holdings_owner_select" on public.invest_holdings for select to authenticated using (auth.uid() = user_id);
create policy "invest_holdings_owner_insert" on public.invest_holdings for insert to authenticated with check (auth.uid() = user_id);
create policy "invest_holdings_owner_update" on public.invest_holdings for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "invest_holdings_owner_delete" on public.invest_holdings for delete to authenticated using (auth.uid() = user_id);

create policy "invest_cash_owner_all" on public.invest_cash for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "invest_settings_owner_all" on public.invest_settings for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "invest_watchlist_owner_all" on public.invest_watchlist for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "invest_alert_rules_owner_all" on public.invest_alert_rules for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "invest_alert_logs_owner_all" on public.invest_alert_logs for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "invest_buy_plans_owner_all" on public.invest_buy_plans for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "invest_market_snapshots_owner_all" on public.invest_market_snapshots for all to authenticated using (auth.uid() = user_id or user_id is null) with check (auth.uid() = user_id);
