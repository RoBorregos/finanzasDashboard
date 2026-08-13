import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  adminProcedure,
  createTRPCRouter,
  memberProcedure,
} from "~/server/api/trpc";
import { siguienteCodigo } from "~/server/finanzas/calc";
import { fechaInput, tipoInput } from "~/server/finanzas/queries";

export const movimientoRouter = createTRPCRouter({
  /**
   * Sugiere el siguiente código para el botón "Agregar ingreso/egreso".
   * Se basa en el máximo existente y no en el conteo, para que borrar un
   * renglón no reasigne un código que ya se usó en un reporte impreso.
   */
  nextCodigo: memberProcedure
    .input(z.object({ eventoId: z.string(), tipo: tipoInput }))
    .query(async ({ ctx, input }) => {
      const existentes = await ctx.db.movimiento.findMany({
        where: { eventoId: input.eventoId, tipo: input.tipo },
        select: { codigo: true },
      });
      return siguienteCodigo(
        input.tipo,
        existentes.map((m) => m.codigo),
      );
    }),

  create: adminProcedure
    .input(
      z.object({
        eventoId: z.string(),
        tipo: tipoInput,
        codigo: z.string().min(1).optional(),
        fuente: z.string().nullish(),
        concepto: z.string().default(""),
        fecha: fechaInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const codigo =
        input.codigo ??
        siguienteCodigo(
          input.tipo,
          (
            await ctx.db.movimiento.findMany({
              where: { eventoId: input.eventoId, tipo: input.tipo },
              select: { codigo: true },
            })
          ).map((m) => m.codigo),
        );

      try {
        return await ctx.db.movimiento.create({
          data: {
            eventoId: input.eventoId,
            tipo: input.tipo,
            codigo,
            fuente: input.fuente ?? null,
            concepto: input.concepto,
            fecha: input.fecha,
          },
        });
      } catch {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Ya existe un movimiento con el código ${codigo} en este evento.`,
        });
      }
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string(),
        codigo: z.string().min(1).optional(),
        fuente: z.string().nullish(),
        concepto: z.string().optional(),
        fecha: fechaInput,
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.movimiento.update({
        where: { id: input.id },
        data: {
          ...(input.codigo !== undefined ? { codigo: input.codigo } : {}),
          ...(input.fuente !== undefined ? { fuente: input.fuente } : {}),
          ...(input.concepto !== undefined ? { concepto: input.concepto } : {}),
          ...(input.fecha !== undefined ? { fecha: input.fecha } : {}),
        },
      }),
    ),

  /** Borra el movimiento y su desglose en cascada. */
  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) =>
      ctx.db.movimiento.delete({ where: { id: input.id } }),
    ),
});
