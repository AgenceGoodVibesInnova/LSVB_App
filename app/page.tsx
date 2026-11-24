import BuyForm, { type SaleEvent } from "@/components/BuyForm";
import { supabaseService } from "@/lib/supabase/server";
import { sumupConfigured } from "@/lib/sumup";
import { staffMember } from "@/lib/auth";
import { HOLD_MINUTES, type Prices } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function Home() {
  const admin = supabaseService();
  const since = new Date(Date.now() - 6 * 3600e3).toISOString();
  const [{ data: evs }, { data: sales }] = await Promise.all([
    admin.from("events").select("id, name, starts_at, venue, capacity, journee, prices").eq("on_sale", true).gte("starts_at", since).order("starts_at"),
    admin.rpc("event_sales", { p_hold_minutes: HOLD_MINUTES }),
  ]);
  const sold = new Map(((sales ?? []) as { event_id: string; sold: number }[]).map((s) => [s.event_id, s.sold]));
  const events: SaleEvent[] = (evs ?? []).map((e) => ({
    id: e.id, name: e.name, startsAt: e.starts_at, venue: e.venue, journee: e.journee, prices: e.prices as Prices,
    remaining: e.capacity > 0 ? Math.max(0, e.capacity - (sold.get(e.id) ?? 0)) : null,
  }));
  const demo = !sumupConfigured();
  const staff = demo ? await staffMember() : null;
  return <main><BuyForm events={events} demo={demo} canBuy={!demo || !!staff} /></main>;
}
