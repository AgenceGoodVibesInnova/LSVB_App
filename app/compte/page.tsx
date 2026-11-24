import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, staffMember } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";
import { euros, longDate } from "@/lib/format";
import type { Line } from "@/lib/catalog";
import ProfileForm from "@/components/ProfileForm";
import ClientLogout from "@/components/ClientLogout";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mon compte", robots: { index: false } };

type O = { id: string; status: string; total_cents: number; lines: Line[]; access_token: string; created_at: string; events: { name: string; starts_at: string } | null; passes: { kind: string; used_at: string | null }[] };

export default async function Compte() {
  const user = await currentUser();
  if (!user) redirect("/connexion?suite=/compte");
  const admin = supabaseService();
  const email = (user.email ?? "").toLowerCase();
  // Commandes du compte, et celles passées avec la même adresse avant la création du compte
  const [{ data: profile }, { data: od }, staff] = await Promise.all([
    admin.from("profiles").select("first_name, last_name, phone").eq("id", user.id).maybeSingle(),
    admin.from("orders").select("id, status, total_cents, lines, access_token, created_at, events(name, starts_at), passes(kind, used_at)")
      .or(`user_id.eq.${user.id},email.eq."${email}"`).in("status", ["paid", "pending"]).order("created_at", { ascending: false }),
    staffMember(),
  ]);
  const orders = ((od ?? []) as unknown as O[]).filter((o) => o.status === "paid" || Date.now() - new Date(o.created_at).getTime() < 30 * 60e3);
  const soon = (o: O) => o.events && new Date(o.events.starts_at).getTime() > Date.now() - 6 * 3600e3;
  const upcoming = orders.filter(soon).sort((a, b) => a.events!.starts_at.localeCompare(b.events!.starts_at));
  const past = orders.filter((o) => !soon(o));

  const card = (o: O) => {
    const t = o.passes.filter((p) => p.kind === "ticket").length;
    const f = o.passes.length - t;
    return (
      <div key={o.id} className="prod" style={{ alignItems: "flex-start" }}>
        <div className="ic">🏀</div>
        <div className="nm">
          <b>{o.events?.name}</b>
          <span style={{ display: "block" }}>{o.events ? longDate(o.events.starts_at) : ""} · commande {o.id}</span>
          <span style={{ display: "block" }}>{t} billet{t > 1 ? "s" : ""}{f ? ` · ${f} buvette` : ""} · {euros(o.total_cents)}</span>
        </div>
        {o.status === "paid"
          ? <Link className="btn blue sm" style={{ flex: "none" }} href={`/billets/${o.access_token}`}>Mes QR codes</Link>
          : <Link className="btn pri sm" style={{ flex: "none" }} href={`/paiement/${o.access_token}`}>Payer</Link>}
      </div>
    );
  };

  return (
    <main className="wrap">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h2 style={{ color: "var(--blue-d)", fontSize: 26, flex: "none" }}>Bonjour{profile?.first_name ? ` ${profile.first_name}` : ""} !</h2>
        <span className="row" style={{ flex: "none", gap: 8 }}>
          {staff ? <Link className="btn ghost sm" href={staff.role === "admin" ? "/admin" : "/scanner"}>Espace équipe</Link> : null}
          <ClientLogout />
        </span>
      </div>
      <div className="grid2">
        <div>
          <div className="card">
            <div className="sec-title" style={{ justifyContent: "space-between" }}>Mes prochains matchs <Link className="btn pri sm" href="/">Réserver</Link></div>
            {upcoming.length ? upcoming.map(card) : <div className="empty"><div className="e">🎟️</div>Aucune réservation à venir.</div>}
          </div>
          {past.length ? <div className="card"><div className="sec-title">Historique</div>{past.map(card)}</div> : null}
        </div>
        <ProfileForm email={email} initial={{ first_name: profile?.first_name ?? "", last_name: profile?.last_name ?? "", phone: profile?.phone ?? "" }} />
      </div>
    </main>
  );
}
