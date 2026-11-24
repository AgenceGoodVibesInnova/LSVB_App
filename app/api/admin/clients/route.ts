import { supabaseService } from "@/lib/supabase/server";
import { requestStaff } from "@/lib/auth";
import { clientList } from "@/lib/clients";

/** Export CSV (Excel) du fichier clients. */
export async function GET() {
  if (!(await requestStaff("admin"))) return new Response("Réservé aux administrateurs.", { status: 403 });
  const list = await clientList(supabaseService());
  const head = ["Nom", "E-mail", "Téléphone", "Code postal", "Accepte les actualités", "Compte", "Commandes", "Billets", "Total (€)", "Dernière activité", "Dernier match"];
  const rows = list.map((c) => [c.name, c.email, c.phone, c.postal, c.optIn ? "oui" : "non", c.account ? "oui" : "non", c.orders, c.tickets, (c.spent / 100).toFixed(2).replace(".", ","), new Date(c.last).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" }), c.lastEvent]);
  const csv = "﻿" + [head, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";")).join("\r\n");
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="clients-lsvb.csv"' } });
}
