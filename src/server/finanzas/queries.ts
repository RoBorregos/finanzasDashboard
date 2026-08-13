import { z } from "zod";

import { parseDinero } from "~/server/finanzas/calc";

/**
 * La forma con la que se trae un evento cuando hace falta calcular cualquier
 * cosa. `calc.ts` espera exactamente esto: movimientos con su desglose, más
 * marketing. Se comparte para que dashboards, estado de cuenta y export usen
 * la misma consulta y no se desincronicen.
 */
export const INCLUDE_EVENTO_COMPLETO = {
  movimientos: {
    include: { desglose: { orderBy: { subCodigo: "asc" } } },
    orderBy: { codigo: "asc" },
  },
  marketing: { orderBy: { codigo: "asc" } },
} as const;

/**
 * Entrada de dinero desde la UI: acepta string o number y tolera `$`, comas y
 * espacios. Devuelve string con 2 decimales, que es lo que Prisma espera para
 * una columna `Decimal`, o null para "sin capturar".
 *
 * Se valida aquí y no en el componente: el servidor nunca confía en que el
 * cliente ya haya limpiado el valor.
 */
export const montoInput = z
  .union([z.string(), z.number()])
  .nullish()
  .transform((v, ctx) => {
    if (v === null || v === undefined) return null;
    try {
      const d = parseDinero(String(v));
      return d === null ? null : d.toFixed(2);
    } catch (e) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: e instanceof Error ? e.message : "Monto inválido",
      });
      return z.NEVER;
    }
  });

/** Igual que `montoInput` pero con más decimales, para cantidad y tipo de cambio. */
export const factorInput = (decimales: number) =>
  z
    .union([z.string(), z.number()])
    .nullish()
    .transform((v, ctx) => {
      if (v === null || v === undefined) return null;
      try {
        const d = parseDinero(String(v));
        return d === null ? null : d.toFixed(decimales);
      } catch (e) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: e instanceof Error ? e.message : "Valor inválido",
        });
        return z.NEVER;
      }
    });

/** Entero opcional para vistas e interacciones. */
export const enteroInput = z.coerce.number().int().min(0).nullish();

/** `2026-07-27` desde un `<input type="date">`, construido en UTC. */
export const fechaInput = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Se esperaba una fecha YYYY-MM-DD")
  .nullish()
  .transform((s) => {
    if (!s) return null;
    // El regex de arriba ya garantiza los tres grupos numéricos.
    const [y, m, d] = s.split("-").map(Number) as [number, number, number];
    return new Date(Date.UTC(y, m - 1, d));
  });

export const categoriaInput = z.enum([
  "PROYECTO_CON_RECAUDACION",
  "PROYECTO_SIN_RECAUDACION",
  "COMPETENCIA",
]);

export const tipoInput = z.enum(["INGRESO", "EGRESO"]);
