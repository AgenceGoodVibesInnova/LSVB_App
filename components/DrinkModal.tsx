"use client";
import { useEffect, useRef } from "react";
import { DRINKS } from "@/lib/catalog";

/** Fenêtre de choix de la boisson (formules et boisson seule). */
export default function DrinkModal({ title, onPick, onClose }: { title: string; onPick: (drink: string) => void; onClose: () => void }) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    first.current?.focus();
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="drink-title" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mbox">
        <div className="mhead">
          <div><div className="kick">Choisissez votre boisson</div><div className="mt" id="drink-title">{title}</div></div>
          <button className="mx" aria-label="Fermer" onClick={onClose}>×</button>
        </div>
        <div className="drinks">
          {DRINKS.map((d, i) => (
            <button key={d.name} ref={i === 0 ? first : undefined} type="button" className="drink" onClick={() => onPick(d.name)}>
              <span className="di">{d.icon}</span><b>{d.name}</b>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
