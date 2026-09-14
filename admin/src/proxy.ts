import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, isValidSession } from '@/lib/auth/token';

// Redirection anticipée seulement : l'autorisation est revérifiée par requireAdmin().
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const authenticated = await isValidSession(request.cookies.get(SESSION_COOKIE)?.value);

  if (pathname === '/login') {
    return authenticated ? NextResponse.redirect(new URL('/', request.url)) : NextResponse.next();
  }
  if (authenticated) return NextResponse.next();

  const login = new URL('/login', request.url);
  if (pathname !== '/') login.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  // Fichiers publics exclus : sans session, l'icône de la page de connexion serait redirigée elle aussi.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)'],
};
