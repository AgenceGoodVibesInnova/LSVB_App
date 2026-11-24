import LoginForm from "@/components/LoginForm";
export const metadata = { title: "Espace administrateur", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ suite?: string; refus?: string; lien?: string }> }) {
  const sp = await searchParams;
  const suite = sp.suite?.startsWith("/") && !sp.suite.startsWith("//") ? sp.suite : "/admin";
  const notice = sp.refus ? "Ce compte n'a pas accès à l'espace équipe." : sp.lien ? "Ce lien a expiré ou a déjà servi." : "";
  return (
    <main className="wrap" style={{ maxWidth: 460 }}>
      <div className="card">
        <div className="sec-title">Espace administrateur</div>
        <p className="small muted" style={{ marginTop: 0 }}>Organisateurs et bénévoles du contrôle et de la buvette. Les accès sont donnés depuis l&apos;onglet Équipe.</p>
        <LoginForm suite={suite} notice={notice} />
      </div>
    </main>
  );
}
