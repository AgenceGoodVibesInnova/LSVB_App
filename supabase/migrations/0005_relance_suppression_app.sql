-- 0005 : relance de paiement sans survente, appareils de l'application (notifications)

-- Relance d'un paiement : si la réservation des places a expiré, on revérifie la jauge
-- (et le code promo) avant de la renouveler, avec le même verrou que create_order.
create or replace function public.renew_hold(p_order text, p_hold_minutes int default 30)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  o public.orders;
  ev public.events;
  pr public.promo_codes;
  wanted int;
  sold int;
  used int;
begin
  select * into o from public.orders x where x.id = p_order for update;
  if not found or o.status = 'paid' then return; end if;
  if o.status = 'cancelled' then raise exception 'ORDER_CANCELLED'; end if;
  select * into ev from public.events e where e.id = o.event_id for update;
  if not found or not ev.on_sale then raise exception 'EVENT_CLOSED'; end if;
  -- Réservation encore valable : rien à revérifier
  if o.status = 'pending' and o.created_at > now() - make_interval(mins => p_hold_minutes) then
    update public.orders set created_at = now() where id = o.id;
    return;
  end if;
  if ev.capacity > 0 then
    select count(*) into wanted from public.passes p where p.order_id = o.id and p.kind = 'ticket';
    select count(*) into sold from public.passes p join public.orders x on x.id = p.order_id
      where x.event_id = ev.id and p.kind = 'ticket' and x.id <> o.id
        and (x.status = 'paid' or (x.status = 'pending' and x.created_at > now() - make_interval(mins => p_hold_minutes)));
    if sold + wanted > ev.capacity then raise exception 'SOLD_OUT'; end if;
  end if;
  if o.promo_code is not null then
    select * into pr from public.promo_codes c where c.code = o.promo_code for update;
    if not found or not pr.active then raise exception 'PROMO_INVALID'; end if;
    if pr.max_uses is not null then
      select count(*) into used from public.orders x
        where x.promo_code = pr.code and x.id <> o.id
          and (x.status = 'paid' or (x.status = 'pending' and x.created_at > now() - make_interval(mins => p_hold_minutes)));
      if used >= pr.max_uses then raise exception 'PROMO_EXHAUSTED'; end if;
    end if;
  end if;
  update public.orders set status = 'pending', created_at = now() where id = o.id;
end $$;
revoke all on function public.renew_hold(text, int) from public, anon, authenticated;
grant execute on function public.renew_hold(text, int) to service_role;

-- Appareils de l'application installée (jeton de notification iOS / Android)
create table if not exists public.devices (
  token text primary key,
  user_id uuid references auth.users (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);
create index if not exists devices_user_idx on public.devices (user_id);
alter table public.devices enable row level security;
-- Aucun accès direct : tout passe par le serveur (clé service)
grant all on table public.devices to service_role;
