"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

declare global {
  interface Window {
    SumUpCard?: { mount: (opts: Record<string, unknown>) => { unmount?: () => void } };
  }
}

const SDK = "https://gateway.sumup.com/gateway/ecom/card/v2/sdk.js";

/** Formulaire de carte SumUp intégré à la page ; le paiement est ensuite vérifié côté serveur. */
export default function SumUpWidget({ token, checkoutId }: { token: string; checkoutId: string }) {
  const router = useRouter();
  const mounted = useRef<string | null>(null);
  const [msg, setMsg] = useState("");
  const [retry, setRetry] = useState(false);

  useEffect(() => {
    if (mounted.current === checkoutId) return;
    mounted.current = checkoutId;

    async function verify() {
      setMsg("Vérification du paiement…");
      const res = await fetch(`/api/orders/${token}/verify`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (data.status === "paid") router.replace(`/billets/${token}`);
      else { setMsg(data.error ?? "Le paiement n'a pas abouti. Vous pouvez réessayer."); setRetry(true); }
    }
    function mount() {
      window.SumUpCard?.mount({
        id: "sumup-card",
        checkoutId,
        locale: "fr-FR",
        onResponse: (type: string) => {
          if (type === "success") verify();
          else if (type === "error" || type === "fail") { setMsg("Le paiement a été refusé. Vérifiez votre carte et réessayez."); setRetry(true); }
        },
      });
    }
    if (window.SumUpCard) return mount();
    const s = document.createElement("script");
    s.src = SDK;
    s.onload = mount;
    s.onerror = () => setMsg("Le module de paiement n'a pas pu se charger. Rechargez la page.");
    document.body.appendChild(s);
  }, [checkoutId, token, router]);

  async function again() {
    setMsg("Préparation d'un nouveau paiement…");
    const res = await fetch(`/api/orders/${token}/retry`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (data.status === "paid") return router.replace(`/billets/${token}`);
    if (!res.ok) return setMsg(data.error ?? "Impossible de relancer le paiement.");
    setRetry(false); setMsg("");
    router.refresh();
  }

  return (
    <div>
      <div id="sumup-card" />
      {msg ? <p className="muted small" role="status">{msg}</p> : null}
      {retry ? <button className="btn ghost full" onClick={again}>Réessayer le paiement</button> : null}
    </div>
  );
}
