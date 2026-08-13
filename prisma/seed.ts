/**
 * Importa `seed-presupuesto.json` (export del workbook) a la base.
 *
 * Correr con: `npm run db:seed`
 *
 * Es idempotente: vuelve a crear el periodo desde cero en cada corrida, así que
 * se puede ejecutar las veces que haga falta sin duplicar nada.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import { PrismaClient, type CategoriaEvento } from "../generated/prisma";

const db = new PrismaClient();

// ---------------------------------------------------------------------------
// Validación del export
// ---------------------------------------------------------------------------

/** `2026-07-27` o null. Se construye en UTC para que la zona local no lo corra un día. */
const fechaISO = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "se esperaba YYYY-MM-DD")
  .nullable()
  .optional()
  .transform((s) => {
    if (!s) return null;
    const [y, m, d] = s.split("-").map(Number);
    return new Date(Date.UTC(y!, m! - 1, d!));
  });

const dinero = z.number().nullable().optional().default(null);
const entero = z.number().int().nullable().optional().default(null);

const movimientoSchema = z.object({
  codigo: z.string().min(1),
  fuente: z.string().nullable().optional().default(null),
  concepto: z.string().default(""),
  fecha: fechaISO,
});

const desgloseSchema = z.object({
  codigo: z.string().min(1),
  subCodigo: z.string().min(1),
  concepto: z.string().default(""),
  estimado: dinero,
  real: dinero,
  cantidad: dinero,
  precioUnit: dinero,
  tipoCambio: dinero,
  nota: z.string().nullable().optional().default(null),
});

const marketingSchema = z.object({
  codigo: z.string().min(1),
  redSocial: z.string().default("Instagram"),
  concepto: z.string().default(""),
  vistasEstimado: entero,
  vistasReal: entero,
  interaccionEstimado: entero,
  interaccionReal: entero,
});

const eventoSchema = z.object({
  sheet: z.string().optional(),
  nombre: z.string().min(1),
  categoria: z.string(),
  inicio: fechaISO,
  fin: fechaISO,
  lugar: z.string().nullable().optional().default(null),
  responsable: z.string().nullable().optional().default(null),
  impactosDirectos: z.number().int().nullable().optional().default(0),
  ingresos: z.array(movimientoSchema).default([]),
  egresos: z.array(movimientoSchema).default([]),
  desglose: z.array(desgloseSchema).default([]),
  marketing: z.array(marketingSchema).default([]),
});

const archivoSchema = z.object({
  periodo: z.string().min(1),
  moneda: z.string().optional(),
  eventos: z.array(eventoSchema),
});

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/** Quita acentos y baja a minúsculas, para comparar sin importar cómo se escribió. */
const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

/**
 * El workbook escribe la categoría de varias formas —`Proyecto con recaudación`
 * y `Proyecto con Recaudación` conviven en el archivo real— así que se compara
 * normalizado.
 */
function mapearCategoria(valor: string): CategoriaEvento {
  const n = normalizar(valor);
  if (n.includes("competencia")) return "COMPETENCIA";
  if (n.includes("sin recaudacion")) return "PROYECTO_SIN_RECAUDACION";
  if (n.includes("con recaudacion")) return "PROYECTO_CON_RECAUDACION";
  throw new Error(`Categoría no reconocida: "${valor}"`);
}

function slugify(texto: string): string {
  return normalizar(texto)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Los montos vienen como number de JSON; se pasan a string para que Prisma los reciba exactos. */
const aDecimal = (n: number | null | undefined) =>
  n === null || n === undefined ? null : String(n);

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function main() {
  const ruta = path.join(process.cwd(), "seed-presupuesto.json");
  const crudo: unknown = JSON.parse(await readFile(ruta, "utf8"));

  // Se valida TODO antes de escribir una sola fila: si el export viene mal,
  // quiero un error legible y la base intacta, no un crash a la mitad.
  const datos = archivoSchema.parse(crudo);
  console.log(
    `Leído ${path.basename(ruta)}: periodo ${datos.periodo}, ${datos.eventos.length} eventos`,
  );

  const avisos: string[] = [];

  // Idempotencia: se borra el periodo y todo cuelga en cascada.
  await db.periodo.deleteMany({ where: { nombre: datos.periodo } });
  const periodo = await db.periodo.create({
    data: { nombre: datos.periodo, activo: true },
  });

  const slugsUsados = new Set<string>();
  let totalMovimientos = 0;
  let totalDesglose = 0;
  let totalMarketing = 0;

  for (const ev of datos.eventos) {
    if (!ev.inicio || !ev.fin) {
      avisos.push(`${ev.nombre}: sin fecha de inicio o fin, evento omitido`);
      continue;
    }

    // Slug único dentro del periodo (lo exige @@unique([periodoId, slug])).
    let slug = slugify(ev.sheet ?? ev.nombre);
    if (slugsUsados.has(slug)) {
      let n = 2;
      while (slugsUsados.has(`${slug}-${n}`)) n++;
      slug = `${slug}-${n}`;
      avisos.push(`${ev.nombre}: slug duplicado, se usó "${slug}"`);
    }
    slugsUsados.add(slug);

    // Se indexa el desglose por el código del padre.
    const desglosePorCodigo = new Map<string, typeof ev.desglose>();
    for (const d of ev.desglose) {
      const lista = desglosePorCodigo.get(d.codigo) ?? [];
      lista.push(d);
      desglosePorCodigo.set(d.codigo, lista);
    }

    const movimientos = [
      ...ev.ingresos.map((m) => ({ ...m, tipo: "INGRESO" as const })),
      ...ev.egresos.map((m) => ({ ...m, tipo: "EGRESO" as const })),
    ];
    const codigosPadre = new Set(movimientos.map((m) => m.codigo));

    // Desglose sin padre: se avisa y se omite (§8 del prompt).
    for (const codigo of desglosePorCodigo.keys()) {
      if (!codigosPadre.has(codigo)) {
        const n = desglosePorCodigo.get(codigo)!.length;
        avisos.push(
          `${ev.nombre}: ${n} fila(s) de desglose con código "${codigo}" sin movimiento padre, omitidas`,
        );
      }
    }

    await db.evento.create({
      data: {
        periodoId: periodo.id,
        nombre: ev.nombre,
        slug,
        categoria: mapearCategoria(ev.categoria),
        inicio: ev.inicio,
        fin: ev.fin,
        lugar: ev.lugar,
        responsable: ev.responsable,
        impactosDirectos: ev.impactosDirectos ?? 0,
        movimientos: {
          create: movimientos.map((m) => {
            const hijos = desglosePorCodigo.get(m.codigo) ?? [];

            // El workbook trae subcódigos repetidos dentro del mismo padre
            // (copy-paste en Excel: "Donativo empresa comida" y "…bebida"
            // quedaron ambos como ING-02-001). Son renglones DISTINTOS con
            // dinero propio, así que se renumeran en vez de deduplicar —
            // deduplicar borraría presupuesto real. El subcódigo es solo una
            // etiqueta; los montos son el dato.
            const usados = new Set<string>();
            const subCodigoUnico = (sub: string) => {
              if (!usados.has(sub)) {
                usados.add(sub);
                return sub;
              }
              const base = /^(.*?)(\d+)$/.exec(sub);
              let n = base ? Number(base[2]) : 1;
              const prefijo = base ? base[1]! : `${sub}-`;
              const ancho = base ? base[2]!.length : 3;
              let candidato: string;
              do {
                n++;
                candidato = `${prefijo}${String(n).padStart(ancho, "0")}`;
              } while (usados.has(candidato));
              usados.add(candidato);
              avisos.push(
                `${ev.nombre}/${m.codigo}: subcódigo duplicado "${sub}" renumerado a "${candidato}"`,
              );
              return candidato;
            };

            totalDesglose += hijos.length;
            return {
              tipo: m.tipo,
              codigo: m.codigo,
              fuente: m.fuente,
              concepto: m.concepto,
              fecha: m.fecha,
              desglose: {
                create: hijos.map((d) => ({
                  subCodigo: subCodigoUnico(d.subCodigo),
                  concepto: d.concepto,
                  estimado: aDecimal(d.estimado),
                  real: aDecimal(d.real),
                  cantidad: aDecimal(d.cantidad),
                  precioUnit: aDecimal(d.precioUnit),
                  tipoCambio: aDecimal(d.tipoCambio),
                  nota: d.nota,
                })),
              },
            };
          }),
        },
        marketing: {
          create: ev.marketing.map((mk) => ({
            codigo: mk.codigo,
            redSocial: mk.redSocial,
            concepto: mk.concepto,
            vistasEstimado: mk.vistasEstimado,
            vistasReal: mk.vistasReal,
            interaccionEstimado: mk.interaccionEstimado,
            interaccionReal: mk.interaccionReal,
          })),
        },
      },
    });

    totalMovimientos += movimientos.length;
    totalMarketing += ev.marketing.length;
  }

  console.log(
    `\nSembrado: ${slugsUsados.size} eventos, ${totalMovimientos} movimientos, ` +
      `${totalDesglose} filas de desglose, ${totalMarketing} de marketing.`,
  );

  if (avisos.length > 0) {
    console.log(`\nAvisos (${avisos.length}):`);
    for (const a of avisos) console.log(`  · ${a}`);
  }
}

main()
  .catch((e) => {
    console.error("\nEl seed falló:", e);
    process.exit(1);
  })
  .finally(() => void db.$disconnect());
