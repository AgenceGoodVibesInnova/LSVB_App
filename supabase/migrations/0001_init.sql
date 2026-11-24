-- Billetterie LSVB : schéma initial
-- À exécuter dans Supabase > SQL Editor (ou via `supabase db push`).
-- Toutes les écritures passent par les routes d'API du site (clé « service »), jamais directement depuis le navigateur.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Équipe : administrateur (gestion + scan) et scan (bénévoles au contrôle / buvette)
-- ---------------------------------------------------------------------------
create table public.staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  role text not null check (role in ('admin', 'scan')),
  created_at timestamptz not null default now()
);

create or replace function public.staff_role()
returns text
language sql stable security definer set search_path = public
as $$ select role from public.staff where user_id = auth.uid() $$;

-- ---------------------------------------------------------------------------
-- Matchs
-- ---------------------------------------------------------------------------
create table public.events (
  id text primary key,
  name text not null,
  starts_at timestamptz not null,
  venue text not null default '',
  capacity int not null default 0 check (capacity >= 0),       -- 0 = pas de limite
  on_sale boolean not null default true,
  journee int,
  -- Prix en centimes ; une clé absente ou nulle = produit non proposé.
  -- full, reduced, child (billets) · bt, bs (formules) · b, s, t (à l'unité)
  prices jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Commandes et QR codes (un QR par billet et par article buvette)
-- ---------------------------------------------------------------------------
create table public.orders (
  id text primary key,                                          -- n° lisible, 8 caractères
  access_token text not null unique default encode(gen_random_bytes(18), 'hex'),  -- lien privé vers les billets
  event_id text not null references public.events (id),
  buyer_name text not null,
  email text not null,
  phone text,
  grp text,
  lines jsonb not null,
  total_cents int not null check (total_cents >= 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'cancelled')),
  pay_method text not null default 'sumup',                     -- sumup | demo | manuel
  sumup_checkout_id text,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  paid_at timestamptz,
  email_sent_at timestamptz
);
create index orders_event_idx on public.orders (event_id);
create index orders_email_idx on public.orders (lower(email));
create index orders_checkout_idx on public.orders (sumup_checkout_id);

create table public.passes (
  order_id text not null references public.orders (id) on delete cascade,
  idx int not null,
  kind text not null check (kind in ('ticket', 'food')),
  type text not null,
  label text not null,
  drink text,
  token text not null,
  used_at timestamptz,
  used_mode text,
  used_by uuid references auth.users (id),
  primary key (order_id, idx)
);

-- ---------------------------------------------------------------------------
-- Création d'une commande avec contrôle de la jauge (verrou sur le match : pas de survente)
-- ---------------------------------------------------------------------------
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
  insert into public.orders (id, event_id, buyer_name, email, phone, grp, lines, total_cents, is_demo, pay_method)
  values (p_order ->> 'id', ev.id, p_order ->> 'buyer_name', lower(p_order ->> 'email'), p_order ->> 'phone', p_order ->> 'grp',
          p_order -> 'lines', (p_order ->> 'total_cents')::int, coalesce((p_order ->> 'is_demo')::boolean, false),
          coalesce(p_order ->> 'pay_method', 'sumup'));
  insert into public.passes (order_id, idx, kind, type, label, drink, token)
  select p_order ->> 'id', (x ->> 'idx')::int, x ->> 'kind', x ->> 'type', x ->> 'label', x ->> 'drink', x ->> 'token'
  from jsonb_array_elements(p_passes) x;
  return query select o.id, o.access_token from public.orders o where o.id = p_order ->> 'id';
end;
$$;

-- Billets vendus (payés + en cours de paiement) par match
create or replace function public.event_sales(p_hold_minutes int default 30)
returns table (event_id text, sold int)
language sql stable security definer set search_path = public
as $$
  select o.event_id, count(*)::int
  from public.passes p join public.orders o on o.id = p.order_id
  where p.kind = 'ticket'
    and (o.status = 'paid' or (o.status = 'pending' and o.created_at > now() - make_interval(mins => p_hold_minutes)))
  group by o.event_id
$$;

revoke all on function public.create_order(jsonb, jsonb, int) from public, anon, authenticated;
grant execute on function public.create_order(jsonb, jsonb, int) to service_role;
revoke all on function public.event_sales(int) from public, anon, authenticated;
grant execute on function public.event_sales(int) to service_role;

-- ---------------------------------------------------------------------------
-- Règles d'accès (RLS) : lecture publique des matchs seulement ; le reste passe par l'API
-- ---------------------------------------------------------------------------
alter table public.staff  enable row level security;
alter table public.events enable row level security;
alter table public.orders enable row level security;
alter table public.passes enable row level security;

create policy staff_self_read on public.staff for select using (user_id = auth.uid() or public.staff_role() = 'admin');
create policy events_read on public.events for select using (on_sale or public.staff_role() is not null);
create policy orders_staff_read on public.orders for select using (public.staff_role() = 'admin');
create policy passes_staff_read on public.passes for select using (public.staff_role() is not null);
