import LoginForm from "@/components/LoginForm";
export const metadata = { title: "Accès équipe", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ suite?: string; refus?: string }> }) {
  const sp = await searchParams;
  const suite = sp.suite?.startsWith("/") ? sp.suite : "/scanner";
  return (
    <main className="wrap" style={{ maxWidth: 460 }}>
      <div className="card">
        <div className="sec-title">Accès équipe</div>
        <p className="small muted" style={{ marginTop: 0 }}>Bénévoles du contrôle et de la buvette, organisateurs. Les comptes sont créés par l&apos;administrateur.</p>
        <LoginForm suite={suite} notice={sp.refus ? "Ce compte n'a pas accès à cet espace." : ""} />
      </div>
    </main>
  );
}
