import BuyForm, { type SaleEvent, type SaleProduct } from "@/components/BuyForm";
import { supabaseService } from "@/lib/supabase/server";
import { sumupConfigured } from "@/lib/sumup";
import { currentUser, staffMember } from "@/lib/auth";
import { choicesFor, loadProducts, priceFor, salesWindows, HOLD_MINUTES, type Prices } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export default async function Home() {
  const admin = supabaseService();
  const now = Date.now();
  const since = new Date(now - 6 * 3600e3).toISOString();
  const [{ data: evs }, { data: sales }, products] = await Promise.all([
    admin.from("events").select("id, name, starts_at, venue, capacity, journee, prices, sales_end_at, shop_end_at").eq("on_sale", true).gte("starts_at", since).order("starts_at"),
    admin.rpc("event_sales", { p_hold_minutes: HOLD_MINUTES }),
    loadProducts(admin),
  ]);
  const sold = new Map(((sales ?? []) as { event_id: string; sold: number }[]).map((s) => [s.event_id, s.sold]));
  const events: SaleEvent[] = (evs ?? [])
    .map((e) => {
      const w = salesWindows(e);
      return {
        id: e.id, name: e.name, startsAt: e.starts_at, venue: e.venue, journee: e.journee,
        salesEnd: new Date(w.salesEnd).toISOString(), shopEnd: new Date(w.shopEnd).toISOString(), shopOpen: now <= w.shopEnd,
        remaining: e.capacity > 0 ? Math.max(0, e.capacity - (sold.get(e.id) ?? 0)) : null,
        prices: Object.fromEntries(products.map((p) => [p.id, priceFor(p, e.prices as Prices)])),
      };
    })
    .filter((e) => now <= new Date(e.salesEnd).getTime());
  const catalog: SaleProduct[] = products.map((p) => ({
    id: p.id, category: p.category, name: p.name, description: p.description, icon: p.icon,
    choice: p.choice, choiceLabel: p.choice_label, choices: choicesFor(p, products),
  }));
  const demo = !sumupConfigured();
  const [staff, user, { data: settings }] = await Promise.all([staffMember(), currentUser(), admin.from("settings").select("account_required").eq("id", 1).maybeSingle()]);
  const { data: profile } = user ? await admin.from("profiles").select("first_name, last_name, phone").eq("id", user.id).maybeSingle() : { data: null };
  const me = user ? { name: [profile?.first_name, profile?.last_name].filter(Boolean).join(" "), email: user.email ?? "", phone: profile?.phone ?? "" } : null;
  return <main><BuyForm events={events} catalog={catalog} demo={demo} canBuy={!demo || !!staff} me={staff ? null : me} isStaff={!!staff} accountRequired={!!settings?.account_required} /></main>;
}
