import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

export const sistemaRouter = createTRPCRouter({
  /**
   * Ping de conectividad: confirma que la app alcanza Postgres a través del
   * pooler de Supabase. Público a propósito — no revela ninguna cifra.
   */
  salud: publicProcedure.query(async ({ ctx }) => {
    const inicio = Date.now();
    await ctx.db.$queryRaw`select 1`;
    return { ok: true, latenciaMs: Date.now() - inicio };
  }),
});
