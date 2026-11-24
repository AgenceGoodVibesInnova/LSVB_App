"use client";
export default function PrintButton() {
  return <button className="btn ghost sm" onClick={() => window.print()}>Imprimer</button>;
}
