/**
 * Formateo para la UI. Un solo lugar, para que ninguna tabla invente el suyo.
 */
import type Decimal from "decimal.js";

const MXN = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Dinero en pesos: `$1,234.56`. Los nulos se muestran como guion largo. */
export function formatMXN(valor: Decimal | number | string | null | undefined): string {
  if (valor === null || valor === undefined) return "—";
  const n = typeof valor === "number" ? valor : Number(valor.toString());
  if (!Number.isFinite(n)) return "—";
  return MXN.format(n);
}

/** Enteros con separador de miles: alcance, interacciones, impactos. */
export function formatEntero(valor: number | null | undefined): string {
  if (valor === null || valor === undefined) return "—";
  return new Intl.NumberFormat("es-MX").format(valor);
}

/**
 * Varianza como porcentaje con signo: `+28.6%`, `-15.0%`.
 * `null` (división entre cero) se muestra como `—`, nunca `#DIV/0!` ni `Infinity`.
 */
export function formatVarianza(valor: Decimal | null | undefined): string {
  if (valor === null || valor === undefined) return "—";
  const n = Number(valor.toString());
  if (!Number.isFinite(n)) return "—";
  const pct = n * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

/**
 * Fecha de calendario: `27 jul 2026`.
 *
 * SE FORMATEA EN UTC A PROPÓSITO. Las columnas `inicio`/`fin`/`fecha` son `date`
 * en Postgres, y Prisma las entrega como Date en medianoche UTC
 * (`2026-07-27T00:00:00.000Z`). Formatearlas en la zona local de México (UTC-6)
 * las correría un día hacia atrás: 2026-07-27 se vería como "26 jul 2026".
 * Son fechas de calendario, no instantes; no llevan zona horaria.
 */
export function formatFecha(fecha: Date | string | null | undefined): string {
  if (fecha === null || fecha === undefined) return "—";
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

/** `2026-07-27`, para inputs `<input type="date">`. Igualmente en UTC. */
export function formatFechaISO(fecha: Date | null | undefined): string {
  if (fecha === null || fecha === undefined) return "";
  if (Number.isNaN(fecha.getTime())) return "";
  return fecha.toISOString().slice(0, 10);
}

/**
 * Convierte `2026-07-27` de un input a Date sin que la zona local lo mueva.
 * `new Date("2026-07-27")` ya interpreta UTC, pero se hace explícito para que
 * nadie lo "arregle" a `new Date(2026, 6, 27)`, que sí usaría hora local.
 */
export function parseFechaISO(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const [, y, mes, d] = m;
  return new Date(Date.UTC(Number(y), Number(mes) - 1, Number(d)));
}

/** Slug para la URL del evento: "Taller CNC cortadora laser" -> "taller-cnc-cortadora-laser". */
export function slugify(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
