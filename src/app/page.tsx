import {
  GraficaBalancePorCategoria,
  GraficaEjercido,
  GraficaEstimadoVsReal,
} from "~/app/_components/graficas";
import { TablaMaestra } from "~/app/_components/tabla-maestra";
import { Boton, Card, KpiCard } from "~/app/_components/ui";
import { formatEntero } from "~/lib/format";
import { requiereMiembro } from "~/server/auth/guard";
import { api } from "~/trpc/server";

/**
 * Dashboard global: el equivalente de la hoja MAESTRA.
 *
 * A diferencia del workbook, aquí nada está guardado: cada carga vuelve a
 * agregar desde el desglose. No existe la posibilidad de que la vista muestre
 * cifras viejas porque alguien no corrió la macro.
 */
export default async function Home() {
  await requiereMiembro();
  const { periodo, eventos, total } = await api.dashboard.resumenGlobal();

  if (!periodo || !total) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">Todavía no hay nada que mostrar</h1>
        <p className="mt-2 text-navy-900/60">
          Crea el primer evento o corre <code>npm run db:seed</code> para importar
          el presupuesto.
        </p>
        <div className="mt-6">
          <Boton href="/eventos/nuevo">Crear evento</Boton>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Presupuesto general
          </h1>
          <p className="text-sm text-navy-900/50">
            Periodo {periodo.nombre} · {eventos.length} eventos · cifras en pesos
            mexicanos
          </p>
        </div>
        <Boton href="/eventos/nuevo">+ Nuevo evento</Boton>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          titulo="Ingresos"
          estimado={total.ingresoEstimado}
          real={total.ingresoReal}
          varianza={total.varianzaIngreso}
        />
        <KpiCard
          titulo="Egresos"
          estimado={total.egresoEstimado}
          real={total.egresoReal}
          varianza={total.varianzaEgreso}
          invertirVarianza
        />
        <KpiCard
          titulo="Balance"
          estimado={total.balanceEstimado}
          real={total.balanceReal}
          varianza={null}
          acento
        />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs font-medium tracking-wide text-navy-900/50 uppercase">
            Alcance
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {formatEntero(total.alcanceReal)}
          </p>
          <p className="mt-0.5 text-xs text-navy-900/45">
            de {formatEntero(total.alcanceEstimado)} estimado
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium tracking-wide text-navy-900/50 uppercase">
            Interacciones
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {formatEntero(total.interaccionesReal)}
          </p>
          <p className="mt-0.5 text-xs text-navy-900/45">
            de {formatEntero(total.interaccionesEstimado)} estimado
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium tracking-wide text-navy-900/50 uppercase">
            Reportes completos
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums">
            {total.eventosCompletos}
            <span className="text-base font-normal text-navy-900/40">
              {" / "}
              {total.totalEventos}
            </span>
          </p>
          <p className="mt-0.5 text-xs text-navy-900/45">
            eventos sin datos faltantes
          </p>
        </Card>
      </div>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-semibold tracking-wide text-navy-900/70 uppercase">
          Eventos
        </h2>
        <TablaMaestra eventos={eventos} total={total} />
      </section>

      <section className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-4 lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-navy-900/70 uppercase">
            Estimado contra real por evento
          </h2>
          <GraficaEstimadoVsReal eventos={eventos} />
        </Card>
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-navy-900/70 uppercase">
            Balance estimado por categoría
          </h2>
          <GraficaBalancePorCategoria eventos={eventos} />
        </Card>
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold tracking-wide text-navy-900/70 uppercase">
            Presupuesto ejercido
          </h2>
          <GraficaEjercido eventos={eventos} />
        </Card>
      </section>
    </main>
  );
}
