import type Decimal from "decimal.js";
import Link from "next/link";

import { formatMXN, formatVarianza } from "~/lib/format";

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-navy-100 bg-white shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

/** Varianza con color: verde si mejoró, rojo si empeoró, gris si no aplica. */
export function Varianza({
  valor,
  /** En egresos, gastar MENOS de lo estimado es bueno: se invierte el color. */
  invertir = false,
}: {
  valor: Decimal | null;
  invertir?: boolean;
}) {
  if (valor === null) {
    return <span className="text-navy-900/35">—</span>;
  }
  const n = Number(valor.toString());
  const bueno = invertir ? n <= 0 : n >= 0;
  return (
    <span
      className={`tabular-nums ${bueno ? "text-emerald-600" : "text-rose-600"}`}
    >
      {formatVarianza(valor)}
    </span>
  );
}

export function KpiCard({
  titulo,
  estimado,
  real,
  varianza,
  invertirVarianza = false,
  acento = false,
}: {
  titulo: string;
  estimado: Decimal;
  real: Decimal;
  varianza: Decimal | null;
  invertirVarianza?: boolean;
  acento?: boolean;
}) {
  const negativo = Number(real.toString()) < 0 || Number(estimado.toString()) < 0;
  return (
    <Card className="p-4">
      <p className="text-xs font-medium tracking-wide text-navy-900/50 uppercase">
        {titulo}
      </p>
      <p
        className={`mt-2 text-2xl font-semibold tabular-nums ${
          acento && negativo ? "text-rose-600" : "text-navy-900"
        }`}
      >
        {formatMXN(estimado)}
      </p>
      <p className="mt-0.5 text-xs text-navy-900/45">estimado</p>
      <div className="mt-3 flex items-baseline justify-between border-t border-navy-100 pt-2">
        <div>
          <span className="text-sm font-medium tabular-nums text-navy-700">
            {formatMXN(real)}
          </span>
          <span className="ml-1 text-xs text-navy-900/45">real</span>
        </div>
        <Varianza valor={varianza} invertir={invertirVarianza} />
      </div>
    </Card>
  );
}

export function BadgeEstatus({ estatus }: { estatus: "Completo" | "Pendiente" }) {
  return estatus === "Completo" ? (
    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-600/20 ring-inset">
      Completo
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-600/20 ring-inset">
      Pendiente
    </span>
  );
}

const ETIQUETA_CATEGORIA: Record<string, string> = {
  PROYECTO_CON_RECAUDACION: "Proyecto con recaudación",
  PROYECTO_SIN_RECAUDACION: "Proyecto sin recaudación",
  COMPETENCIA: "Competencia",
};

export const etiquetaCategoria = (c: string) => ETIQUETA_CATEGORIA[c] ?? c;

export function BadgeCategoria({ categoria }: { categoria: string }) {
  const color =
    categoria === "COMPETENCIA"
      ? "bg-oro-100 text-oro-600 ring-oro-500/25"
      : categoria === "PROYECTO_CON_RECAUDACION"
        ? "bg-navy-100 text-navy-700 ring-navy-600/20"
        : "bg-navy-50 text-navy-600 ring-navy-600/15";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${color}`}
    >
      {etiquetaCategoria(categoria)}
    </span>
  );
}

/**
 * Badge de completitud que dice POR QUÉ falla, no solo que falla.
 * Reemplaza el `Reporte Completo / Datos Faltantes` de E12, que solo daba el
 * veredicto y obligaba a ir a buscar el hueco a mano.
 */
export function BadgeCompletitud({
  completitud,
  detallado = false,
}: {
  completitud: {
    completo: boolean;
    todosDesglosesLlenos: boolean;
    todoIngresoTieneDesglose: boolean;
    todoEgresoTieneDesglose: boolean;
  };
  detallado?: boolean;
}) {
  if (completitud.completo) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-emerald-600/20 ring-inset">
        Reporte completo
      </span>
    );
  }

  const razones = [
    !completitud.todosDesglosesLlenos &&
      "hay renglones de desglose sin estimado o sin real",
    !completitud.todoIngresoTieneDesglose &&
      "hay ingresos sin ningún renglón de desglose",
    !completitud.todoEgresoTieneDesglose &&
      "hay egresos sin ningún renglón de desglose",
  ].filter((x): x is string => typeof x === "string");

  if (!detallado) {
    return (
      <span
        title={razones.join("; ")}
        className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-amber-600/20 ring-inset"
      >
        Datos faltantes
      </span>
    );
  }

  return (
    <div className="rounded-lg border border-amber-300/60 bg-amber-50 p-3">
      <p className="text-sm font-medium text-amber-800">Datos faltantes</p>
      <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-sm text-amber-800/90">
        {razones.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </div>
  );
}

export function Boton({
  children,
  href,
  onClick,
  variante = "primario",
  type = "button",
  disabled,
  className = "",
}: {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  variante?: "primario" | "secundario" | "peligro";
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
}) {
  const estilos = {
    primario: "bg-navy-700 text-white hover:bg-navy-800",
    secundario:
      "bg-white text-navy-700 ring-1 ring-navy-200 ring-inset hover:bg-navy-50",
    peligro: "bg-white text-rose-600 ring-1 ring-rose-200 ring-inset hover:bg-rose-50",
  }[variante];

  const clases = `inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${estilos} ${className}`;

  if (href) {
    return (
      <Link href={href} className={clases}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={clases}>
      {children}
    </button>
  );
}
