import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, memberProcedure } from "~/server/api/trpc";
import { resumenEvento, totalesMovimiento } from "~/server/finanzas/calc";
import { INCLUDE_EVENTO_COMPLETO } from "~/server/finanzas/queries";

/** Un campo de CSV solo puede ser texto, número o vacío. */
type CampoCsv = string | number | null | undefined;

/** Escapa un campo para CSV (comillas dobles y separadores). */
function csvCampo(valor: CampoCsv): string {
  if (valor === null || valor === undefined) return "";
  const s = typeof valor === "number" ? String(valor) : valor;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const csvFila = (campos: CampoCsv[]) => campos.map(csvCampo).join(",");

export const exportRouter = createTRPCRouter({
  /**
   * CSV plano de un evento: movimientos y su desglose en las mismas filas que
   * ve el usuario, más marketing. Los totales derivados se incluyen ya
   * calculados para que abrir el archivo en Excel no requiera fórmulas.
   */
  csv: memberProcedure
    .input(z.object({ eventoId: z.string() }))
    .query(async ({ ctx, input }) => {
      const evento = await ctx.db.evento.findUnique({
        where: { id: input.eventoId },
        include: INCLUDE_EVENTO_COMPLETO,
      });
      if (!evento) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Evento no encontrado" });
      }

      const lineas: string[] = [];
      lineas.push(
        csvFila([
          "Tipo",
          "Codigo",
          "SubCodigo",
          "Fuente o Patrocinador",
          "Concepto",
          "Estimado",
          "Real",
          "Cantidad",
          "Precio unitario",
          "Tipo de cambio",
          "Fecha",
          "Estatus",
        ]),
      );

      for (const m of evento.movimientos) {
        const t = totalesMovimiento(m.desglose);
        lineas.push(
          csvFila([
            m.tipo,
            m.codigo,
            "",
            m.fuente,
            m.concepto,
            t.estimado.toFixed(2),
            t.real.toFixed(2),
            "",
            "",
            "",
            m.fecha ? m.fecha.toISOString().slice(0, 10) : "",
            t.estatus,
          ]),
        );
        for (const d of m.desglose) {
          lineas.push(
            csvFila([
              m.tipo,
              m.codigo,
              d.subCodigo,
              "",
              d.concepto,
              d.estimado?.toFixed(2) ?? "",
              d.real?.toFixed(2) ?? "",
              d.cantidad?.toString() ?? "",
              d.precioUnit?.toFixed(2) ?? "",
              d.tipoCambio?.toString() ?? "",
              "",
              "",
            ]),
          );
        }
      }

      lineas.push("");
      lineas.push(
        csvFila([
          "MARKETING",
          "Codigo",
          "Red social",
          "Concepto",
          "Vistas estimado",
          "Vistas real",
          "Interaccion estimado",
          "Interaccion real",
        ]),
      );
      for (const mk of evento.marketing) {
        lineas.push(
          csvFila([
            "",
            mk.codigo,
            mk.redSocial,
            mk.concepto,
            mk.vistasEstimado ?? "",
            mk.vistasReal ?? "",
            mk.interaccionEstimado ?? "",
            mk.interaccionReal ?? "",
          ]),
        );
      }

      return {
        nombreArchivo: `${evento.slug}-${new Date().toISOString().slice(0, 10)}.csv`,
        // BOM para que Excel en Windows respete los acentos.
        contenido: "﻿" + lineas.join("\n"),
      };
    }),

  /**
   * Datos del estado de cuenta (lo que la macro `Estado_De_Cuenta_PDF` armaba
   * como hoja aparte). La presentación vive en la página; aquí solo se resuelve
   * el contenido, ya calculado.
   */
  estadoDeCuenta: memberProcedure
    .input(z.object({ eventoId: z.string() }))
    .query(async ({ ctx, input }) => {
      const evento = await ctx.db.evento.findUnique({
        where: { id: input.eventoId },
        include: { ...INCLUDE_EVENTO_COMPLETO, periodo: true },
      });
      if (!evento) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Evento no encontrado" });
      }

      const conTotales = (tipo: "INGRESO" | "EGRESO") =>
        evento.movimientos
          .filter((m) => m.tipo === tipo)
          .map((m) => ({
            id: m.id,
            codigo: m.codigo,
            fuente: m.fuente,
            concepto: m.concepto,
            fecha: m.fecha,
            desglose: m.desglose,
            ...totalesMovimiento(m.desglose),
          }));

      return {
        evento: {
          id: evento.id,
          nombre: evento.nombre,
          categoria: evento.categoria,
          inicio: evento.inicio,
          fin: evento.fin,
          lugar: evento.lugar,
          responsable: evento.responsable,
          impactosDirectos: evento.impactosDirectos,
          periodo: evento.periodo.nombre,
        },
        ingresos: conTotales("INGRESO"),
        egresos: conTotales("EGRESO"),
        marketing: evento.marketing,
        resumen: resumenEvento(evento),
        emitido: new Date(),
      };
    }),
});
