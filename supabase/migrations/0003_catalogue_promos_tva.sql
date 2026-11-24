-- Billetterie LSVB : catalogue géré depuis l'admin, TVA, codes promo, fins de vente, tickets de caisse
-- À exécuter dans Supabase > SQL Editor, après 0002_comptes.sql.

-- ---------------------------------------------------------------------------
-- Catalogue : billets, menus, boissons, snacks, confiserie, boutique
-- ---------------------------------------------------------------------------
create table if not exists public.products (
  id text primary key,
  category text not null check (category in ('billet', 'menu', 'boisson', 'snack', 'confiserie', 'boutique')),
  name text not null,
  description text,
  icon text,
  price_cents int not null check (price_cents >= 0),
  vat_rate numeric(4,2) not null check (vat_rate >= 0 and vat_rate < 100),   -- en %, ex. 5.5, 10, 20
  choice text check (choice in ('boisson', 'option')),   -- boisson : au choix parmi les boissons ; option : liste ci-dessous (tailles…)
  choice_label text,                                       -- ex. « Taille »
  options text[] not null default '{}',
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

-- Taux par défaut (à faire valider par l'expert-comptable du club) :
-- billetterie d'une manifestation sportive 5,5 % ; vente à emporter à consommer de suite 10 % ;
-- confiserie et textile 20 %.
insert into public.products (id, category, name, description, icon, price_cents, vat_rate, choice, choice_label, options, sort) values
  ('full',     'billet',     'Plein tarif',                'Adulte',                 '🎟️', 1000, 5.5,  null, null, '{}', 10),
  ('reduced',  'billet',     'Tarif réduit',               'Sur justificatif',       '🎟️',  700, 5.5,  null, null, '{}', 20),
  ('child',    'billet',     'Enfant',                     'Moins de 12 ans',        '🧒',  400, 5.5,  null, null, '{}', 30),
  ('bt',       'menu',       'Tacos + boisson offerte',    null,                     '🌮🥤', 800, 10,  'boisson', 'Boisson', '{}', 10),
  ('bs',       'menu',       'Sandwich + boisson offerte', null,                     '🥪🥤', 500, 10,  'boisson', 'Boisson', '{}', 20),
  ('pepsi',    'boisson',    'Pepsi',                      'Canette 33 cl',          '🥤',  250, 10,   null, null, '{}', 10),
  ('orangina', 'boisson',    'Orangina',                   'Canette 33 cl',          '🍊',  250, 10,   null, null, '{}', 20),
  ('jus',      'boisson',    'Jus de fruit',               null,                     '🧃',  250, 10,   null, null, '{}', 30),
  ('icetea',   'boisson',    'Ice Tea',                    'Canette 33 cl',          '🧋',  250, 10,   null, null, '{}', 40),
  ('s',        'snack',      'Sandwich',                   null,                     '🥪',  500, 10,   null, null, '{}', 10),
  ('t',        'snack',      'Tacos',                      null,                     '🌮',  800, 10,   null, null, '{}', 20),
  ('bonbons',  'confiserie', 'Sachet de bonbons',          null,                     '🍬',  200, 20,   null, null, '{}', 10),
  ('tshirt',   'boutique',   'T-shirt LSVB',               'Le t-shirt du club',     '👕', 2000, 20,   'option', 'Taille', '{S,M,L,XL,XXL}', 10)
on conflict (id) do nothing;

-- Les prix par match deviennent des exceptions au catalogue :
-- clé absente = prix du catalogue ; null = produit non proposé pour ce match ; nombre = prix spécial (centimes).
update public.events set prices = '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- Fins de vente par match
-- ---------------------------------------------------------------------------
alter table public.events add column if not exists sales_end_at timestamptz;   -- vide = jusqu'au début du match
alter table public.events add column if not exists shop_end_at timestamptz;    -- buvette et boutique ; vide = 3 jours avant le match

-- ---------------------------------------------------------------------------
-- Codes promo
-- ---------------------------------------------------------------------------
create table if not exists public.promo_codes (
  code text primary key check (code = upper(code) and code ~ '^[A-Z0-9_-]{2,30}$'),
  label text,
  kind text not null check (kind in ('percent', 'amount')),
  value int not null check (value > 0),                -- % (1-100) ou centimes
  scope text not null default 'billets' check (scope in ('billets', 'tout')),
  event_id text references public.events (id) on delete cascade,   -- vide = tous les matchs
  valid_from timestamptz,
  valid_until timestamptz,
  max_uses int check (max_uses is null or max_uses > 0),           -- vide = illimité
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Commandes : remise, TVA, n° de ticket de caisse ; QR boutique
-- ---------------------------------------------------------------------------
alter table public.orders add column if not exists subtotal_cents int;
alter table public.orders add column if not exists discount_cents int not null default 0;
alter table public.orders add column if not exists promo_code text;
alter table public.orders add column if not exists vat jsonb not null default '[]'::jsonb;  -- [{rate, ht_cents, vat_cents, ttc_cents}]
alter table public.orders add column if not exists receipt_no text unique;
update public.orders set subtotal_cents = total_cents where subtotal_cents is null;
create index if not exists orders_promo_idx on public.orders (promo_code);

alter table public.passes drop constraint if exists passes_kind_check;
alter table public.passes add constraint passes_kind_check check (kind in ('ticket', 'food', 'shop'));

-- Numérotation continue des tickets de caisse, par année : LSVB-2026-000001
create table if not exists public.receipt_counters (year int primary key, last int not null default 0);

create or replace function public.assign_receipt(p_order text)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  y int := extract(year from now() at time zone 'Europe/Paris');
  n int;
  existing text;
begin
  select receipt_no into existing from public.orders where id = p_order for update;
  if existing is not null then return existing; end if;
  insert into public.receipt_counters (year, last) values (y, 1)
    on conflict (year) do update set last = public.receipt_counters.last + 1
    returning last into n;
  update public.orders set receipt_no = format('LSVB-%s-%s', y, lpad(n::text, 6, '0')) where id = p_order;
  return format('LSVB-%s-%s', y, lpad(n::text, 6, '0'));
end;
$$;

-- Création de commande : jauge et nombre d'utilisations du code promo contrôlés sous verrou
create or replace function public.create_order(p_order jsonb, p_passes jsonb, p_hold_minutes int default 30)
returns table (id text, access_token text)
language plpgsql
security definer set search_path = public
as $$
declare
  ev public.events;
  pr public.promo_codes;
  wanted int;
  sold int;
  used int;
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
  if coalesce(p_order ->> 'promo_code', '') <> '' then
    select * into pr from public.promo_codes c where c.code = p_order ->> 'promo_code' for update;
    if not found or not pr.active then raise exception 'PROMO_INVALID'; end if;
    if pr.max_uses is not null then
      select count(*) into used from public.orders o
        where o.promo_code = pr.code
          and (o.status = 'paid' or (o.status = 'pending' and o.created_at > now() - make_interval(mins => p_hold_minutes)));
      if used >= pr.max_uses then raise exception 'PROMO_EXHAUSTED'; end if;
    end if;
  end if;
  insert into public.orders (id, event_id, user_id, buyer_name, email, phone, grp, lines, subtotal_cents, discount_cents, promo_code, vat,
                             total_cents, is_demo, pay_method)
  values (p_order ->> 'id', ev.id, nullif(p_order ->> 'user_id', '')::uuid, p_order ->> 'buyer_name', lower(p_order ->> 'email'),
          p_order ->> 'phone', p_order ->> 'grp', p_order -> 'lines',
          (p_order ->> 'subtotal_cents')::int, coalesce((p_order ->> 'discount_cents')::int, 0), nullif(p_order ->> 'promo_code', ''),
          coalesce(p_order -> 'vat', '[]'::jsonb), (p_order ->> 'total_cents')::int,
          coalesce((p_order ->> 'is_demo')::boolean, false), coalesce(p_order ->> 'pay_method', 'sumup'));
  insert into public.passes (order_id, idx, kind, type, label, drink, token)
  select p_order ->> 'id', (x ->> 'idx')::int, x ->> 'kind', x ->> 'type', x ->> 'label', x ->> 'drink', x ->> 'token'
  from jsonb_array_elements(p_passes) x;
  return query select o.id, o.access_token from public.orders o where o.id = p_order ->> 'id';
end;
$$;

revoke all on function public.create_order(jsonb, jsonb, int) from public, anon, authenticated;
grant execute on function public.create_order(jsonb, jsonb, int) to service_role;
revoke all on function public.assign_receipt(text) from public, anon, authenticated;
grant execute on function public.assign_receipt(text) to service_role;

-- ---------------------------------------------------------------------------
-- Clients : code postal et accord pour recevoir les actualités du club
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists postal_code text;
alter table public.profiles add column if not exists marketing_opt_in boolean not null default false;
alter table public.profiles add column if not exists marketing_opt_in_at timestamptz;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, first_name, last_name, phone, postal_code, marketing_opt_in, marketing_opt_in_at)
  values (
    new.id, lower(new.email),
    new.raw_user_meta_data ->> 'first_name', new.raw_user_meta_data ->> 'last_name',
    new.raw_user_meta_data ->> 'phone', new.raw_user_meta_data ->> 'postal_code',
    coalesce((new.raw_user_meta_data ->> 'marketing_opt_in')::boolean, false),
    case when coalesce((new.raw_user_meta_data ->> 'marketing_opt_in')::boolean, false) then now() end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Mentions légales du ticket de caisse
-- ---------------------------------------------------------------------------
alter table public.settings add column if not exists legal_name text default 'Les Sables Vendée Basket';
alter table public.settings add column if not exists legal_address text;
alter table public.settings add column if not exists siret text;
alter table public.settings add column if not exists vat_number text;
alter table public.settings add column if not exists report_email text;

-- ---------------------------------------------------------------------------
-- Règles d'accès : catalogue lisible par tous, codes promo via l'API seulement
-- ---------------------------------------------------------------------------
alter table public.products enable row level security;
alter table public.promo_codes enable row level security;
alter table public.receipt_counters enable row level security;
create policy products_read on public.products for select using (active or public.staff_role() is not null);
create policy promo_admin_read on public.promo_codes for select using (public.staff_role() = 'admin');
