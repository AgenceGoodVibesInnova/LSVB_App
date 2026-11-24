import { supabaseService } from "@/lib/supabase/server";
import PromoManager, { type PromoRow } from "@/components/PromoManager";

export const dynamic = "force-dynamic";

export default async function Promos() {
  const admin = supabaseService();
  const [{ data: promos }, { data: evs }, { data: used }] = await Promise.all([
    admin.from("promo_codes").select("*").order("created_at", { ascending: false }),
    admin.from("events").select("id, name, starts_at").order("starts_at"),
    admin.from("orders").select("promo_code, discount_cents").eq("status", "paid").not("promo_code", "is", null).limit(20000),
  ]);
  const stats = new Map<string, { n: number; d: number }>();
  for (const o of used ?? []) { const s = stats.get(o.promo_code!) ?? { n: 0, d: 0 }; s.n++; s.d += o.discount_cents ?? 0; stats.set(o.promo_code!, s); }
  const rows: PromoRow[] = (promos ?? []).map((p) => ({ ...p, uses: stats.get(p.code)?.n ?? 0, given: stats.get(p.code)?.d ?? 0 }));
  return (
    <>
      <div className="page-head"><div><div className="kick">Ventes</div><h2>Codes promo</h2></div></div>
      <PromoManager promos={rows} events={(evs ?? []).map((e) => ({ id: e.id, name: e.name, startsAt: e.starts_at }))} />
    </>
  );
}
