import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { slugify } from "~/lib/format";
import {
  adminProcedure,
  createTRPCRouter,
  memberProcedure,
} from "~/server/api/trpc";
import type { db as dbCliente } from "~/server/db";
import { resumenEvento } from "~/server/finanzas/calc";

type DbCliente = typeof dbCliente;
import {
  categoriaInput,
  fechaInput,
  INCLUDE_EVENTO_COMPLETO,
} from "~/server/finanzas/queries";

const camposEvento = {
  nombre: z.string().min(1, "El nombre es obligatorio"),
  categoria: categoriaInput,
  inicio: fechaInput,
  fin: fechaInput,
  lugar: z.string().nullish(),
  responsable: z.string().nullish(),
  impactosDirectos: z.coerce.number().int().min(0).default(0),
};

/** Genera un slug único dentro del periodo, agregando sufijo si ya existe. */
async function slugUnico(
  db: DbCliente,
  periodoId: string,
  nombre: string,
  ignorarId?: string,
): Promise<string> {
  const base = slugify(nombre) || "evento";
  let candidato = base;
  let n = 1;
  while (
    await db.evento.findFirst({
      where: {
        periodoId,
        slug: candidato,
        ...(ignorarId ? { NOT: { id: ignorarId } } : {}),
      },
      select: { id: true },
    })
  ) {
    n++;
    candidato = `${base}-${n}`;
  }
  return candidato;
}

export const eventoRouter = createTRPCRouter({
  /** Lista con totales calculados. Es la fuente de la tabla del dashboard global. */
  list: memberProcedure
    .input(
      z
        .object({
          periodoId: z.string().optional(),
          categoria: categoriaInput.optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const eventos = await ctx.db.evento.findMany({
        where: {
          ...(input?.periodoId ? { periodoId: input.periodoId } : {}),
          ...(input?.categoria ? { categoria: input.categoria } : {}),
        },
        include: INCLUDE_EVENTO_COMPLETO,
        orderBy: { inicio: "asc" },
      });

      return eventos.map((e) => ({
        id: e.id,
        nombre: e.nombre,
        slug: e.slug,
        categoria: e.categoria,
        inicio: e.inicio,
        fin: e.fin,
        lugar: e.lugar,
        responsable: e.responsable,
        impactosDirectos: e.impactosDirectos,
        resumen: resumenEvento(e),
      }));
    }),

  /** Un evento con todo su detalle, para `/eventos/[id]`. */
  byId: memberProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const evento = await ctx.db.evento.findUnique({
        where: { id: input.id },
        include: { ...INCLUDE_EVENTO_COMPLETO, periodo: true },
      });
      if (!evento) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Evento no encontrado" });
      }
      return { ...evento, resumen: resumenEvento(evento) };
    }),

  create: adminProcedure
    .input(z.object({ periodoId: z.string().optional(), ...camposEvento }))
    .mutation(async ({ ctx, input }) => {
      if (!input.inicio || !input.fin) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Las fechas de inicio y fin son obligatorias",
        });
      }
      if (input.fin < input.inicio) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "La fecha de fin no puede ser anterior a la de inicio",
        });
      }

      // Sin periodo explícito se usa el activo; si no hay ninguno, se crea.
      const periodoId =
        input.periodoId ??
        (
          await ctx.db.periodo.findFirst({ where: { activo: true } })
        )?.id ??
        (
          await ctx.db.periodo.create({
            data: { nombre: `${new Date().getUTCFullYear()}`, activo: true },
          })
        ).id;

      return ctx.db.evento.create({
        data: {
          periodoId,
          nombre: input.nombre,
          slug: await slugUnico(ctx.db, periodoId, input.nombre),
          categoria: input.categoria,
          inicio: input.inicio,
          fin: input.fin,
          lugar: input.lugar ?? null,
          responsable: input.responsable ?? null,
          impactosDirectos: input.impactosDirectos,
        },
      });
    }),

  /** Edición del bloque de encabezado. Todos los campos son opcionales (edición inline). */
  update: adminProcedure
    .input(
      z.object({
        id: z.string(),
        nombre: camposEvento.nombre.optional(),
        categoria: categoriaInput.optional(),
        inicio: fechaInput,
        fin: fechaInput,
        lugar: z.string().nullish(),
        responsable: z.string().nullish(),
        impactosDirectos: z.coerce.number().int().min(0).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const actual = await ctx.db.evento.findUnique({
        where: { id: input.id },
        select: { id: true, periodoId: true, inicio: true, fin: true },
      });
      if (!actual) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Evento no encontrado" });
      }

      const inicio = input.inicio ?? actual.inicio;
      const fin = input.fin ?? actual.fin;
      if (fin < inicio) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "La fecha de fin no puede ser anterior a la de inicio",
        });
      }

      return ctx.db.evento.update({
        where: { id: input.id },
        data: {
          ...(input.nombre !== undefined
            ? {
                nombre: input.nombre,
                slug: await slugUnico(
                  ctx.db,
                  actual.periodoId,
                  input.nombre,
                  actual.id,
                ),
              }
            : {}),
          ...(input.categoria !== undefined ? { categoria: input.categoria } : {}),
          ...(input.inicio !== null && input.inicio !== undefined
            ? { inicio: input.inicio }
            : {}),
          ...(input.fin !== null && input.fin !== undefined ? { fin: input.fin } : {}),
          ...(input.lugar !== undefined ? { lugar: input.lugar } : {}),
          ...(input.responsable !== undefined
            ? { responsable: input.responsable }
            : {}),
          ...(input.impactosDirectos !== undefined
            ? { impactosDirectos: input.impactosDirectos }
            : {}),
        },
      });
    }),

  /** Borra el evento y, en cascada, sus movimientos, desglose y marketing. */
  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) =>
      ctx.db.evento.delete({ where: { id: input.id } }),
    ),
});
