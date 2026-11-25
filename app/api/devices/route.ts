import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { supabaseService } from "@/lib/supabase/server";

/** Enregistre l'appareil (application iOS / Android) du client connecté pour les notifications. */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Non connecté." }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { token?: string; platform?: string };
  const token = String(b.token ?? "").trim();
  if (!/^[\w:.\-]{20,4096}$/.test(token) || (b.platform !== "ios" && b.platform !== "android"))
    return NextResponse.json({ error: "Appareil invalide." }, { status: 400 });
  const { error } = await supabaseService().from("devices")
    .upsert({ token, user_id: user.id, platform: b.platform, updated_at: new Date().toISOString() }, { onConflict: "token" });
  if (error) return NextResponse.json({ error: "Enregistrement impossible." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
