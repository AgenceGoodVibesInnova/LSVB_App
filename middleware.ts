import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rafraîchit la session de l'équipe (cookies Supabase) et protège /scanner et /admin.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );
  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  if (!user && (path.startsWith("/scanner") || path.startsWith("/admin"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/equipe/connexion";
    url.search = `?suite=${encodeURIComponent(path)}`;
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  // Seulement là où une session d'équipe peut servir (pas d'appel à Supabase pour les pages publiques).
  matcher: ["/scanner/:path*", "/admin/:path*", "/equipe/:path*", "/api/scan/:path*", "/api/admin/:path*", "/api/orders", "/"],
};
