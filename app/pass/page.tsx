import Link from "next/link";
import QRCode from "qrcode";
import { currentUser } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";
import { longDate, passCode } from "@/lib/format";
import { KIND_LABEL, type Kind } from "@/lib/catalog";
import AuthForm from "@/components/AuthForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Mes pass", robots: { index: false } };

const TABS: { key: string; kind: Kind; label: string; icon: string }[] = [
  { key: "places", kind: "ticket", label: "Places", icon: "🎟️" },
  { key: "buvette", kind: "food", label: "Buvette", icon: "🥪" },
  { key: "boutique", kind: "shop", label: "Boutique", icon: "👕" },
];
type P = { idx: number; kind: Kind; label: string; token: string; used_at: string | null; items: { label: string; q: number }[] | null };
type O = { id: string; buyer_name: string; events: { name: string; starts_at: string } | null; passes: P[] };

/** Mes pass : tous les QR codes du client. En couleur s'ils sont actifs, grisés une fois scannés. */
export default async function MesPass({ searchParams }: { searchParams: Promise<{ onglet?: string }> }) {
  const user = await currentUser();
  if (!user) {
    return (
      <main className="wrap" style={{ maxWidth: 560 }}>
        <h2 style={{ color: "var(--blue-d)", fontSize: 26, marginBottom: 14 }}>Mes pass</h2>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="empty" style={{ padding: "4px 0" }}><div className="e">🎟️</div><b style={{ color: "var(--blue-d)" }}>Tous vos QR codes au même endroit</b><br />Places, buvette et boutique, match après match : en couleur tant qu&apos;ils sont valables, grisés une fois scannés.</div>
        </div>
        <AuthForm next="/pass" />
      </main>
    );
  }
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.onglet) ?? TABS[0];
  const email = (user.email ?? "").toLowerCase();
  const { data } = await supabaseService()
    .from("orders").select("id, buyer_name, events(name, starts_at), passes(idx, kind, label, token, used_at, items)")
    .or(`user_id.eq.${user.id},email.eq."${email}"`).eq("status", "paid");
  const all = ((data ?? []) as unknown as O[]).flatMap((o) => o.passes.map((p) => ({ o, p, ev: o.events! })));
  const active = (k: Kind) => all.filter((x) => x.p.kind === k && !x.p.used_at).length;
  const list = all.filter((x) => x.p.kind === tab.kind)
    .sort((a, b) => Number(!!a.p.used_at) - Number(!!b.p.used_at) || a.ev.starts_at.localeCompare(b.ev.starts_at) || a.p.idx - b.p.idx);
  const groups: { key: string; ev: O["events"]; used: boolean; items: typeof list }[] = [];
  for (const x of list) {
    const key = `${x.ev.name}|${x.ev.starts_at}|${!!x.p.used_at}`;
    let g = groups.find((y) => y.key === key);
    if (!g) groups.push((g = { key, ev: x.ev, used: !!x.p.used_at, items: [] }));
    g.items.push(x);
  }
  const qrs = new Map(await Promise.all(list.map(async (x) => [`${x.o.id}-${x.p.idx}`, await QRCode.toString(`LSVB:${passCode(x.o.id, x.p.idx, x.p.token)}`, { type: "svg", margin: 1, errorCorrectionLevel: "M" })] as const)));

  return (
    <main className="wrap">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h2 style={{ color: "var(--blue-d)", fontSize: 26, flex: "none" }}>Mes pass</h2>
        <span style={{ flex: "none" }}><Link className="btn pri sm" href="/acheter">Acheter</Link></span>
      </div>
      <nav className="mode pass-tabs" aria-label="Type de pass">
        {TABS.map((t) => (
          <Link key={t.key} href={`/pass?onglet=${t.key}`} className={t.key === tab.key ? "on" : ""} aria-current={t.key === tab.key ? "page" : undefined}>
            {t.icon} {t.label}{active(t.kind) ? <span className="cnt">{active(t.kind)}</span> : null}
          </Link>
        ))}
      </nav>
      <p className="small muted" style={{ margin: "10px 2px 16px" }}>
        Cadre de couleur : pass actif, à présenter. Grisé : déjà scanné. {tab.kind === "ticket" ? "Un QR par personne à l'entrée." : "Un seul QR pour toute la commande du match."}
      </p>
      {groups.length ? groups.map((g) => (
        <div className="pass-group" key={g.key}>
          <div className="subhead" style={{ marginTop: 6 }}>{g.ev?.name} · {g.ev ? longDate(g.ev.starts_at) : ""}{g.used ? " · déjà utilisés" : ""}</div>
          <div className="pass-grid">
            {g.items.map(({ o, p }) => (
              <div key={`${o.id}-${p.idx}`} className={`pass ${p.kind}${p.used_at ? " used-pass" : ""}`}>
                <div className="pass-h"><span>{KIND_LABEL[p.kind]}</span><span className="pass-st">{p.used_at ? "Scanné" : "Actif"}</span></div>
                <div className="pass-b">
                  <b>{p.label}</b>
                  {p.items?.length ? <ul className="bon-items">{p.items.map((i, k) => <li key={k}><b>{i.q}×</b> {i.label}</li>)}</ul> : null}
                  <div className="qrsvg" dangerouslySetInnerHTML={{ __html: qrs.get(`${o.id}-${p.idx}`)! }} />
                  <div className="code">{passCode(o.id, p.idx, p.token)}</div>
                  <div className="small muted">{p.used_at ? `Scanné le ${new Date(p.used_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "short", timeStyle: "short" })}` : o.buyer_name}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )) : (
        <div className="card"><div className="empty"><div className="e">{tab.icon}</div>Aucun pass {tab.kind === "ticket" ? "d'entrée" : tab.kind === "food" ? "buvette" : "boutique"} pour l&apos;instant.<br /><Link href="/acheter">Réserver</Link></div></div>
      )}
    </main>
  );
}
