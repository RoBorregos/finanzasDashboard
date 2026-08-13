"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { etiquetaCategoria } from "~/app/_components/ui";
import { formatMXN } from "~/lib/format";
import type { RouterOutputs } from "~/trpc/react";

type Filas = RouterOutputs["dashboard"]["resumenGlobal"]["eventos"];

const NAVY = "#22417a";
const ORO = "#d9a93a";
const VERDE = "#059669";
const ROJO = "#e11d48";

/** Los montos entran como Decimal; recharts necesita number. */
const n = (d: { toString(): string }) => Number(d.toString());

const ejeY = (v: number) =>
  Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : String(v);

function TooltipMoneda({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-navy-100 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-medium text-navy-900">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="tabular-nums">{formatMXN(p.value ?? 0)}</span>
        </p>
      ))}
    </div>
  );
}

/** Estimado contra real por evento — la comparación central del workbook. */
export function GraficaEstimadoVsReal({ eventos }: { eventos: Filas }) {
  const datos = eventos.map((e) => ({
    nombre: e.nombre.length > 16 ? e.nombre.slice(0, 15) + "…" : e.nombre,
    "Ingreso estimado": n(e.resumen.ingresoEstimado),
    "Ingreso real": n(e.resumen.ingresoReal),
    "Egreso estimado": n(e.resumen.egresoEstimado),
    "Egreso real": n(e.resumen.egresoReal),
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={datos} margin={{ top: 8, right: 8, bottom: 60, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e9f4" vertical={false} />
        <XAxis
          dataKey="nombre"
          angle={-45}
          textAnchor="end"
          interval={0}
          tick={{ fontSize: 11, fill: "#14264c99" }}
        />
        <YAxis tickFormatter={ejeY} tick={{ fontSize: 11, fill: "#14264c99" }} />
        <Tooltip content={<TooltipMoneda />} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Ingreso estimado" fill={NAVY} fillOpacity={0.35} />
        <Bar dataKey="Ingreso real" fill={NAVY} />
        <Bar dataKey="Egreso estimado" fill={ORO} fillOpacity={0.35} />
        <Bar dataKey="Egreso real" fill={ORO} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Balance estimado por categoría: dónde se gana y dónde se gasta. */
export function GraficaBalancePorCategoria({ eventos }: { eventos: Filas }) {
  const porCategoria = new Map<string, number>();
  for (const e of eventos) {
    porCategoria.set(
      e.categoria,
      (porCategoria.get(e.categoria) ?? 0) + n(e.resumen.balanceEstimado),
    );
  }
  const datos = [...porCategoria.entries()].map(([categoria, balance]) => ({
    nombre: etiquetaCategoria(categoria),
    Balance: balance,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={datos} margin={{ top: 8, right: 8, bottom: 40, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e9f4" vertical={false} />
        <XAxis
          dataKey="nombre"
          tick={{ fontSize: 11, fill: "#14264c99" }}
          angle={-15}
          textAnchor="end"
          interval={0}
        />
        <YAxis tickFormatter={ejeY} tick={{ fontSize: 11, fill: "#14264c99" }} />
        <Tooltip content={<TooltipMoneda />} />
        <Bar dataKey="Balance">
          {datos.map((d) => (
            <Cell key={d.nombre} fill={d.Balance >= 0 ? VERDE : ROJO} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Cuánto del presupuesto estimado se ha ejercido realmente, evento por evento. */
export function GraficaEjercido({ eventos }: { eventos: Filas }) {
  const datos = eventos
    .filter((e) => n(e.resumen.egresoEstimado) > 0)
    .map((e) => {
      const est = n(e.resumen.egresoEstimado);
      const real = n(e.resumen.egresoReal);
      return {
        nombre: e.nombre.length > 16 ? e.nombre.slice(0, 15) + "…" : e.nombre,
        pct: Math.round((real / est) * 100),
        real,
        est,
      };
    })
    .sort((a, b) => b.pct - a.pct);

  if (datos.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-navy-900/40">
        Sin egresos estimados que graficar.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {datos.map((d) => (
        <div key={d.nombre} className="flex items-center gap-3 text-xs">
          <span className="w-32 shrink-0 truncate text-navy-900/70">{d.nombre}</span>
          <div className="h-4 flex-1 overflow-hidden rounded bg-navy-100">
            <div
              className={`h-full ${d.pct > 100 ? "bg-rose-500" : "bg-navy-600"}`}
              style={{ width: `${Math.min(d.pct, 100)}%` }}
            />
          </div>
          <span className="w-12 shrink-0 text-right tabular-nums text-navy-900/60">
            {d.pct}%
          </span>
          <span className="hidden w-44 shrink-0 text-right tabular-nums text-navy-900/40 sm:block">
            {formatMXN(d.real)} / {formatMXN(d.est)}
          </span>
        </div>
      ))}
    </div>
  );
}
