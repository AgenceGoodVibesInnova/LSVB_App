import Scanner from "@/components/Scanner";
import { requireStaff } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Scanner", robots: { index: false } };

export default async function Page() {
  await requireStaff("scan", "/admin/scanner");
  const { data } = await supabaseService().from("events").select("id, name, starts_at").order("starts_at");
  const events = data ?? [];
  // Match proposé par défaut : celui du jour, sinon le prochain
  const now = Date.now();
  const next = events.find((e) => new Date(e.starts_at).getTime() > now - 8 * 3600e3) ?? events[events.length - 1];
  return (
    <>
      <div className="page-head"><div><div className="kick">Jour de match</div><h2>Scanner</h2></div></div>
      <Scanner events={events.map((e) => ({ id: e.id, name: e.name, startsAt: e.starts_at }))} defaultEvent={next?.id ?? ""} />
    </>
  );
}
