import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, staffMember } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";
import { euros, longDate } from "@/lib/format";
import ProfileForm from "@/components/ProfileForm";
import ClientLogout from "@/components/ClientLogout";
import NotifPrompt from "@/components/NotifPrompt";
import DeleteAccount from "@/components/DeleteAccount";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mon profil", robots: { index: false } };

type O = { id: string; receipt_no: string | null; status: string; total_cents: number; access_token: string; created_at: string; paid_at: string | null; events: { name: string; starts_at: string } | null; passes: { kind: string; used_at: string | null }[] };

export default async function Profil() {
  const user = await currentUser();
  if (!user) redirect("/connexion?suite=/compte");
  const admin = supabaseService();
  const email = (user.email ?? "").toLowerCase();
  // Commandes du profil, et celles passées avec la même adresse avant sa création
  const [{ data: profile }, { data: od }, staff] = await Promise.all([
    admin.from("profiles").select("first_name, last_name, address, postal_code, city, phone, marketing_opt_in").eq("id", user.id).maybeSingle(),
    admin.from("orders").select("id, receipt_no, status, total_cents, access_token, created_at, paid_at, events(name, starts_at), passes(kind, used_at)")
      .or(`user_id.eq.${user.id},email.eq."${email}"`).in("status", ["paid", "pending"]).order("created_at", { ascending: false }),
    staffMember(),
  ]);
  const all = (od ?? []) as unknown as O[];
  const paid = all.filter((o) => o.status === "paid");
  const pending = all.filter((o) => o.status === "pending" && Date.now() - new Date(o.created_at).getTime() < 30 * 60e3);
  const upcoming = paid.filter((o) => o.events && new Date(o.events.starts_at).getTime() > Date.now() - 6 * 3600e3)
    .sort((a, b) => a.events!.starts_at.localeCompare(b.events!.starts_at));

  return (
    <main className="wrap">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h2 style={{ color: "var(--blue-d)", fontSize: 26, flex: "none" }}>Bonjour{profile?.first_name ? ` ${profile.first_name}` : ""} !</h2>
        <span className="row" style={{ flex: "none", gap: 8 }}>
          {staff ? <Link className="btn ghost sm" href={staff.role === "admin" ? "/admin" : "/admin/scanner"}>Espace admin</Link> : null}
          <ClientLogout />
        </span>
      </div>
      <NotifPrompt />
      <div className="grid2">
        <div>
          <div className="card">
            <div className="sec-title" style={{ justifyContent: "space-between" }}>Mes prochains matchs <Link className="btn pri sm" href="/acheter">Réserver</Link></div>
            {pending.map((o) => (
              <div key={o.id} className="prod"><div className="ic">⏳</div><div className="nm"><b>{o.events?.name}</b><span>Paiement en attente · {euros(o.total_cents)}</span></div><Link className="btn pri sm" style={{ flex: "none" }} href={`/paiement/${o.access_token}`}>Payer</Link></div>
            ))}
            {upcoming.length ? upcoming.map((o) => {
              const t = o.passes.filter((p) => p.kind === "ticket").length;
              const bons = [o.passes.some((p) => p.kind === "food") ? "buvette" : "", o.passes.some((p) => p.kind === "shop") ? "boutique" : ""].filter(Boolean).join(" + ");
              return (
                <div key={o.id} className="prod" style={{ alignItems: "flex-start" }}>
                  <div className="ic">🏀</div>
                  <div className="nm"><b>{o.events?.name}</b><span style={{ display: "block" }}>{o.events ? longDate(o.events.starts_at) : ""}</span><span style={{ display: "block" }}>{t} billet{t > 1 ? "s" : ""}{bons ? ` · ${bons}` : ""}</span></div>
                  <Link className="btn blue sm" style={{ flex: "none" }} href="/pass">Mes pass</Link>
                </div>
              );
            }) : !pending.length ? <div className="empty"><div className="e">🎟️</div>Aucune réservation à venir.</div> : null}
          </div>
          <div className="card">
            <div className="sec-title">Mes factures</div>
            {paid.length ? (
              <div className="tablewrap"><table>
                <thead><tr><th>Date</th><th>N° de ticket de caisse</th><th>Match</th><th className="num">Montant TTC</th><th></th></tr></thead>
                <tbody>
                  {paid.map((o) => (
                    <tr key={o.id}>
                      <td className="small">{new Date(o.paid_at ?? o.created_at).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}</td>
                      <td><b style={{ fontFamily: "ui-monospace,monospace" }}>{o.receipt_no ?? "—"}</b></td>
                      <td className="small">{o.events?.name}</td>
                      <td className="num"><b>{euros(o.total_cents)}</b></td>
                      <td><Link className="btn ghost sm" href={`/recu/${o.access_token}`}>Voir</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            ) : <p className="small muted">Vos factures (tickets de caisse) apparaîtront ici après chaque achat.</p>}
          </div>
        </div>
        <div>
        <ProfileForm email={email} initial={{
          first_name: profile?.first_name ?? "", last_name: profile?.last_name ?? "", address: profile?.address ?? "",
          postal_code: profile?.postal_code ?? "", city: profile?.city ?? "", phone: profile?.phone ?? "", marketing_opt_in: !!profile?.marketing_opt_in,
        }} />
        <p className="small muted" style={{ margin: "4px 4px 10px" }}><a href="/confidentialite">Politique de confidentialité</a></p>
        {staff ? null : <DeleteAccount />}
        </div>
      </div>
    </main>
  );
}
