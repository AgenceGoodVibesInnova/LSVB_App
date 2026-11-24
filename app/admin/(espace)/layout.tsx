import AdminNav from "@/components/AdminNav";
import { requireStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Espace administrateur", robots: { index: false } };

export default async function Layout({ children }: { children: React.ReactNode }) {
  const me = await requireStaff("admin", "/admin");
  return (
    <main className="adm">
      <AdminNav email={me.email} />
      <div className="adm-main">{children}</div>
    </main>
  );
}
