import { redirect } from "next/navigation";
// Ancienne adresse : le scanner est dans l'espace administrateur
export default function Page() { redirect("/admin/scanner"); }
