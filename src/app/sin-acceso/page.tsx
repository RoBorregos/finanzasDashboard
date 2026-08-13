import { getSession } from "~/server/better-auth/server";
import { rolDe } from "~/server/auth/permissions";

/**
 * Muro para quien no tiene acceso: sin sesión, o con rol EXTERNO.
 * No muestra ni una cifra, ni siquiera agregada.
 *
 * TODO(auth): aquí va el botón de inicio de sesión / registro cuando el flujo
 * de autenticación esté definido.
 */
export default async function SinAcceso() {
  const session = await getSession();
  const rol = rolDe(session?.user);
  const autenticado = Boolean(session?.user);

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <div className="rounded-xl border border-navy-100 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-navy-900">
          {autenticado ? "Tu cuenta aún no tiene acceso" : "Necesitas iniciar sesión"}
        </h1>

        {autenticado ? (
          <>
            <p className="mt-3 text-sm text-navy-900/60">
              Estás dentro como{" "}
              <span className="font-medium text-navy-900/80">
                {session?.user.email}
              </span>
              , con rol <code className="text-navy-700">{rol}</code>. La
              información financiera está reservada a miembros aceptados del
              equipo.
            </p>
            <p className="mt-3 text-sm text-navy-900/60">
              Pide a un administrador que te asigne el rol de{" "}
              <code className="text-navy-700">MIEMBRO</code> para consultar
              cifras, o <code className="text-navy-700">ADMIN</code> para
              capturarlas.
            </p>
          </>
        ) : (
          <p className="mt-3 text-sm text-navy-900/60">
            El presupuesto de RoBorregos es información interna del equipo.
            Inicia sesión con tu cuenta para continuar.
          </p>
        )}
      </div>
    </main>
  );
}
