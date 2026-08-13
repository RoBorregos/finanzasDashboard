/**
 * Asigna un rol a un usuario, desde la terminal.
 *
 *   npm run rol -- correo@ejemplo.com ADMIN
 *   npm run rol -- correo@ejemplo.com MIEMBRO
 *   npm run rol                                # lista los usuarios y su rol
 *
 * Existe porque todo registro nuevo nace como EXTERNO —negar por omisión— y
 * alguien tiene que poder promover al primer administrador. NO es la UI de
 * gestión de roles que el prompt deja fuera de alcance (§7): es la herramienta
 * mínima de arranque.
 *
 * TODO(auth): reemplazar por invitaciones + pantalla de administración cuando
 * el flujo de autenticación esté definido.
 */
import { PrismaClient, type Role } from "../generated/prisma";

const db = new PrismaClient();

const ROLES: Role[] = ["ADMIN", "MIEMBRO", "EXTERNO"];

async function main() {
  const [correo, rol] = process.argv.slice(2);

  if (!correo) {
    const usuarios = await db.user.findMany({
      select: { email: true, name: true, role: true },
      orderBy: { createdAt: "asc" },
    });
    if (usuarios.length === 0) {
      console.log(
        "No hay usuarios todavía. Regístrate en la app y vuelve a correr esto.",
      );
      return;
    }
    console.log("Usuarios registrados:\n");
    for (const u of usuarios) {
      console.log(`  ${u.role.padEnd(8)} ${u.email}  (${u.name})`);
    }
    console.log("\nPara cambiar un rol:  npm run rol -- <correo> <ADMIN|MIEMBRO|EXTERNO>");
    return;
  }

  if (!rol || !ROLES.includes(rol as Role)) {
    console.error(`Rol inválido. Usa uno de: ${ROLES.join(", ")}`);
    process.exit(1);
  }

  const usuario = await db.user.findUnique({ where: { email: correo } });
  if (!usuario) {
    console.error(`No existe ningún usuario con el correo "${correo}".`);
    console.error("Regístrate primero en la app; el usuario se crea al iniciar sesión.");
    process.exit(1);
  }

  const actualizado = await db.user.update({
    where: { email: correo },
    data: { role: rol as Role },
  });
  console.log(`✔ ${actualizado.email}: ${usuario.role} → ${actualizado.role}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => void db.$disconnect());
