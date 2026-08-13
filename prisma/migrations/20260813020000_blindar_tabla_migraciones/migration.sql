-- La tabla de control de Prisma se crea fuera del schema.prisma, así que la
-- migración inicial no la alcanzó y conservaba los permisos que Supabase otorga
-- por omisión a los roles de la Data API (incluidos DELETE y TRUNCATE).
--
-- No había fuga de datos —solo guarda nombres y checksums de migraciones, y RLS
-- ya estaba activo— pero un rol público no tiene por qué poder borrar el
-- historial de migraciones.

ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "_prisma_migrations" FROM anon, authenticated;
