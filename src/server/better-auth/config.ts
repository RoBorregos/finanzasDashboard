import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";

import { env } from "~/env";
import { db } from "~/server/db";

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL ?? "http://localhost:3000",
  database: prismaAdapter(db, {
    provider: "postgresql", // or "sqlite" or "mysql"
  }),
  emailAndPassword: {
    enabled: true,
  },
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
  // El proveedor de GitHub solo se registra si hay credenciales; si no, queda
  // únicamente email/password y la app arranca igual.
  socialProviders:
    env.BETTER_AUTH_GITHUB_CLIENT_ID && env.BETTER_AUTH_GITHUB_CLIENT_SECRET
      ? {
          github: {
            clientId: env.BETTER_AUTH_GITHUB_CLIENT_ID,
            clientSecret: env.BETTER_AUTH_GITHUB_CLIENT_SECRET,
            // Sin `redirectURI` fijo: Better Auth lo deriva de `baseURL`, así
            // que en producción apunta al dominio real. Estaba clavado a
            // localhost, lo que rompía el login con GitHub al desplegar.
          },
        }
      : {},
});

export type Session = typeof auth.$Infer.Session;
