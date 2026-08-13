import { dashboardRouter } from "~/server/api/routers/dashboard";
import { desgloseRouter } from "~/server/api/routers/desglose";
import { eventoRouter } from "~/server/api/routers/evento";
import { exportRouter } from "~/server/api/routers/export";
import { marketingRouter } from "~/server/api/routers/marketing";
import { movimientoRouter } from "~/server/api/routers/movimiento";
import { sistemaRouter } from "~/server/api/routers/sistema";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";

/**
 * Router principal. Cada router de /api/routers se registra aquí a mano.
 */
export const appRouter = createTRPCRouter({
  dashboard: dashboardRouter,
  desglose: desgloseRouter,
  evento: eventoRouter,
  export: exportRouter,
  marketing: marketingRouter,
  movimiento: movimientoRouter,
  sistema: sistemaRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.evento.list();
 */
export const createCaller = createCallerFactory(appRouter);
