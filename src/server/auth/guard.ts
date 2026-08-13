import "server-only";

import { redirect } from "next/navigation";

import { getSession } from "~/server/better-auth/server";
import { can, rolDe } from "~/server/auth/permissions";

/**
 * Portero de las páginas del servidor.
 *
 * Esta SÍ es la barrera real (a diferencia del middleware, que solo mira si hay
 * cookie): aquí se resuelve la sesión contra la base y se consulta el rol. Un
 * usuario EXTERNO o sin sesión nunca llega a renderizar una cifra.
 */
export async function requiereMiembro() {
  const session = await getSession();
  if (!session?.user || !can(session.user, "finanzas:ver")) {
    redirect("/sin-acceso");
  }
  return {
    usuario: session.user,
    rol: rolDe(session.user),
    puedeEditar: can(session.user, "finanzas:editar"),
  };
}
