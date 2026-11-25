-- Billetterie LSVB : un seul QR buvette et un seul QR boutique par commande, coordonnées et profil complets
-- À exécuter dans Supabase > SQL Editor, après 0003_catalogue_promos_tva.sql.

-- Bon buvette / bon boutique : un QR regroupe tous les articles de la commande (détail affiché au scan et dans « Mes pass »)
alter table public.passes add column if not exists items jsonb;   -- [{ "label": "Tacos + boisson offerte (Pepsi)", "q": 2 }]

-- Coordonnées de l'acheteur : nom, prénom, code postal (d'où viennent les spectateurs)
alter table public.orders add column if not exists buyer_first text;
alter table public.orders add column if not exists buyer_last text;
alter table public.orders add column if not exists postal_code text;
create index if not exists orders_postal_idx on public.orders (postal_code);

-- Profil client : adresse et ville
alter table public.profiles add column if not exists address text;
alter table public.profiles add column if not exists city text;

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
  insert into public.orders (id, event_id, user_id, buyer_name, buyer_first, buyer_last, postal_code, email, phone, grp, lines, subtotal_cents, discount_cents, promo_code, vat,
                             total_cents, is_demo, pay_method)
  values (p_order ->> 'id', ev.id, nullif(p_order ->> 'user_id', '')::uuid, p_order ->> 'buyer_name',
          p_order ->> 'buyer_first', p_order ->> 'buyer_last', p_order ->> 'postal_code', lower(p_order ->> 'email'),
          p_order ->> 'phone', p_order ->> 'grp', p_order -> 'lines',
          (p_order ->> 'subtotal_cents')::int, coalesce((p_order ->> 'discount_cents')::int, 0), nullif(p_order ->> 'promo_code', ''),
          coalesce(p_order -> 'vat', '[]'::jsonb), (p_order ->> 'total_cents')::int,
          coalesce((p_order ->> 'is_demo')::boolean, false), coalesce(p_order ->> 'pay_method', 'sumup'));
  insert into public.passes (order_id, idx, kind, type, label, drink, token, items)
  select p_order ->> 'id', (x ->> 'idx')::int, x ->> 'kind', x ->> 'type', x ->> 'label', x ->> 'drink', x ->> 'token', x -> 'items'
  from jsonb_array_elements(p_passes) x;
  return query select o.id, o.access_token from public.orders o where o.id = p_order ->> 'id';
end;
$$;

revoke all on function public.create_order(jsonb, jsonb, int) from public, anon, authenticated;
grant execute on function public.create_order(jsonb, jsonb, int) to service_role;
