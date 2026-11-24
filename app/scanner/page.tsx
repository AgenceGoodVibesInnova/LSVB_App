import Scanner from "@/components/Scanner";
import ClientLogout from "@/components/ClientLogout";
import { requireStaff } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Scanner", robots: { index: false } };

export default async function Page() {
  const me = await requireStaff("scan", "/scanner");
  const { data } = await supabaseService().from("events").select("id, name, starts_at").order("starts_at");
  const events = data ?? [];
  // Match proposé par défaut : celui du jour, sinon le prochain
  const now = Date.now();
  const next = events.find((e) => new Date(e.starts_at).getTime() > now - 8 * 3600e3) ?? events[events.length - 1];
  return (
    <main className="wrap">
      <div className="row noprint" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span className="small muted" style={{ flex: "none" }}>Connecté : <b>{me.email}</b> ({me.role === "admin" ? "administrateur" : "scan"})</span>
        <span style={{ flex: "none" }}><ClientLogout to="/admin/connexion" /></span>
      </div>
      <Scanner events={events.map((e) => ({ id: e.id, name: e.name, startsAt: e.starts_at }))} defaultEvent={next?.id ?? ""} />
    </main>
  );
}
