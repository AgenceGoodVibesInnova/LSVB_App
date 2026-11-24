import { supabaseService } from "@/lib/supabase/server";
import { HOLD_MINUTES, type Prices } from "@/lib/catalog";
import EventEditor, { type AdminEvent } from "@/components/EventEditor";

export const dynamic = "force-dynamic";

export default async function Matchs() {
  const admin = supabaseService();
  const [{ data: evs }, { data: sales }] = await Promise.all([
    admin.from("events").select("*").order("starts_at"),
    admin.rpc("event_sales", { p_hold_minutes: HOLD_MINUTES }),
  ]);
  const sold = new Map(((sales ?? []) as { event_id: string; sold: number }[]).map((s) => [s.event_id, s.sold]));
  const events: AdminEvent[] = (evs ?? []).map((e) => ({ id: e.id, name: e.name, startsAt: e.starts_at, venue: e.venue, capacity: e.capacity, onSale: e.on_sale, journee: e.journee, prices: e.prices as Prices, sold: sold.get(e.id) ?? 0 }));
  return (
    <>
      <div className="page-head"><div><div className="kick">Calendrier</div><h2>Matchs et prix</h2></div></div>
      <EventEditor events={events} />
    </>
  );
}
