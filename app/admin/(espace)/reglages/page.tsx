import { requireStaff } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";
import { sumupConfigured } from "@/lib/sumup";
import SettingsForm from "@/components/SettingsForm";

export const dynamic = "force-dynamic";

export default async function Reglages() {
  await requireStaff("admin", "/admin/reglages");
  const { data } = await supabaseService().from("settings").select("account_required, contact_email, report_email, legal_name, legal_address, siret, vat_number").eq("id", 1).maybeSingle();
  const smtp = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  return (
    <>
      <div className="page-head"><div><div className="kick">Billetterie</div><h2>Réglages</h2></div></div>
      <div className="grid2">
        <SettingsForm initial={{ account_required: !!data?.account_required, contact_email: data?.contact_email ?? "", report_email: data?.report_email ?? "", legal_name: data?.legal_name ?? "", legal_address: data?.legal_address ?? "", siret: data?.siret ?? "", vat_number: data?.vat_number ?? "" }} />
        <div className="card">
          <div className="sec-title">Branchements</div>
          <div className="line" style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}><span>Paiement SumUp</span>{sumupConfigured() ? <span className="pill ok">Branché</span> : <span className="pill warn">Paiement simulé</span>}</div>
          <div className="line" style={{ display: "flex", justifyContent: "space-between", padding: "8px 0" }}><span>Envoi des e-mails</span>{smtp ? <span className="pill ok">Branché</span> : <span className="pill warn">Non configuré</span>}</div>
          <p className="small muted">Ces branchements se règlent dans Vercel (variables d&apos;environnement), voir le README.</p>
        </div>
      </div>
    </>
  );
}
