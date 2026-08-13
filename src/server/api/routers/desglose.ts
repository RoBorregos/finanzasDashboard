import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  adminProcedure,
  createTRPCRouter,
  memberProcedure,
} from "~/server/api/trpc";
import { resolverMonto, siguienteSubCodigo } from "~/server/finanzas/calc";
import { factorInput, montoInput } from "~/server/finanzas/queries";

/**
 * Si vienen cantidad y precio unitario, el monto se recalcula a partir de ellos
 * (opcionalmente por tipo de cambio) y gana sobre lo capturado a mano: así el
 * número guardado siempre concuerda con la cuenta que lo justifica.
 * Si no hay insumos suficientes, se respeta el monto capturado.
 */
function montoEfectivo(
  capturado: string | null,
  insumos: {
    cantidad?: string | null;
    precioUnit?: string | null;
    tipoCambio?: string | null;
  },
): string | null {
  const calculado = resolverMonto(insumos);
  return calculado ? calculado.toFixed(2) : capturado;
}

export const desgloseRouter = createTRPCRouter({
  /** Sugiere `ING-01-004` para el botón "Agregar desglose". */
  nextSubCodigo: memberProcedure
    .input(z.object({ movimientoId: z.string() }))
    .query(async ({ ctx, input }) => {
      const movimiento = await ctx.db.movimiento.findUnique({
        where: { id: input.movimientoId },
        select: { codigo: true, desglose: { select: { subCodigo: true } } },
      });
      if (!movimiento) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Movimiento no encontrado",
        });
      }
      return siguienteSubCodigo(
        movimiento.codigo,
        movimiento.desglose.map((d) => d.subCodigo),
      );
    }),

  create: adminProcedure
    .input(
      z.object({
        movimientoId: z.string(),
        subCodigo: z.string().min(1).optional(),
        concepto: z.string().default(""),
        estimado: montoInput,
        real: montoInput,
        cantidad: factorInput(3),
        precioUnit: montoInput,
        tipoCambio: factorInput(4),
        nota: z.string().nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const movimiento = await ctx.db.movimiento.findUnique({
        where: { id: input.movimientoId },
        select: { codigo: true, desglose: { select: { subCodigo: true } } },
      });
      if (!movimiento) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Movimiento no encontrado",
        });
      }

      const subCodigo =
        input.subCodigo ??
        siguienteSubCodigo(
          movimiento.codigo,
          movimiento.desglose.map((d) => d.subCodigo),
        );

      const insumos = {
        cantidad: input.cantidad,
        precioUnit: input.precioUnit,
        tipoCambio: input.tipoCambio,
      };

      try {
        return await ctx.db.desglose.create({
          data: {
            movimientoId: input.movimientoId,
            subCodigo,
            concepto: input.concepto,
            estimado: montoEfectivo(input.estimado, insumos),
            real: input.real,
            cantidad: input.cantidad,
            precioUnit: input.precioUnit,
            tipoCambio: input.tipoCambio,
            nota: input.nota ?? null,
          },
        });
      } catch {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Ya existe un desglose con el subcódigo ${subCodigo}.`,
        });
      }
    }),

  /**
   * Actualización parcial: la edición inline manda una sola celda a la vez.
   * `undefined` significa "no tocar"; `null` significa "vaciar".
   */
  update: adminProcedure
    .input(
      z.object({
        id: z.string(),
        subCodigo: z.string().min(1).optional(),
        concepto: z.string().optional(),
        estimado: montoInput,
        real: montoInput,
        cantidad: factorInput(3),
        precioUnit: montoInput,
        tipoCambio: factorInput(4),
        nota: z.string().nullish(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const actual = await ctx.db.desglose.findUnique({
        where: { id: input.id },
        select: { cantidad: true, precioUnit: true, tipoCambio: true },
      });
      if (!actual) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Desglose no encontrado" });
      }

      // Los insumos que no vengan en esta edición se toman de lo ya guardado,
      // para que cambiar solo el tipo de cambio recalcule el monto.
      const insumos = {
        cantidad:
          input.cantidad !== undefined
            ? input.cantidad
            : (actual.cantidad?.toString() ?? null),
        precioUnit:
          input.precioUnit !== undefined
            ? input.precioUnit
            : (actual.precioUnit?.toString() ?? null),
        tipoCambio:
          input.tipoCambio !== undefined
            ? input.tipoCambio
            : (actual.tipoCambio?.toString() ?? null),
      };

      const tocaInsumos =
        input.cantidad !== undefined ||
        input.precioUnit !== undefined ||
        input.tipoCambio !== undefined;

      return ctx.db.desglose.update({
        where: { id: input.id },
        data: {
          ...(input.subCodigo !== undefined ? { subCodigo: input.subCodigo } : {}),
          ...(input.concepto !== undefined ? { concepto: input.concepto } : {}),
          ...(input.estimado !== undefined || tocaInsumos
            ? { estimado: montoEfectivo(input.estimado ?? null, insumos) }
            : {}),
          ...(input.real !== undefined ? { real: input.real } : {}),
          ...(input.cantidad !== undefined ? { cantidad: input.cantidad } : {}),
          ...(input.precioUnit !== undefined
            ? { precioUnit: input.precioUnit }
            : {}),
          ...(input.tipoCambio !== undefined
            ? { tipoCambio: input.tipoCambio }
            : {}),
          ...(input.nota !== undefined ? { nota: input.nota } : {}),
        },
      });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ ctx, input }) =>
      ctx.db.desglose.delete({ where: { id: input.id } }),
    ),
});
