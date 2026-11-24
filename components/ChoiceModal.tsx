"use client";
import { useEffect, useRef } from "react";

/** Fenêtre de choix : boisson offerte d'un menu, taille d'un t-shirt… */
export default function ChoiceModal({ title, kicker, choices, onPick, onClose }: {
  title: string; kicker: string; choices: { name: string; icon: string | null }[]; onPick: (c: string) => void; onClose: () => void;
}) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    first.current?.focus();
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onClose]);
  const sizes = choices.every((c) => !c.icon);
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="choice-title" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="mbox">
        <div className="mhead">
          <div><div className="kick">{kicker}</div><div className="mt" id="choice-title">{title}</div></div>
          <button className="mx" aria-label="Fermer" onClick={onClose}>×</button>
        </div>
        <div className={`drinks${sizes ? " sizes" : ""}`}>
          {choices.map((c, i) => (
            <button key={c.name} ref={i === 0 ? first : undefined} type="button" className="drink" onClick={() => onPick(c.name)}>
              {c.icon ? <span className="di">{c.icon}</span> : null}<b>{c.name}</b>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
