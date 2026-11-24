import { NextResponse } from "next/server";
import { staffMember } from "@/lib/auth";
export async function GET() {
  const s = await staffMember();
  return NextResponse.json({ role: s?.role ?? null });
}
