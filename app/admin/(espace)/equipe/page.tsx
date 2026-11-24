import { supabaseService } from "@/lib/supabase/server";
import { requireStaff } from "@/lib/auth";
import TeamManager from "@/components/TeamManager";

export const dynamic = "force-dynamic";

export default async function Equipe() {
  const me = await requireStaff("admin", "/admin/equipe");
  const { data } = await supabaseService().from("staff").select("user_id, email, role, created_at").order("created_at");
  return (
    <>
      <div className="page-head"><div><div className="kick">Accès</div><h2>Équipe</h2></div></div>
      <TeamManager members={data ?? []} me={me.user.id} />
    </>
  );
}
