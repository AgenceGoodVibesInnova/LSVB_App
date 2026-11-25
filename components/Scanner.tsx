"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { shortDate } from "@/lib/format";

type Ev = { id: string; name: string; startsAt: string };
type Result = { result: "ok" | "warn" | "bad" | "wait"; title: string; detail?: string; who?: string; code?: string; items?: { label: string; q: number }[] | null };
type Log = { kind: "ok" | "warn" | "bad"; text: string; at: number };

const ICON = { ok: "✅", warn: "⚠️", bad: "⛔", wait: "⏳" };

export default function Scanner({ events, defaultEvent }: { events: Ev[]; defaultEvent: string }) {
  const [eventId, setEventId] = useState(defaultEvent);
  const [mode, setMode] = useState<"ticket" | "food" | "shop">("ticket");
  const [res, setRes] = useState<Result | null>(null);
  const [flash, setFlash] = useState(0);
  const [log, setLog] = useState<Log[]>([]);
  const [stats, setStats] = useState({ ticket: { n: 0, u: 0 }, food: { n: 0, u: 0 }, shop: { n: 0, u: 0 } });
  const [last, setLast] = useState<string | null>(null);
  const [cam, setCam] = useState(false);
  const [camMsg, setCamMsg] = useState("");
  const busy = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const lastSeen = useRef({ text: "", at: 0 });

  const loadStats = useCallback(async () => {
    if (!eventId) return;
    const r = await fetch(`/api/scan/stats?event=${encodeURIComponent(eventId)}`, { cache: "no-store" }).catch(() => null);
    if (r?.ok) setStats(await r.json());
  }, [eventId]);
  useEffect(() => { loadStats(); const t = setInterval(loadStats, 15000); return () => clearInterval(t); }, [loadStats]);

  const show = (r: Result) => {
    setRes(r); setFlash((f) => f + 1);
    try { navigator.vibrate?.(r.result === "ok" ? 80 : [60, 60, 60]); } catch {}
  };
  const addLog = (kind: Log["kind"], text: string) => setLog((l) => [{ kind, text, at: Date.now() }, ...l].slice(0, 40));

  const scan = useCallback(async (raw: string) => {
    if (busy.current || !raw) return;
    busy.current = true;
    show({ result: "wait", title: "Vérification…" });
    try {
      const r = await fetch("/api/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: raw, eventId, mode }) });
      if (r.status === 401) { show({ result: "bad", title: "Session expirée", detail: "Reconnectez-vous" }); return; }
      const d = (await r.json()) as Result;
      show(d);
      addLog(d.result as Log["kind"], [d.detail, d.who].filter(Boolean).join(" · ") || d.title);
      setLast(d.result === "ok" ? d.code ?? null : null);
      if (d.result === "ok") loadStats();
    } catch {
      show({ result: "bad", title: "Erreur réseau", detail: "Réessayez dans un instant" });
    } finally {
      busy.current = false;
      input.current?.focus();
    }
  }, [eventId, mode, loadStats]);

  async function undo() {
    if (!last) return;
    await fetch("/api/scan/undo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: last }) });
    addLog("warn", `Annulation ${last}`); setLast(null); setRes(null); loadStats();
  }

  // Caméra en direct
  function stopCam() {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null; setCam(false);
  }
  async function startCam() {
    if (stream.current) return stopCam();
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      stream.current = s; setCam(true); setCamMsg("");
    } catch {
      setCamMsg("Caméra indisponible : autorisez-la dans le navigateur, ou utilisez « Photo du QR » ou une douchette.");
    }
  }
  useEffect(() => {
    if (!cam || !video.current || !stream.current) return;
    const v = video.current;
    v.srcObject = stream.current;
    v.play().catch(() => {});
    const c = document.createElement("canvas");
    const x = c.getContext("2d", { willReadFrequently: true })!;
    let t: ReturnType<typeof setTimeout>;
    const loop = () => {
      if (!stream.current) return;
      if (v.readyState >= 2 && v.videoWidth) {
        const w = 640, h = Math.round((640 * v.videoHeight) / v.videoWidth);
        c.width = w; c.height = h; x.drawImage(v, 0, 0, w, h);
        const q = jsQR(x.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" });
        if (q?.data && (q.data !== lastSeen.current.text || Date.now() - lastSeen.current.at > 4000)) {
          lastSeen.current = { text: q.data, at: Date.now() };
          scan(q.data);
        }
      }
      t = setTimeout(loop, 180);
    };
    loop();
    return () => clearTimeout(t);
  }, [cam, scan]);
  useEffect(() => () => stopCam(), []);

  async function photo(f: File) {
    try {
      const bmp = await createImageBitmap(f);
      for (const max of [1000, 1600, 700]) {
        const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
        const w = Math.round(bmp.width * s), h = Math.round(bmp.height * s);
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        const x = c.getContext("2d")!; x.drawImage(bmp, 0, 0, w, h);
        const q = jsQR(x.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "attemptBoth" });
        if (q?.data) return scan(q.data);
      }
      show({ result: "warn", title: "QR illisible", detail: "Reprenez la photo plus près et bien nette" });
    } catch {
      show({ result: "warn", title: "Image illisible", detail: "Reprenez la photo" });
    }
  }

  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
  const cls = res && res.result !== "wait" ? ` ${res.result}` : "";

  return (
    <div className="grid2">
      <div>
        <div className="card">
          <div className="row" style={{ alignItems: "flex-end" }}>
            <label className="f" style={{ flex: 2 }}><span>Match contrôlé</span>
              <select value={eventId} onChange={(e) => { setEventId(e.target.value); setRes(null); }}>
                {events.map((e) => <option key={e.id} value={e.id}>{shortDate(e.startsAt)} — {e.name}</option>)}
              </select>
            </label>
            <div style={{ flex: 2, marginBottom: 12 }}>
              <div className="mode">
                {([["ticket", "🎟️ Entrée"], ["food", "🥪 Buvette"], ["shop", "👕 Boutique"]] as const).map(([m, l]) => (
                  <button key={m} className={mode === m ? "on" : ""} onClick={() => { setMode(m); setRes(null); input.current?.focus(); }}>{l}</button>
                ))}
              </div>
            </div>
          </div>
          <div key={flash} className={`result${cls}${res ? " flash" : ""}`} aria-live="assertive">
            {res ? (<>
              <div className="ico">{ICON[res.result]}</div>
              <div className="big">{res.title}</div>
              {res.detail ? <div className="det">{res.detail}</div> : null}
              {res.who ? <div className="small" style={{ opacity: 0.9 }}>{res.who}</div> : null}
              {res.items?.length ? (<>
                <ul className="scan-items">{res.items.map((i, k) => <li key={k}><b>{i.q}</b> {i.label}</li>)}</ul>
                <div className="small" style={{ opacity: 0.9 }}>Commande payée · {res.items.reduce((n, i) => n + i.q, 0)} article(s)</div>
              </>) : null}
            </>) : (<>
              <div className="ico">📷</div>
              <div className="big" style={{ color: "var(--muted)" }}>Prêt à scanner</div>
              <div className="det muted">Mode {mode === "ticket" ? "Entrée" : mode === "food" ? "Buvette" : "Boutique"} · scannez un QR ou saisissez le code</div>
            </>)}
          </div>
          {last ? <div style={{ textAlign: "center", marginTop: 10 }}><button className="btn ghost sm" onClick={undo}>Annuler ce passage</button></div> : null}
        </div>
        <div className="card">
          <div className="row">
            <button className="btn blue" onClick={startCam}>{cam ? "⏹ Couper la caméra" : "📷 Activer la caméra"}</button>
            <label className="btn ghost filebtn">📸 Photo du QR
              <input type="file" accept="image/*" capture="environment" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) photo(f); }} />
            </label>
          </div>
          {cam ? <div className="video"><video ref={video} playsInline muted /><div className="frame" /></div> : null}
          {camMsg ? <p className="small muted">{camMsg}</p> : null}
          <label className="f" style={{ marginTop: 14, marginBottom: 0 }}><span>Code ou douchette (Entrée pour valider)</span>
            <input ref={input} type="text" placeholder="K7P2QX9M-1-H4T2" autoComplete="off" autoCapitalize="characters" spellCheck={false} autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") { const v = e.currentTarget.value.trim(); e.currentTarget.value = ""; scan(v); } }} />
          </label>
        </div>
      </div>
      <div>
        <div className="card">
          <div className="sec-title">En direct</div>
          <div className="stats">
            <div className="stat"><span>Entrées</span><b>{stats.ticket.u} / {stats.ticket.n}</b><div className="bar"><i style={{ width: `${pct(stats.ticket.u, stats.ticket.n)}%` }} /></div></div>
            <div className="stat o"><span>Buvette servie</span><b>{stats.food.u} / {stats.food.n}</b><div className="bar"><i style={{ width: `${pct(stats.food.u, stats.food.n)}%` }} /></div></div>
            {stats.shop.n ? <div className="stat"><span>Boutique remise</span><b>{stats.shop.u} / {stats.shop.n}</b><div className="bar"><i style={{ width: `${pct(stats.shop.u, stats.shop.n)}%` }} /></div></div> : null}
          </div>
        </div>
        <div className="card">
          <div className="sec-title">Derniers passages <span className="muted small" style={{ textTransform: "none", fontWeight: 600, letterSpacing: 0 }}>(cet appareil)</span></div>
          <ul className="log">
            {log.length ? log.map((l, i) => (
              <li key={i}><span className="c" style={{ background: `var(--${l.kind === "ok" ? "ok" : l.kind === "warn" ? "warn" : "bad"})` }} /><span>{l.text}</span><time>{new Date(l.at).toLocaleTimeString("fr-FR")}</time></li>
            )) : <li className="muted">Aucun scan pour l&apos;instant.</li>}
          </ul>
        </div>
      </div>
    </div>
  );
}
