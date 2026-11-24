-- Billetterie LSVB : comptes clients et réglages
-- À exécuter dans Supabase > SQL Editor, après 0001_init.sql.

-- ---------------------------------------------------------------------------
-- Profils clients (créés automatiquement à l'inscription)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  first_name text,
  last_name text,
  phone text,
  welcome_sent_at timestamptz,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, first_name, last_name, phone)
  values (
    new.id,
    lower(new.email),
    new.raw_user_meta_data ->> 'first_name',
    new.raw_user_meta_data ->> 'last_name',
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Comptes déjà existants (équipe) : profil créé une fois
insert into public.profiles (id, email)
select id, lower(email) from auth.users
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Commandes rattachées au compte (les commandes sans compte restent possibles)
-- ---------------------------------------------------------------------------
alter table public.orders add column if not exists user_id uuid references auth.users (id) on delete set null;
create index if not exists orders_user_idx on public.orders (user_id);

-- create_order accepte désormais le compte de l'acheteur
create or replace function public.create_order(p_order jsonb, p_passes jsonb, p_hold_minutes int default 30)
returns table (id text, access_token text)
language plpgsql
security definer set search_path = public
as $$
declare
  ev public.events;
  wanted int;
  sold int;
begin
  select * into ev from public.events e where e.id = p_order ->> 'event_id' for update;
  if not found or not ev.on_sale then raise exception 'EVENT_CLOSED'; end if;
  if ev.capacity > 0 then
    select count(*) into wanted from jsonb_array_elements(p_passes) x where x ->> 'kind' = 'ticket';
    select count(*) into sold from public.passes p join public.orders o on o.id = p.order_id
      where o.event_id = ev.id and p.kind = 'ticket'
        and (o.status = 'paid' or (o.status = 'pending' and o.created_at > now() - make_interval(mins => p_hold_minutes)));
    if sold + wanted > ev.capacity then raise exception 'SOLD_OUT'; end if;
  end if;
  insert into public.orders (id, event_id, user_id, buyer_name, email, phone, grp, lines, total_cents, is_demo, pay_method)
  values (p_order ->> 'id', ev.id, nullif(p_order ->> 'user_id', '')::uuid, p_order ->> 'buyer_name', lower(p_order ->> 'email'),
          p_order ->> 'phone', p_order ->> 'grp', p_order -> 'lines', (p_order ->> 'total_cents')::int,
          coalesce((p_order ->> 'is_demo')::boolean, false), coalesce(p_order ->> 'pay_method', 'sumup'));
  insert into public.passes (order_id, idx, kind, type, label, drink, token)
  select p_order ->> 'id', (x ->> 'idx')::int, x ->> 'kind', x ->> 'type', x ->> 'label', x ->> 'drink', x ->> 'token'
  from jsonb_array_elements(p_passes) x;
  return query select o.id, o.access_token from public.orders o where o.id = p_order ->> 'id';
end;
$$;
revoke all on function public.create_order(jsonb, jsonb, int) from public, anon, authenticated;
grant execute on function public.create_order(jsonb, jsonb, int) to service_role;

-- ---------------------------------------------------------------------------
-- Réglages de la billetterie (une seule ligne)
-- ---------------------------------------------------------------------------
create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  account_required boolean not null default false,   -- compte client obligatoire pour acheter
  contact_email text,
  updated_at timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Règles d'accès
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.settings enable row level security;
create policy profiles_self_read on public.profiles for select using (id = auth.uid() or public.staff_role() = 'admin');
create policy profiles_self_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy settings_read on public.settings for select using (true);
create policy orders_self_read on public.orders for select using (user_id = auth.uid());
