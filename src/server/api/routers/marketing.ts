import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { adminProcedure, createTRPCRouter } from "~/server/api/trpc";
import { enteroInput } from "~/server/finanzas/queries";

/** Siguiente `MKT-0N` a partir del máximo existente. */
function siguienteCodigoMkt(existentes: string[]): string {
  const max = existentes.reduce((acc, c) => {
    const m = /^MKT-(\d+)$/.exec(c.trim());
    const n = m?.[1] ? Number.parseInt(m[1], 10) : 0;
    return n > acc ? n : acc;
  }, 0);
  return `MKT-${String(max + 1).padStart(2, "0")}`;
}

export const marketingRouter = createTRPCRouter({
  create: adminProcedure
    .input(
      z.object({
        eventoId: z.string(),
        codigo: z.string().min(1).optional(),
        redSocial: z.string().default("Instagram"),
        concepto: z.string().default(""),
        vistasEstimado: enteroInput,
        vistasReal: enteroInput,
        interaccionEstimado: enteroInput,
        interaccionReal: enteroInput,
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const codigo =
        input.codigo ??
        siguienteCodigoMkt(
          (
            await ctx.db.marketingItem.findMany({
              where: { eventoId: input.eventoId },
              select: { codigo: true },
            })
          ).map((m) => m.codigo),
        );

      try {
        return await ctx.db.marketingItem.create({
          data: {
            eventoId: input.eventoId,
            codigo,
            redSocial: input.redSocial,
            concepto: input.concepto,
            vistasEstimado: input.vistasEstimado ?? null,
            vistasReal: input.vistasReal ?? null,
            interaccionEstimado: input.interaccionEstimado ?? null,
            interaccionReal: input.interaccionReal ?? null,
          },
        });
      } catch {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Ya existe una fila de marketing con el código ${codigo}.`,
        });
      }
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string(),
        codigo: z.string().min(1).optional(),
        redSocial: z.string().optional(),
        concepto: z.string().optional(),
        vistasEstimado: enteroInput,
        vistasReal: enteroInput,
        interaccionEstimado: enteroInput,
        interaccionReal: enteroInput,
      }),
    )
    .mutation(({ ctx, input }) =>
      ctx.db.marketingItem.update({
        where: { id: input.id },
        data: {
          ...(input.codigo !== undefined ? { codigo: input.codigo } : {}),
          ...(input.redSocial !== undefined ? { redSocial: input.redSocial } : {}),
          ...(input.concepto !== undefined ? { concepto: input.concepto } : {}),
          ...(input.vistasEstimado !== undefined
            ? { vistasEstimado: input.vistasEstimado }
            : {}),
          ...(input.vistasReal !== undefined ? { vistasReal: input.vistasReal } : {}),
          ...(input.interaccionEstimado !== undefined
            ? { interaccionEstimado: input.interaccionEstimado }
            : {}),
          ...(input.interaccionReal !== undefined
            ? { interaccionReal: input.interaccionReal }
            : {}),
        },
      }),
    ),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) =>
      ctx.db.marketingItem.delete({ where: { id: input.id } }),
    ),
});
