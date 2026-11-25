import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Application iOS / Android : elle ouvre la billetterie en ligne (site Vercel) dans une vue native,
 * avec les notifications, la caméra (scanner) et l'accès aux réglages du téléphone.
 * Mettre ici l'adresse définitive du site (APP_URL) avant de construire les applications.
 */
const url = process.env.APP_URL ?? "https://app.lsvb.fr";

const config: CapacitorConfig = {
  appId: "fr.lsvb.billetterie",
  appName: "LSVB Billetterie",
  webDir: "mobile/www",
  server: {
    url,
    cleartext: false,
    // Page affichée si le site ne répond pas (pas de réseau)
    errorPath: "hors-ligne.html",
    allowNavigation: [new URL(url).host, "*.sumup.com"],
  },
  backgroundColor: "#1F5190",
  ios: { contentInset: "never", limitsNavigationsToAppBoundDomains: false },
  android: { allowMixedContent: false },
  plugins: {
    SplashScreen: { launchShowDuration: 1200, backgroundColor: "#1F5190", showSpinner: false },
    StatusBar: { style: "DARK", backgroundColor: "#1F5190", overlaysWebView: false },
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
  },
};

export default config;
