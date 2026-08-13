import Link from "next/link";
import { notFound } from "next/navigation";

import { EncabezadoEvento } from "~/app/_components/encabezado-evento";
import { TablaMarketing } from "~/app/_components/tabla-marketing";
import { TablaMovimientos } from "~/app/_components/tabla-movimientos";
import {
  BadgeCategoria,
  BadgeCompletitud,
  Boton,
  Card,
  KpiCard,
} from "~/app/_components/ui";
import { formatEntero, formatFecha } from "~/lib/format";
import { requiereMiembro } from "~/server/auth/guard";
import { api } from "~/trpc/server";

export default async function PaginaEvento({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { puedeEditar } = await requiereMiembro();
  const { id } = await params;

  const evento = await api.evento.byId({ id }).catch(() => null);
  if (!evento) notFound();

  const r = evento.resumen;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6">
      <nav className="mb-3 text-sm text-navy-900/50">
        <Link href="/" className="hover:text-navy-700 hover:underline">
          Presupuesto general
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-navy-900/80">{evento.nombre}</span>
      </nav>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {evento.nombre}
            </h1>
            <BadgeCategoria categoria={evento.categoria} />
          </div>
          <p className="mt-0.5 text-sm text-navy-900/50">
            {formatFecha(evento.inicio)} — {formatFecha(evento.fin)} ·{" "}
            {formatEntero(evento.impactosDirectos)} impactos directos · periodo{" "}
            {evento.periodo.nombre}
          </p>
        </div>
        <Boton href={`/eventos/${evento.id}/estado-de-cuenta`} variante="secundario">
          Estado de cuenta
        </Boton>
      </div>

      <Card className="mb-4 p-4">
        <EncabezadoEvento evento={evento} puedeEditar={puedeEditar} />
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          titulo="Ingresos"
          estimado={r.ingresoEstimado}
          real={r.ingresoReal}
          varianza={r.varianzaIngreso}
        />
        <KpiCard
          titulo="Egresos"
          estimado={r.egresoEstimado}
          real={r.egresoReal}
          varianza={r.varianzaEgreso}
          invertirVarianza
        />
        <KpiCard
          titulo="Balance"
          estimado={r.balanceEstimado}
          real={r.balanceReal}
          varianza={null}
          acento
        />
      </div>

      {/* El badge dice POR QUÉ falta información, no solo que falta. */}
      <div className="mt-4">
        {r.completitud.completo ? (
          <BadgeCompletitud completitud={r.completitud} />
        ) : (
          <BadgeCompletitud completitud={r.completitud} detallado />
        )}
      </div>

      {!puedeEditar && (
        <p className="mt-3 rounded-lg bg-navy-50 px-3 py-2 text-sm text-navy-900/60">
          Tienes acceso de solo lectura. Para capturar cifras necesitas rol de
          administrador.
        </p>
      )}

      <div className="mt-6 space-y-6">
        <TablaMovimientos
          eventoId={evento.id}
          tipo="INGRESO"
          movimientos={evento.movimientos}
          puedeEditar={puedeEditar}
        />
        <TablaMovimientos
          eventoId={evento.id}
          tipo="EGRESO"
          movimientos={evento.movimientos}
          puedeEditar={puedeEditar}
        />
        <TablaMarketing
          eventoId={evento.id}
          marketing={evento.marketing}
          puedeEditar={puedeEditar}
        />
      </div>

      <p className="mt-6 text-xs text-navy-900/40">
        Los montos de las filas de ingreso y egreso son calculados: son la suma de
        su desglose, igual que el <code>SUMIFS</code> del archivo de Excel. Toda
        la captura de dinero ocurre en los renglones de desglose.
      </p>
    </main>
  );
}
