export const euros = (cents: number) =>
  (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

const TZ = "Europe/Paris";

export const longDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: TZ })} · ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: TZ })}`;
};

export const shortDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", timeZone: TZ })} ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: TZ })}`;
};

export const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: TZ });

/** « 2026-12-11T20:00 » (heure de Paris) pour un champ datetime-local. */
export function toParisInput(iso: string) {
  const parts = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}

/** Heure de Paris saisie (« 2026-12-11T20:00 ») → instant ISO, en tenant compte de l'heure d'été. */
export function fromParisInput(v: string) {
  const [d, t] = v.split("T");
  const [y, m, day] = d.split("-").map(Number);
  const [h, mi] = t.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, day, h, mi);
  const offsetAt = (ms: number) => {
    const s = new Date(ms).toLocaleString("en-US", { timeZone: TZ, timeZoneName: "longOffset" });
    const mm = s.match(/GMT([+-]\d{2}):?(\d{2})?/);
    return mm ? (Number(mm[1]) * 60 + Math.sign(Number(mm[1])) * Number(mm[2] ?? 0)) : 0;
  };
  return new Date(guess - offsetAt(guess) * 60000).toISOString();
}

const ALPH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function code(n: number) {
  const a = new Uint32Array(n);
  crypto.getRandomValues(a);
  return Array.from(a, (x) => ALPH[x % ALPH.length]).join("");
}

export const CODE_RE = /([A-Z0-9]{8})-(\d{1,3})-([A-Z0-9]{4})/;
export const passCode = (orderId: string, idx: number, token: string) => `${orderId}-${idx}-${token}`;

/** Texte comparable pour les recherches : minuscules, sans accents (« Léa » est trouvée avec « lea »). */
export const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
