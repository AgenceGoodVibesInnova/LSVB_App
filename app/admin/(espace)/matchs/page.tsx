import { supabaseService } from "@/lib/supabase/server";
import { loadProducts, HOLD_MINUTES, type Prices } from "@/lib/catalog";
import EventEditor, { type AdminEvent } from "@/components/EventEditor";

export const dynamic = "force-dynamic";

export default async function Matchs() {
  const admin = supabaseService();
  const [{ data: evs }, { data: sales }, products] = await Promise.all([
    admin.from("events").select("*").order("starts_at"),
    admin.rpc("event_sales", { p_hold_minutes: HOLD_MINUTES }),
    loadProducts(admin, true),
  ]);
  const sold = new Map(((sales ?? []) as { event_id: string; sold: number }[]).map((s) => [s.event_id, s.sold]));
  const events: AdminEvent[] = (evs ?? []).map((e) => ({
    id: e.id, name: e.name, startsAt: e.starts_at, venue: e.venue, capacity: e.capacity, onSale: e.on_sale, journee: e.journee,
    prices: (e.prices ?? {}) as Prices, sold: sold.get(e.id) ?? 0, salesEndAt: e.sales_end_at, shopEndAt: e.shop_end_at,
  }));
  return (
    <>
      <div className="page-head"><div><div className="kick">Calendrier</div><h2>Matchs</h2></div></div>
      <EventEditor events={events} catalog={products.map((p) => ({ id: p.id, category: p.category, name: p.name, price_cents: p.price_cents, active: p.active }))} />
    </>
  );
}
