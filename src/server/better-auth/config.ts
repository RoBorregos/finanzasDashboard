import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

import { env } from "~/env";
import { db } from "~/server/db";

/**
 * URL pública de la app, base de todos los callbacks de OAuth.
 *
 * Se resuelve sola para no tener que volver a tocar variables después del
 * primer deploy:
 *   1. `BETTER_AUTH_URL` si la pusiste (útil para un dominio propio).
 *   2. El dominio estable del proyecto en Vercel — el que NO cambia entre
 *      deploys, que es el que hay que registrar en las OAuth apps.
 *   3. La URL de este deploy en particular (previews).
 *   4. localhost, en desarrollo.
 */
function resolverBaseURL(): string {
  if (env.BETTER_AUTH_URL) return env.BETTER_AUTH_URL;
  if (env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/**
 * Proveedores sociales. Cada uno se registra solo si su par de credenciales
 * está completo, así el proyecto arranca sin ninguna OAuth app dada de alta.
 *
 * No se fija `redirectURI`: Better Auth lo deriva de `baseURL`, de modo que
 * apunta al dominio correcto en local y en producción sin configurar nada.
 */
function proveedoresSociales() {
  return {
    ...(env.BETTER_AUTH_GITHUB_CLIENT_ID && env.BETTER_AUTH_GITHUB_CLIENT_SECRET
      ? {
          github: {
            clientId: env.BETTER_AUTH_GITHUB_CLIENT_ID,
            clientSecret: env.BETTER_AUTH_GITHUB_CLIENT_SECRET,
          },
        }
      : {}),
    ...(env.BETTER_AUTH_GOOGLE_CLIENT_ID && env.BETTER_AUTH_GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.BETTER_AUTH_GOOGLE_CLIENT_ID,
            clientSecret: env.BETTER_AUTH_GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
  };
}

export const auth = betterAuth({
  baseURL: resolverBaseURL(),
  database: prismaAdapter(db, {
    provider: "postgresql", // or "sqlite" or "mysql"
  }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: proveedoresSociales(),
  user: {
    additionalFields: {
      // Sin esto, `role` existe en la tabla pero nunca llega a `session.user`.
      // `input: false` es la parte importante: impide que alguien se mande
      // `role: "ADMIN"` en el cuerpo del signup y se auto-promueva.
      // TODO(auth): gestión de roles (invitaciones, promover a MIEMBRO/ADMIN).
      role: {
        type: "string",
        defaultValue: "EXTERNO",
        input: false,
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
