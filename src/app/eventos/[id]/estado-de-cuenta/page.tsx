import { notFound } from "next/navigation";

import { BotonImprimir } from "~/app/eventos/[id]/estado-de-cuenta/boton-imprimir";
import { etiquetaCategoria } from "~/app/_components/ui";
import {
  formatEntero,
  formatFecha,
  formatMXN,
  formatVarianza,
} from "~/lib/format";
import { requiereMiembro } from "~/server/auth/guard";
import { api } from "~/trpc/server";

/**
 * Estado de cuenta imprimible: lo que armaban las macros `Estado_De_Cuenta_Ver`
 * y `Estado_De_Cuenta_PDF`, con el mismo membrete y paleta navy + oro.
 * El PDF sale por el diálogo de impresión del navegador (Guardar como PDF).
 */
export default async function EstadoDeCuenta({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requiereMiembro();
  const { id } = await params;

  const datos = await api.export.estadoDeCuenta({ eventoId: id }).catch(() => null);
  if (!datos) notFound();

  const { evento, ingresos, egresos, marketing, resumen, emitido } = datos;

  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <div className="no-imprimir mb-4 flex items-center justify-between">
        <a
          href={`/eventos/${evento.id}`}
          className="text-sm text-navy-900/50 hover:text-navy-700 hover:underline"
        >
          ← Volver al evento
        </a>
        <BotonImprimir />
      </div>

      <article className="hoja rounded-xl border border-navy-100 bg-white p-8 shadow-sm print:p-0">
        {/* Membrete */}
        <header className="border-b-4 border-oro-400 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xl font-bold tracking-tight text-navy-900">
                ROBORREGOS
              </p>
              <p className="text-xs tracking-[0.18em] text-navy-900/55 uppercase">
                Tecnológico de Monterrey
              </p>
            </div>
            <div className="text-right text-xs text-navy-900/55">
              <p className="font-semibold tracking-wide text-navy-900 uppercase">
                Estado de cuenta
              </p>
              <p className="mt-0.5">Periodo {evento.periodo}</p>
              <p>Emitido el {formatFecha(emitido)}</p>
              <p>Cifras en pesos mexicanos (MXN)</p>
            </div>
          </div>
        </header>

        {/* Datos del evento */}
        <section className="mt-5">
          <h1 className="text-lg font-semibold text-navy-900">{evento.nombre}</h1>
          <dl className="mt-2 grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:grid-cols-3">
            {[
              ["Categoría", etiquetaCategoria(evento.categoria)],
              [
                "Periodo del evento",
                `${formatFecha(evento.inicio)} — ${formatFecha(evento.fin)}`,
              ],
              ["Lugar", evento.lugar ?? "—"],
              ["Responsable", evento.responsable ?? "—"],
              ["Impactos directos", formatEntero(evento.impactosDirectos)],
              ["Alcance en redes", formatEntero(resumen.alcanceReal)],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-navy-900/45">{k}</dt>
                <dd className="text-navy-900/85">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <SeccionMovimientos titulo="Ingresos" filas={ingresos} />
        <SeccionMovimientos titulo="Egresos" filas={egresos} />

        {/* Resumen financiero */}
        <section className="mt-6">
          <h2 className="mb-2 border-b border-navy-200 pb-1 text-sm font-semibold tracking-wide text-navy-800 uppercase">
            Resumen
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-navy-900/50">
                <th className="py-1 text-left font-medium">Concepto</th>
                <th className="py-1 text-right font-medium">Estimado</th>
                <th className="py-1 text-right font-medium">Real</th>
                <th className="py-1 text-right font-medium">Diferencia</th>
              </tr>
            </thead>
            <tbody>
              <FilaResumen
                concepto="Ingresos"
                estimado={formatMXN(resumen.ingresoEstimado)}
                real={formatMXN(resumen.ingresoReal)}
                diferencia={formatVarianza(resumen.varianzaIngreso)}
              />
              <FilaResumen
                concepto="Egresos"
                estimado={formatMXN(resumen.egresoEstimado)}
                real={formatMXN(resumen.egresoReal)}
                diferencia={formatVarianza(resumen.varianzaEgreso)}
              />
              <tr className="border-t-2 border-navy-800 font-semibold">
                <td className="py-1.5">Balance</td>
                <td className="py-1.5 text-right tabular-nums">
                  {formatMXN(resumen.balanceEstimado)}
                </td>
                <td className="py-1.5 text-right tabular-nums">
                  {formatMXN(resumen.balanceReal)}
                </td>
                <td className="py-1.5 text-right tabular-nums">—</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Marketing */}
        {marketing.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-2 border-b border-navy-200 pb-1 text-sm font-semibold tracking-wide text-navy-800 uppercase">
              Marketing
            </h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-navy-900/50">
                  <th className="py-1 text-left font-medium">ID</th>
                  <th className="py-1 text-left font-medium">Red</th>
                  <th className="py-1 text-left font-medium">Concepto</th>
                  <th className="py-1 text-right font-medium">Vistas est.</th>
                  <th className="py-1 text-right font-medium">Vistas real</th>
                  <th className="py-1 text-right font-medium">Inter. est.</th>
                  <th className="py-1 text-right font-medium">Inter. real</th>
                </tr>
              </thead>
              <tbody>
                {marketing.map((m) => (
                  <tr key={m.id} className="border-t border-navy-50">
                    <td className="py-1 text-navy-900/60">{m.codigo}</td>
                    <td className="py-1">{m.redSocial}</td>
                    <td className="py-1">{m.concepto}</td>
                    <td className="py-1 text-right tabular-nums">
                      {formatEntero(m.vistasEstimado)}
                    </td>
                    <td className="py-1 text-right tabular-nums">
                      {formatEntero(m.vistasReal)}
                    </td>
                    <td className="py-1 text-right tabular-nums">
                      {formatEntero(m.interaccionEstimado)}
                    </td>
                    <td className="py-1 text-right tabular-nums">
                      {formatEntero(m.interaccionReal)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-navy-300 font-semibold">
                  <td colSpan={3} className="py-1.5">
                    Total
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {formatEntero(resumen.alcanceEstimado)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {formatEntero(resumen.alcanceReal)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {formatEntero(resumen.interaccionesEstimado)}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">
                    {formatEntero(resumen.interaccionesReal)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </section>
        )}

        <footer className="mt-8 border-t border-navy-100 pt-3 text-[11px] text-navy-900/45">
          <p>
            Documento generado automáticamente desde el sistema de finanzas de
            RoBorregos. Los montos de cada partida son la suma de su desglose.
            {!resumen.completitud.completo &&
              " Este evento tiene datos faltantes: las cifras reales pueden estar incompletas."}
          </p>
        </footer>
      </article>
    </main>
  );
}

function FilaResumen({
  concepto,
  estimado,
  real,
  diferencia,
}: {
  concepto: string;
  estimado: string;
  real: string;
  diferencia: string;
}) {
  return (
    <tr className="border-t border-navy-50">
      <td className="py-1.5">{concepto}</td>
      <td className="py-1.5 text-right tabular-nums">{estimado}</td>
      <td className="py-1.5 text-right tabular-nums">{real}</td>
      <td className="py-1.5 text-right tabular-nums">{diferencia}</td>
    </tr>
  );
}

type FilaMovimiento = {
  id: string;
  codigo: string;
  fuente: string | null;
  concepto: string;
  fecha: Date | null;
  estimado: { toString(): string };
  real: { toString(): string };
  desglose: { id: string; subCodigo: string; concepto: string }[];
};

function SeccionMovimientos({
  titulo,
  filas,
}: {
  titulo: string;
  filas: FilaMovimiento[];
}) {
  return (
    <section className="mt-6 break-inside-avoid">
      <h2 className="mb-2 border-b border-navy-200 pb-1 text-sm font-semibold tracking-wide text-navy-800 uppercase">
        {titulo}
      </h2>
      {filas.length === 0 ? (
        <p className="py-2 text-sm text-navy-900/40">Sin movimientos.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-navy-900/50">
              <th className="py-1 text-left font-medium">ID</th>
              <th className="py-1 text-left font-medium">Fuente</th>
              <th className="py-1 text-left font-medium">Concepto</th>
              <th className="py-1 text-left font-medium">Fecha</th>
              <th className="py-1 text-right font-medium">Estimado</th>
              <th className="py-1 text-right font-medium">Real</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((m) => (
              <tr key={m.id} className="border-t border-navy-50">
                <td className="py-1 whitespace-nowrap text-navy-900/60">
                  {m.codigo}
                </td>
                <td className="py-1">{m.fuente ?? "—"}</td>
                <td className="py-1">
                  {m.concepto || "—"}
                  {m.desglose.length > 0 && (
                    <span className="ml-1 text-xs text-navy-900/35">
                      ({m.desglose.length}{" "}
                      {m.desglose.length === 1 ? "partida" : "partidas"})
                    </span>
                  )}
                </td>
                <td className="py-1 whitespace-nowrap text-navy-900/60">
                  {formatFecha(m.fecha)}
                </td>
                <td className="py-1 text-right tabular-nums">
                  {formatMXN(m.estimado as never)}
                </td>
                <td className="py-1 text-right tabular-nums">
                  {formatMXN(m.real as never)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
