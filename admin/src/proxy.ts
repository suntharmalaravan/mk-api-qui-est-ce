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
  // L’optimiseur Next charge la loupe sans cookie : sa source doit être publique.
  // Exclusion limitée à cet asset, les pages et exports restent protégés.
  matcher: ['/((?!_next/static|_next/image|images/loupe[.]png$|favicon.ico|icon.svg|robots.txt).*)'],
};
