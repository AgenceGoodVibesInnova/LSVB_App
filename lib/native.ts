"use client";
import { Capacitor } from "@capacitor/core";

/** Vrai dans l'application iOS / Android (Capacitor), faux dans un navigateur. */
export const isNativeApp = () => Capacitor.isNativePlatform();
export const nativePlatform = () => Capacitor.getPlatform() as "ios" | "android" | "web";

/** Vrai quand le site est ouvert depuis l'écran d'accueil (application web installée). */
export function isInstalledWebApp() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}
