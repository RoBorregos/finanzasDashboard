import { z } from "zod";

import { createTRPCRouter, memberProcedure } from "~/server/api/trpc";
import { resumenEvento, resumenPeriodo } from "~/server/finanzas/calc";
import { INCLUDE_EVENTO_COMPLETO } from "~/server/finanzas/queries";

export const dashboardRouter = createTRPCRouter({
  /** Periodos disponibles, para el selector del dashboard. */
  periodos: memberProcedure.query(({ ctx }) =>
    ctx.db.periodo.findMany({
      orderBy: { nombre: "desc" },
      select: { id: true, nombre: true, activo: true },
    }),
  ),

  /**
   * El equivalente de la hoja MAESTRA: una fila por evento más el gran total.
   *
   * En el workbook esto lo regeneraba la macro `Actualizar_Maestra` y quedaba
   * guardado en celdas, así que se desactualizaba en cuanto alguien editaba una
   * hoja sin volver a correrla. Aquí se calcula en cada consulta a partir del
   * desglose: nunca hay una copia que pueda quedar vieja.
   */
  resumenGlobal: memberProcedure
    .input(z.object({ periodoId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const periodo = input?.periodoId
        ? await ctx.db.periodo.findUnique({ where: { id: input.periodoId } })
        : ((await ctx.db.periodo.findFirst({ where: { activo: true } })) ??
          (await ctx.db.periodo.findFirst({ orderBy: { nombre: "desc" } })));

      if (!periodo) {
        return { periodo: null, eventos: [], total: null };
      }

      const eventos = await ctx.db.evento.findMany({
        where: { periodoId: periodo.id },
        include: INCLUDE_EVENTO_COMPLETO,
        orderBy: { inicio: "asc" },
      });

      const filas = eventos.map((e) => ({
        id: e.id,
        nombre: e.nombre,
        slug: e.slug,
        categoria: e.categoria,
        inicio: e.inicio,
        fin: e.fin,
        impactosDirectos: e.impactosDirectos,
        resumen: resumenEvento(e),
      }));

      return {
        periodo: { id: periodo.id, nombre: periodo.nombre },
        eventos: filas,
        total: resumenPeriodo(filas.map((f) => f.resumen)),
      };
    }),
});
