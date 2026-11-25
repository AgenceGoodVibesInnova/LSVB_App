"use client";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function ClientLogout({ to = "/" }: { to?: string }) {
  return <button className="btn ghost sm" onClick={async () => { await supabaseBrowser().auth.signOut(); window.location.assign(to); }}>Déconnexion</button>;
}
