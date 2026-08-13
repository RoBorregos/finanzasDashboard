import Link from "next/link";

import { FormularioNuevoEvento } from "~/app/eventos/nuevo/formulario";
import { Card } from "~/app/_components/ui";
import { requiereMiembro } from "~/server/auth/guard";

export default async function PaginaNuevoEvento() {
  const { puedeEditar } = await requiereMiembro();

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <nav className="mb-3 text-sm text-navy-900/50">
        <Link href="/" className="hover:text-navy-700 hover:underline">
          Presupuesto general
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-navy-900/80">Nuevo evento</span>
      </nav>

      <h1 className="mb-1 text-2xl font-semibold tracking-tight">Nuevo evento</h1>
      <p className="mb-5 text-sm text-navy-900/50">
        Equivale a agregar una hoja nueva al archivo. Los ingresos, egresos y
        marketing se capturan después, dentro del evento.
      </p>

      {puedeEditar ? (
        <Card className="p-5">
          <FormularioNuevoEvento />
        </Card>
      ) : (
        <Card className="p-5">
          <p className="text-sm text-navy-900/60">
            Solo un administrador puede crear eventos. Tu cuenta tiene acceso de
            lectura.
          </p>
        </Card>
      )}
    </main>
  );
}
