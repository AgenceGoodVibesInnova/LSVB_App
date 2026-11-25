"use client";
import { useEffect, useState } from "react";
import { isInstalledWebApp, isNativeApp, nativePlatform } from "@/lib/native";

type State = "hidden" | "ask" | "denied";

// Envoi réel des notifications : à activer quand Firebase (Android) et la clé Apple (iOS) sont configurés.
const PUSH_READY = process.env.NEXT_PUBLIC_PUSH_READY === "1";

/** Enregistre l'appareil auprès du serveur pour recevoir « votre commande est prête ». */
async function registerDevice() {
  if (!PUSH_READY) return;
  const { PushNotifications } = await import("@capacitor/push-notifications");
  await PushNotifications.removeAllListeners();
  await PushNotifications.addListener("registration", ({ value }) => {
    fetch("/api/devices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: value, platform: nativePlatform() }) }).catch(() => {});
  });
  await PushNotifications.register();
}

/**
 * « Pensez à activer vos notifications » : affiché dans l'application iOS / Android, ou sur le site
 * ajouté à l'écran d'accueil. Dans l'application, si les notifications ont été refusées, le bouton
 * ouvre directement la page Notifications des réglages du téléphone.
 */
export default function NotifPrompt() {
  const [state, setState] = useState<State>("hidden");
  const [native, setNative] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    let off = false;
    (async () => {
      if (isNativeApp()) {
        setNative(true);
        setIos(nativePlatform() === "ios");
        const { PushNotifications } = await import("@capacitor/push-notifications");
        const check = async () => {
          const { receive } = await PushNotifications.checkPermissions();
          if (off) return;
          if (receive === "granted") { setState("hidden"); registerDevice().catch(() => {}); }
          else setState(receive === "denied" ? "denied" : "ask");
        };
        await check();
        // Retour des réglages du téléphone : on revérifie
        const { App } = await import("@capacitor/app");
        const sub = await App.addListener("appStateChange", ({ isActive }) => { if (isActive) check().catch(() => {}); });
        if (off) sub.remove();
        return;
      }
      if (!isInstalledWebApp() || !("Notification" in window) || Notification.permission === "granted") return;
      setIos(/iPhone|iPad|iPod/.test(navigator.userAgent));
      setState(Notification.permission === "denied" ? "denied" : "ask");
    })().catch(() => {});
    return () => { off = true; };
  }, []);

  if (state === "hidden") return null;

  async function enable() {
    try {
      if (native) {
        const { PushNotifications } = await import("@capacitor/push-notifications");
        const { receive } = await PushNotifications.requestPermissions();
        if (receive === "granted") { setState("hidden"); await registerDevice(); }
        else setState("denied");
        return;
      }
      const r = await Notification.requestPermission();
      if (r === "granted") { setState("hidden"); new Notification("LSVB Billetterie", { body: "Notifications activées : vous serez prévenu quand votre commande est prête.", icon: "/icon-192.png" }); }
      else setState("denied");
    } catch { setState("denied"); }
  }

  async function openSettings() {
    const { NativeSettings, AndroidSettings, IOSSettings } = await import("capacitor-native-settings");
    await NativeSettings.open({ optionAndroid: AndroidSettings.AppNotification, optionIOS: IOSSettings.App }).catch(() => {});
  }

  return (
    <div className="notif" role="region" aria-label="Notifications">
      <div className="ni" aria-hidden="true">🔔</div>
      <div>
        <b>Pensez à activer vos notifications</b>
        {state === "ask" ? <div className="small">pour être prévenu quand votre commande est prête.</div>
          : native ? <div className="small">Elles sont désactivées pour l&apos;application : activez-les dans les réglages du téléphone.</div>
          : <div className="small">Elles sont désactivées pour l&apos;application. Ouvrez {ios ? "Réglages › Notifications › LSVB Billetterie" : "Paramètres › Applications › LSVB Billetterie › Notifications"} et activez « Autoriser les notifications ».</div>}
      </div>
      {state === "ask" ? <button type="button" className="btn pri sm" onClick={enable}>Activer</button>
        : native ? <button type="button" className="btn pri sm" onClick={openSettings}>Ouvrir les réglages</button> : null}
    </div>
  );
}
