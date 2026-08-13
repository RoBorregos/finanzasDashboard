import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Portero optimista.
 *
 * El middleware corre en el edge runtime, donde Prisma no existe: aquí NO se
 * puede consultar la base ni leer el rol del usuario. Lo único que se hace es
 * mirar si existe la cookie de sesión y, si no, mandar a `/sin-acceso` sin
 * gastar un render.
 *
 * La autorización de verdad —¿es ADMIN, MIEMBRO o EXTERNO?— vive en las
 * procedures de tRPC (`memberProcedure` / `adminProcedure`) y en el layout del
 * servidor, que sí tienen base de datos. Esto es una comodidad de navegación,
 * nunca la barrera de seguridad: una cookie presente no prueba nada.
 */
export function middleware(request: NextRequest) {
  const tieneCookie = getSessionCookie(request);
  if (!tieneCookie) {
    const url = new URL("/sin-acceso", request.url);
    url.searchParams.set("desde", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  /**
   * Protege todo salvo los recursos de la propia app, la API de auth y las
   * páginas públicas. La API de tRPC se deja pasar a propósito: se protege
   * sola, procedure por procedure, y devuelve 401/403 en vez de un redirect
   * que el cliente no sabría interpretar.
   */
  matcher: [
    "/((?!api/auth|api/trpc|_next/static|_next/image|favicon.ico|sin-acceso|iniciar-sesion).*)",
  ],
};
