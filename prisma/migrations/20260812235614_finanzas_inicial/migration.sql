-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MIEMBRO', 'EXTERNO');

-- CreateEnum
CREATE TYPE "CategoriaEvento" AS ENUM ('PROYECTO_CON_RECAUDACION', 'PROYECTO_SIN_RECAUDACION', 'COMPETENCIA');

-- CreateEnum
CREATE TYPE "TipoMovimiento" AS ENUM ('INGRESO', 'EGRESO');

-- CreateTable
CREATE TABLE "Periodo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Periodo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evento" (
    "id" TEXT NOT NULL,
    "periodoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "categoria" "CategoriaEvento" NOT NULL,
    "inicio" DATE NOT NULL,
    "fin" DATE NOT NULL,
    "lugar" TEXT,
    "responsable" TEXT,
    "impactosDirectos" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Evento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Movimiento" (
    "id" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "tipo" "TipoMovimiento" NOT NULL,
    "codigo" TEXT NOT NULL,
    "fuente" TEXT,
    "concepto" TEXT NOT NULL,
    "fecha" DATE,

    CONSTRAINT "Movimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Desglose" (
    "id" TEXT NOT NULL,
    "movimientoId" TEXT NOT NULL,
    "subCodigo" TEXT NOT NULL,
    "concepto" TEXT NOT NULL,
    "estimado" DECIMAL(12,2),
    "real" DECIMAL(12,2),
    "cantidad" DECIMAL(12,3),
    "precioUnit" DECIMAL(12,2),
    "tipoCambio" DECIMAL(12,4),
    "nota" TEXT,

    CONSTRAINT "Desglose_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingItem" (
    "id" TEXT NOT NULL,
    "eventoId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "redSocial" TEXT NOT NULL,
    "concepto" TEXT NOT NULL,
    "vistasEstimado" INTEGER,
    "vistasReal" INTEGER,
    "interaccionEstimado" INTEGER,
    "interaccionReal" INTEGER,

    CONSTRAINT "MarketingItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "role" "Role" NOT NULL DEFAULT 'EXTERNO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Periodo_nombre_key" ON "Periodo"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Evento_periodoId_slug_key" ON "Evento"("periodoId", "slug");

-- CreateIndex
CREATE INDEX "Movimiento_eventoId_tipo_idx" ON "Movimiento"("eventoId", "tipo");

-- CreateIndex
CREATE UNIQUE INDEX "Movimiento_eventoId_codigo_key" ON "Movimiento"("eventoId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Desglose_movimientoId_subCodigo_key" ON "Desglose"("movimientoId", "subCodigo");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingItem_eventoId_codigo_key" ON "MarketingItem"("eventoId", "codigo");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- AddForeignKey
ALTER TABLE "Evento" ADD CONSTRAINT "Evento_periodoId_fkey" FOREIGN KEY ("periodoId") REFERENCES "Periodo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Desglose" ADD CONSTRAINT "Desglose_movimientoId_fkey" FOREIGN KEY ("movimientoId") REFERENCES "Movimiento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingItem" ADD CONSTRAINT "MarketingItem_eventoId_fkey" FOREIGN KEY ("eventoId") REFERENCES "Evento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Blindaje del schema `public` frente a la Data API de Supabase
-- ---------------------------------------------------------------------------
--
-- Esta app llega a Postgres ÚNICAMENTE por Prisma, y toda su autorización vive
-- en tRPC (memberProcedure / adminProcedure). Pero Supabase también expone el
-- schema `public` por PostgREST usando la llave anónima, que es pública por
-- diseño: sin lo de abajo, cualquiera con esa llave leería el presupuesto
-- completo rodeando por completo los permisos de la aplicación.
--
-- Habilitar RLS sin crear NINGUNA política deja a PostgREST negando todo.
-- Prisma no se ve afectado porque conecta como `postgres`, que es dueño de
-- estas tablas y por lo tanto salta RLS.
--
-- Deliberadamente NO se usa FORCE ROW LEVEL SECURITY: eso también le aplicaría
-- RLS al dueño y dejaría a la app sin poder leer nada.
--
-- OJO: las tablas que agreguen migraciones futuras NO heredan esto. Hay que
-- repetir el ALTER/REVOKE para cada tabla nueva.

ALTER TABLE "Periodo"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Evento"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Movimiento"    ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Desglose"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MarketingItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "session"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "account"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "verification"  ENABLE ROW LEVEL SECURITY;

-- Defensa en profundidad: quitar los privilegios que Supabase otorga por
-- omisión a los roles de la Data API, para que las tablas ni siquiera aparezcan
-- en la introspección de PostgREST.
REVOKE ALL ON "Periodo", "Evento", "Movimiento", "Desglose", "MarketingItem",
              "user", "session", "account", "verification"
  FROM anon, authenticated;
