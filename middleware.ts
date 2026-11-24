import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rafraîchit la session (clients et équipe) et protège les espaces privés.
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
  const go = (to: string) => {
    const url = request.nextUrl.clone();
    url.pathname = to;
    url.search = `?suite=${encodeURIComponent(path)}`;
    return NextResponse.redirect(url);
  };
  if (!user && path.startsWith("/compte")) return go("/connexion");
  if (!user && (path.startsWith("/scanner") || (path.startsWith("/admin") && !path.startsWith("/admin/connexion")))) return go("/admin/connexion");
  return response;
}

export const config = {
  // Pas de middleware pour les fichiers statiques, ni pour la notification SumUp.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.png|robots.txt|api/sumup|.*\\.(?:png|svg|jpg|jpeg|webp|ico|woff2|ttf|js|css|map)$).*)"],
};
