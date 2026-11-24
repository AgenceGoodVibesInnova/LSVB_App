"use client";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();
  return <button className="btn ghost sm" onClick={async () => { await supabaseBrowser().auth.signOut(); router.push("/equipe/connexion"); router.refresh(); }}>Déconnexion</button>;
}
