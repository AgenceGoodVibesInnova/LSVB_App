"use client";
import { useEffect, useState } from "react";

type State = "hidden" | "ask" | "denied";

/**
 * Affiché seulement quand la billetterie est utilisée comme application (ajoutée à l'écran d'accueil).
 * Une application web ne peut pas ouvrir elle-même les réglages du téléphone : le bouton déclenche la demande
 * d'autorisation du système, et si elle a déjà été refusée, indique le chemin vers les réglages.
 */
export default function NotifPrompt() {
  const [state, setState] = useState<State>("hidden");
  const [ios, setIos] = useState(false);
  useEffect(() => {
    const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (!standalone || !("Notification" in window) || Notification.permission === "granted") return;
    setIos(/iPhone|iPad|iPod/.test(navigator.userAgent));
    setState(Notification.permission === "denied" ? "denied" : "ask");
  }, []);
  if (state === "hidden") return null;
  async function enable() {
    try {
      const r = await Notification.requestPermission();
      if (r === "granted") { setState("hidden"); new Notification("LSVB Billetterie", { body: "Notifications activées : vous serez prévenu quand votre commande est prête.", icon: "/icon-192.png" }); }
      else setState("denied");
    } catch { setState("denied"); }
  }
  return (
    <div className="notif" role="region" aria-label="Notifications">
      <div className="ni" aria-hidden="true">🔔</div>
      <div>
        <b>Pensez à activer vos notifications</b>
        {state === "ask" ? <div className="small">pour être prévenu quand votre commande est prête.</div>
          : <div className="small">Elles sont désactivées pour l&apos;application. Ouvrez {ios ? "Réglages › Notifications › LSVB Billetterie" : "Paramètres › Applications › LSVB Billetterie › Notifications"} et activez « Autoriser les notifications ».</div>}
      </div>
      {state === "ask" ? <button type="button" className="btn pri sm" onClick={enable}>Activer</button> : null}
    </div>
  );
}
