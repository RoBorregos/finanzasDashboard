"use client";

import Link from "next/link";
import { useState } from "react";

import {
  BadgeCategoria,
  BadgeCompletitud,
  Varianza,
} from "~/app/_components/ui";
import { formatEntero, formatFecha, formatMXN } from "~/lib/format";
import type { RouterOutputs } from "~/trpc/react";

type Resumen = RouterOutputs["dashboard"]["resumenGlobal"];
type Fila = Resumen["eventos"][number];

type Columna =
  | "nombre"
  | "inicio"
  | "ingresoEstimado"
  | "egresoEstimado"
  | "balanceEstimado"
  | "ingresoReal"
  | "egresoReal"
  | "balanceReal";

const num = (d: { toString(): string }) => Number(d.toString());

/** La `Tabla_Maestra` del workbook, ordenable y con enlace a cada evento. */
export function TablaMaestra({
  eventos,
  total,
}: {
  eventos: Fila[];
  total: NonNullable<Resumen["total"]>;
}) {
  const [orden, setOrden] = useState<Columna>("nombre");
  const [asc, setAsc] = useState(true);

  const ordenados = [...eventos].sort((a, b) => {
    const dir = asc ? 1 : -1;
    if (orden === "nombre") return dir * a.nombre.localeCompare(b.nombre, "es");
    if (orden === "inicio")
      return dir * (new Date(a.inicio).getTime() - new Date(b.inicio).getTime());
    return dir * (num(a.resumen[orden]) - num(b.resumen[orden]));
  });

  const alOrdenar = (c: Columna) => {
    if (c === orden) setAsc(!asc);
    else {
      setOrden(c);
      // Los montos se leen mejor de mayor a menor; los textos y fechas, al revés.
      setAsc(c === "nombre" || c === "inicio");
    }
  };

  const Th = ({
    col,
    children,
    derecha,
  }: {
    col: Columna;
    children: React.ReactNode;
    derecha?: boolean;
  }) => (
    <th
      className={`px-3 py-2 font-medium ${derecha ? "text-right" : "text-left"}`}
    >
      <button
        type="button"
        onClick={() => alOrdenar(col)}
        className={`inline-flex items-center gap-1 hover:text-navy-800 ${
          orden === col ? "text-navy-800" : ""
        }`}
      >
        {children}
        <span className={orden === col ? "" : "opacity-0"}>
          {asc ? "▲" : "▼"}
        </span>
      </button>
    </th>
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-navy-100 bg-white shadow-sm">
      <table className="w-full min-w-[64rem] text-sm">
        <thead>
          <tr className="border-b border-navy-100 bg-navy-50/60 text-xs tracking-wide text-navy-900/60 uppercase">
            <Th col="nombre">Evento</Th>
            <th className="px-3 py-2 text-left font-medium">Categoría</th>
            <Th col="inicio">Inicio</Th>
            <Th col="ingresoEstimado" derecha>
              Ingreso est.
            </Th>
            <Th col="egresoEstimado" derecha>
              Egreso est.
            </Th>
            <Th col="balanceEstimado" derecha>
              Balance est.
            </Th>
            <Th col="ingresoReal" derecha>
              Ingreso real
            </Th>
            <Th col="egresoReal" derecha>
              Egreso real
            </Th>
            <Th col="balanceReal" derecha>
              Balance real
            </Th>
            <th className="px-3 py-2 text-right font-medium">Alcance</th>
            <th className="px-3 py-2 text-left font-medium">Estado</th>
          </tr>
        </thead>
        <tbody>
          {ordenados.map((e) => {
            const balEst = num(e.resumen.balanceEstimado);
            const balReal = num(e.resumen.balanceReal);
            return (
              <tr key={e.id} className="border-b border-navy-50 hover:bg-navy-50/40">
                <td className="px-3 py-2">
                  <Link
                    href={`/eventos/${e.id}`}
                    className="font-medium text-navy-700 hover:text-navy-900 hover:underline"
                  >
                    {e.nombre}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <BadgeCategoria categoria={e.categoria} />
                </td>
                <td className="px-3 py-2 whitespace-nowrap text-navy-900/60">
                  {formatFecha(e.inicio)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatMXN(e.resumen.ingresoEstimado)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatMXN(e.resumen.egresoEstimado)}
                </td>
                <td
                  className={`px-3 py-2 text-right font-medium tabular-nums ${
                    balEst < 0 ? "text-rose-600" : "text-emerald-700"
                  }`}
                >
                  {formatMXN(e.resumen.balanceEstimado)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-navy-900/70">
                  {formatMXN(e.resumen.ingresoReal)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-navy-900/70">
                  {formatMXN(e.resumen.egresoReal)}
                </td>
                <td
                  className={`px-3 py-2 text-right font-medium tabular-nums ${
                    balReal < 0 ? "text-rose-600" : "text-emerald-700"
                  }`}
                >
                  {formatMXN(e.resumen.balanceReal)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-navy-900/60">
                  {formatEntero(e.resumen.alcanceReal)}
                  <span className="text-navy-900/30">
                    {" / "}
                    {formatEntero(e.resumen.alcanceEstimado)}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <BadgeCompletitud completitud={e.resumen.completitud} />
                </td>
              </tr>
            );
          })}
        </tbody>

        <tfoot>
          <tr className="border-t-2 border-navy-200 bg-navy-50/60 font-semibold">
            <td colSpan={3} className="px-3 py-2.5 text-navy-900">
              Gran total · {eventos.length} eventos
            </td>
            <td className="px-3 py-2.5 text-right tabular-nums">
              {formatMXN(total.ingresoEstimado)}
            </td>
            <td className="px-3 py-2.5 text-right tabular-nums">
              {formatMXN(total.egresoEstimado)}
            </td>
            <td
              className={`px-3 py-2.5 text-right tabular-nums ${
                num(total.balanceEstimado) < 0 ? "text-rose-600" : "text-emerald-700"
              }`}
            >
              {formatMXN(total.balanceEstimado)}
            </td>
            <td className="px-3 py-2.5 text-right tabular-nums">
              {formatMXN(total.ingresoReal)}
            </td>
            <td className="px-3 py-2.5 text-right tabular-nums">
              {formatMXN(total.egresoReal)}
            </td>
            <td
              className={`px-3 py-2.5 text-right tabular-nums ${
                num(total.balanceReal) < 0 ? "text-rose-600" : "text-emerald-700"
              }`}
            >
              {formatMXN(total.balanceReal)}
            </td>
            <td className="px-3 py-2.5 text-right tabular-nums">
              {formatEntero(total.alcanceReal)}
              <span className="font-normal text-navy-900/30">
                {" / "}
                {formatEntero(total.alcanceEstimado)}
              </span>
            </td>
            <td className="px-3 py-2.5 text-xs font-normal text-navy-900/50">
              {total.eventosCompletos} de {total.totalEventos} completos
            </td>
          </tr>
          <tr className="bg-navy-50/60 text-xs">
            <td colSpan={3} className="px-3 pb-2.5 text-navy-900/50">
              Diferencia real contra estimado
            </td>
            <td colSpan={2} className="px-3 pb-2.5 text-right">
              <Varianza valor={total.varianzaIngreso} />
              <span className="ml-1 text-navy-900/40">ingreso</span>
            </td>
            <td colSpan={3} className="px-3 pb-2.5 text-right">
              <Varianza valor={total.varianzaEgreso} invertir />
              <span className="ml-1 text-navy-900/40">egreso</span>
            </td>
            <td colSpan={3} />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
