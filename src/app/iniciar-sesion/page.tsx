import { redirect } from "next/navigation";

import { env } from "~/env";
import { getSession } from "~/server/better-auth/server";

import { BotonesSociales } from "./botones";

/**
 * Pantalla de inicio de sesión.
 *
 * Es página de servidor a propósito: así decide qué botones existen leyendo las
 * credenciales del entorno, sin exponerlas al navegador ni obligar a mantener
 * una lista de proveedores duplicada en el cliente. El mismo criterio que usa
 * `proveedoresSociales()` en la config de Better Auth: un proveedor existe si
 * su par de credenciales está completo.
 */
export default async function IniciarSesion() {
  // Con sesión abierta esta pantalla no tiene nada que ofrecer. El portero de
  // cada página decidirá si el rol alcanza para ver cifras.
  const session = await getSession();
  if (session?.user) redirect("/");

  const google = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  const github = Boolean(
    env.BETTER_AUTH_GITHUB_CLIENT_ID && env.BETTER_AUTH_GITHUB_CLIENT_SECRET,
  );

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4">
      <div className="rounded-xl border border-navy-100 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-navy-900">Iniciar sesión</h1>
        <p className="mt-2 text-sm text-navy-900/60">
          El presupuesto de RoBorregos es información interna del equipo. Entra
          con tu cuenta para continuar.
        </p>

        {google || github ? (
          <BotonesSociales google={google} github={github} />
        ) : (
          // Sin credenciales no se pinta un botón que sólo puede fallar.
          <p className="mt-6 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            No hay ningún proveedor de inicio de sesión configurado. Falta poner
            las credenciales de OAuth en el entorno.
          </p>
        )}

        <p className="mt-6 border-t border-navy-100 pt-4 text-xs text-navy-900/45">
          Las cuentas nuevas entran sin acceso a las cifras. Un administrador
          tiene que asignarte un rol.
        </p>
      </div>
    </main>
  );
}
