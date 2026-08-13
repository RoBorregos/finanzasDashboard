/**
 * Reglas de autorización, en un solo lugar.
 *
 * Toda decisión de permisos del sistema pasa por `can()`. Si mañana cambian las
 * reglas (por ejemplo, que TESORERO edite pero no borre), se cambian aquí y no
 * hay que ir a cazar condicionales por los routers y las páginas.
 */

export type Rol = "ADMIN" | "MIEMBRO" | "EXTERNO";

export type Accion =
  /** Ver cualquier cifra: dashboards, tablas, estado de cuenta, export. */
  | "finanzas:ver"
  /** Crear, editar o borrar eventos, movimientos, desglose y marketing. */
  | "finanzas:editar"
  /** Administrar roles de usuarios. TODO(auth): aún no hay UI para esto. */
  | "usuarios:administrar";

/** Lo mínimo que se necesita saber de un usuario para decidir. */
export interface UsuarioAutorizable {
  role?: string | null;
}

const REGLAS: Record<Accion, readonly Rol[]> = {
  "finanzas:ver": ["ADMIN", "MIEMBRO"],
  "finanzas:editar": ["ADMIN"],
  "usuarios:administrar": ["ADMIN"],
};

/**
 * Normaliza el rol que viene de la sesión. Better Auth entrega los
 * `additionalFields` como string suelto, no como el enum de Prisma, así que
 * cualquier valor desconocido —o ausente— cae a EXTERNO: negar por omisión.
 */
export function rolDe(usuario: UsuarioAutorizable | null | undefined): Rol {
  const bruto = usuario?.role;
  if (bruto === "ADMIN" || bruto === "MIEMBRO" || bruto === "EXTERNO") {
    return bruto;
  }
  return "EXTERNO";
}

export function can(
  usuario: UsuarioAutorizable | null | undefined,
  accion: Accion,
): boolean {
  if (!usuario) return false;
  return REGLAS[accion].includes(rolDe(usuario));
}

/** Azúcar para la UI: ¿este usuario puede editar? */
export const puedeEditar = (usuario: UsuarioAutorizable | null | undefined) =>
  can(usuario, "finanzas:editar");

/** Azúcar para la UI: ¿este usuario puede ver cifras? */
export const puedeVer = (usuario: UsuarioAutorizable | null | undefined) =>
  can(usuario, "finanzas:ver");
