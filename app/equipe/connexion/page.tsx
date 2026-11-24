import { redirect } from "next/navigation";
// Ancienne adresse de connexion de l'équipe
export default async function Page({ searchParams }: { searchParams: Promise<{ suite?: string }> }) {
  const sp = await searchParams;
  redirect(`/admin/connexion${sp.suite ? `?suite=${encodeURIComponent(sp.suite)}` : ""}`);
}
