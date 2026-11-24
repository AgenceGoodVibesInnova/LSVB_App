import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { currentUser } from "@/lib/auth";

export const metadata = { title: "Mon compte" };

export default async function Page({ searchParams }: { searchParams: Promise<{ suite?: string; lien?: string }> }) {
  const sp = await searchParams;
  const next = sp.suite?.startsWith("/") && !sp.suite.startsWith("//") ? sp.suite : "/compte";
  if (await currentUser()) redirect(next);
  return (
    <main className="wrap" style={{ maxWidth: 520 }}>
      <AuthForm next={next} notice={sp.lien === "expire" ? "Ce lien a expiré ou a déjà servi. Connectez-vous ou demandez un nouveau lien." : undefined} />
    </main>
  );
}
