import SetPassword from "@/components/SetPassword";
export const metadata = { title: "Mot de passe", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ suite?: string }> }) {
  const sp = await searchParams;
  const team = sp.suite === "/admin" || sp.suite === "/scanner";
  return (
    <main className="wrap" style={{ maxWidth: 480 }}>
      <SetPassword next={team ? sp.suite! : "/compte"} back={team ? "/admin/connexion" : "/connexion"} />
    </main>
  );
}
