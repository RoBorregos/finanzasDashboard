/**
 * Valores derivados — fuente única de verdad.
 *
 * Todo lo que el workbook calculaba con fórmulas (`SUMIFS`, los checks ocultos
 * AA4/AB4/AC4, las varianzas, la macro `Actualizar_Maestra`) vive aquí, en
 * funciones PURAS sobre filas ya traídas de la base. Dashboards, estado de
 * cuenta y export CSV consumen estas funciones; ningún componente recalcula.
 *
 * Reglas que no se negocian:
 *  - Dinero con Decimal, nunca float. `0.1 + 0.2` no es `0.3` y un presupuesto
 *    de medio millón acumula ese error.
 *  - División entre cero devuelve `null`, que la UI pinta como "—". El workbook
 *    hoy muestra `#DIV/0!` en varias hojas; eso no se replica.
 *
 * El módulo no importa Prisma a propósito: recibe formas estructurales, así que
 * los tests le pasan objetos planos y los routers le pasan filas de Prisma.
 */
import Decimal from "decimal.js";

// ---------------------------------------------------------------------------
// Tipos de entrada (estructurales)
// ---------------------------------------------------------------------------

/** Prisma devuelve Decimal (su propia copia de decimal.js); los tests pasan number/string. */
export type DineroInput = Decimal | string | number | null | undefined;

export type Estatus = "Completo" | "Pendiente";

export type TipoMovimientoLike = "INGRESO" | "EGRESO";

export interface DesgloseLike {
  estimado: DineroInput;
  real: DineroInput;
}

export interface MovimientoLike {
  tipo: TipoMovimientoLike;
  desglose: DesgloseLike[];
}

export interface MarketingLike {
  vistasEstimado?: number | null;
  vistasReal?: number | null;
  interaccionEstimado?: number | null;
  interaccionReal?: number | null;
}

export interface EventoLike {
  movimientos: MovimientoLike[];
  marketing: MarketingLike[];
}

//Suave
export const CERO = new Decimal(0);

/**
 * Normaliza cualquier entrada de dinero a un Decimal de decimal.js, o `null`.
 * Acepta el Decimal de Prisma, que es la misma clase en otra copia del paquete
 * (por eso `Decimal.isDecimal` y no `instanceof`).
 */
export function toDecimal(valor: DineroInput): Decimal | null {
  if (valor === null || valor === undefined) return null;
  if (Decimal.isDecimal(valor)) return new Decimal(valor.toString());
  if (typeof valor === "number") {
    if (!Number.isFinite(valor)) return null;
    return new Decimal(valor);
  }
  const texto = valor.trim();
  if (texto === "") return null;
  try {
    const d = new Decimal(texto);
    return d.isFinite() ? d : null;
  } catch {
    return null;
  }
}

/** Suma tratando los nulos como ausentes (no como cero negativo ni error). */
export function sumaDinero(valores: DineroInput[]): Decimal {
  return valores.reduce<Decimal>((acc, v) => {
    const d = toDecimal(v);
    return d ? acc.plus(d) : acc;
  }, CERO);
}

/** Suma de enteros (vistas, interacciones, impactos). */
export function sumaEnteros(valores: (number | null | undefined)[]): number {
  return valores.reduce<number>((acc, v) => acc + (v ?? 0), 0);
}

/**
 * Varianza porcentual: `real / estimado - 1`.
 * Devuelve `null` cuando el estimado es 0, null o no numérico — nunca Infinity
 * ni NaN. `1` significa +100%; la UI se encarga de formatear el signo y color.
 */
export function varianza(estimado: DineroInput, real: DineroInput): Decimal | null {
  const e = toDecimal(estimado);
  const r = toDecimal(real);
  if (e === null || r === null || e.isZero()) return null;
  return r.div(e).minus(1);
}

/**
 * Parsea dinero capturado a mano tolerando `$`, comas, espacios (incluido el
 * espacio duro que pega Excel) y paréntesis contables para negativos.
 * Devuelve `null` si la cadena queda vacía; lanza si hay basura no numérica,
 * para que el router responda con un error de validación en vez de guardar 0.
 */
export function parseDinero(entrada: string | null | undefined): Decimal | null {
  if (entrada === null || entrada === undefined) return null;

  let texto = entrada.replace(/[\s ]/g, "").replace(/[$,]/g, "");
  if (texto === "") return null;

  // Notación contable: (1,234.56) === -1234.56
  let negativo = false;
  if (/^\(.*\)$/.test(texto)) {
    negativo = true;
    texto = texto.slice(1, -1);
  }

  const d = toDecimal(texto);
  if (d === null) {
    throw new Error(`Monto inválido: "${entrada}"`);
  }
  return negativo ? d.negated() : d;
}

/**
 * Los usuarios piensan en cantidad × precio unitario, a veces × tipo de cambio
 * (ej. EGR-01-003 "Motores" de Larc_Open: 164.97 USD × 17.14).
 * Guardamos el monto resuelto Y los insumos, para que la cuenta sea auditable.
 *
 * Devuelve `null` si no hay suficientes insumos, para que quien llama decida si
 * conservar el monto capturado a mano.
 */
export function resolverMonto(insumos: {
  cantidad?: DineroInput;
  precioUnit?: DineroInput;
  tipoCambio?: DineroInput;
}): Decimal | null {
  const cantidad = toDecimal(insumos.cantidad);
  const precioUnit = toDecimal(insumos.precioUnit);
  if (cantidad === null || precioUnit === null) return null;

  const tipoCambio = toDecimal(insumos.tipoCambio);
  const bruto = cantidad.times(precioUnit);
  const total = tipoCambio ? bruto.times(tipoCambio) : bruto;

  // Se redondea a la precisión de la columna (numeric(12,2)) para que lo que
  // muestra la UI sea idéntico a lo que queda guardado.
  return total.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

// ---------------------------------------------------------------------------
// Movimiento (una fila de Ingresos_<Evento> / Egresos_<Evento>)
// ---------------------------------------------------------------------------

export interface TotalesMovimiento {
  estimado: Decimal;
  real: Decimal;
  estatus: Estatus;
}

/**
 * El `SUMIFS` del workbook: los montos del padre son la suma de su desglose,
 * nunca se capturan ni se guardan.
 *
 * Estatus (§2.3): `Pendiente` si no hay desglose, o si algún renglón trae
 * `estimado`/`real` vacío. En cualquier otro caso, `Completo`.
 */
export function totalesMovimiento(desglose: DesgloseLike[]): TotalesMovimiento {
  const estimado = sumaDinero(desglose.map((d) => d.estimado));
  const real = sumaDinero(desglose.map((d) => d.real));

  const incompleto =
    desglose.length === 0 ||
    desglose.some(
      (d) => toDecimal(d.estimado) === null || toDecimal(d.real) === null,
    );

  return { estimado, real, estatus: incompleto ? "Pendiente" : "Completo" };
}

// ---------------------------------------------------------------------------
// Evento (una hoja del workbook)
// ---------------------------------------------------------------------------

/**
 * Los tres checks ocultos del workbook (AA4, AB4, AC4) que alimentaban el
 * "Reporte Completo / Datos Faltantes" de E12. Se devuelven por separado —no
 * solo el AND— para que la UI pueda decir POR QUÉ está incompleto.
 *
 * Nota: la versión de Excel del primer check es un `COUNTBLANK(...)=2` descuidado
 * que tolera exactamente la fila vacía del final. Aquí se implementa la
 * intención correcta: cero renglones de desglose con estimado o real vacío.
 */
export interface Completitud {
  completo: boolean;
  todosDesglosesLlenos: boolean;
  todoIngresoTieneDesglose: boolean;
  todoEgresoTieneDesglose: boolean;
}

export interface ResumenEvento {
  ingresoEstimado: Decimal;
  ingresoReal: Decimal;
  egresoEstimado: Decimal;
  egresoReal: Decimal;
  balanceEstimado: Decimal;
  balanceReal: Decimal;
  varianzaIngreso: Decimal | null;
  varianzaEgreso: Decimal | null;
  varianzaBalance: Decimal | null;
  alcanceEstimado: number;
  alcanceReal: number;
  interaccionesEstimado: number;
  interaccionesReal: number;
  varianzaAlcance: Decimal | null;
  varianzaInteracciones: Decimal | null;
  completitud: Completitud;
}

export function resumenEvento(evento: EventoLike): ResumenEvento {
  const ingresos = evento.movimientos.filter((m) => m.tipo === "INGRESO");
  const egresos = evento.movimientos.filter((m) => m.tipo === "EGRESO");

  const totalesDe = (movs: MovimientoLike[]) => {
    const t = movs.map((m) => totalesMovimiento(m.desglose));
    return {
      estimado: sumaDinero(t.map((x) => x.estimado)),
      real: sumaDinero(t.map((x) => x.real)),
    };
  };

  const ing = totalesDe(ingresos);
  const egr = totalesDe(egresos);

  const balanceEstimado = ing.estimado.minus(egr.estimado);
  const balanceReal = ing.real.minus(egr.real);

  const alcanceEstimado = sumaEnteros(evento.marketing.map((m) => m.vistasEstimado));
  const alcanceReal = sumaEnteros(evento.marketing.map((m) => m.vistasReal));
  const interaccionesEstimado = sumaEnteros(
    evento.marketing.map((m) => m.interaccionEstimado),
  );
  const interaccionesReal = sumaEnteros(
    evento.marketing.map((m) => m.interaccionReal),
  );

  const todosLosDesgloses = evento.movimientos.flatMap((m) => m.desglose);
  const todosDesglosesLlenos = todosLosDesgloses.every(
    (d) => toDecimal(d.estimado) !== null && toDecimal(d.real) !== null,
  );
  const todoIngresoTieneDesglose = ingresos.every((m) => m.desglose.length > 0);
  const todoEgresoTieneDesglose = egresos.every((m) => m.desglose.length > 0);

  return {
    ingresoEstimado: ing.estimado,
    ingresoReal: ing.real,
    egresoEstimado: egr.estimado,
    egresoReal: egr.real,
    balanceEstimado,
    balanceReal,
    varianzaIngreso: varianza(ing.estimado, ing.real),
    varianzaEgreso: varianza(egr.estimado, egr.real),
    varianzaBalance: varianza(balanceEstimado, balanceReal),
    alcanceEstimado,
    alcanceReal,
    interaccionesEstimado,
    interaccionesReal,
    varianzaAlcance: varianza(alcanceEstimado, alcanceReal),
    varianzaInteracciones: varianza(interaccionesEstimado, interaccionesReal),
    completitud: {
      completo:
        todosDesglosesLlenos &&
        todoIngresoTieneDesglose &&
        todoEgresoTieneDesglose,
      todosDesglosesLlenos,
      todoIngresoTieneDesglose,
      todoEgresoTieneDesglose,
    },
  };
}

// ---------------------------------------------------------------------------
// Periodo (la hoja MAESTRA)
// ---------------------------------------------------------------------------

export interface ResumenPeriodo {
  ingresoEstimado: Decimal;
  ingresoReal: Decimal;
  egresoEstimado: Decimal;
  egresoReal: Decimal;
  balanceEstimado: Decimal;
  balanceReal: Decimal;
  varianzaIngreso: Decimal | null;
  varianzaEgreso: Decimal | null;
  alcanceEstimado: number;
  alcanceReal: number;
  interaccionesEstimado: number;
  interaccionesReal: number;
  eventosCompletos: number;
  totalEventos: number;
}

/**
 * El equivalente de `Tabla_Maestra` + su fila de gran total. En el workbook esto
 * lo regeneraba la macro `Actualizar_Maestra` y quedaba guardado; aquí es una
 * agregación en vivo sobre los resúmenes por evento, nunca una copia.
 */
export function resumenPeriodo(resumenes: ResumenEvento[]): ResumenPeriodo {
  const ingresoEstimado = sumaDinero(resumenes.map((r) => r.ingresoEstimado));
  const ingresoReal = sumaDinero(resumenes.map((r) => r.ingresoReal));
  const egresoEstimado = sumaDinero(resumenes.map((r) => r.egresoEstimado));
  const egresoReal = sumaDinero(resumenes.map((r) => r.egresoReal));

  return {
    ingresoEstimado,
    ingresoReal,
    egresoEstimado,
    egresoReal,
    balanceEstimado: ingresoEstimado.minus(egresoEstimado),
    balanceReal: ingresoReal.minus(egresoReal),
    varianzaIngreso: varianza(ingresoEstimado, ingresoReal),
    varianzaEgreso: varianza(egresoEstimado, egresoReal),
    alcanceEstimado: sumaEnteros(resumenes.map((r) => r.alcanceEstimado)),
    alcanceReal: sumaEnteros(resumenes.map((r) => r.alcanceReal)),
    interaccionesEstimado: sumaEnteros(
      resumenes.map((r) => r.interaccionesEstimado),
    ),
    interaccionesReal: sumaEnteros(resumenes.map((r) => r.interaccionesReal)),
    eventosCompletos: resumenes.filter((r) => r.completitud.completo).length,
    totalEventos: resumenes.length,
  };
}

// ---------------------------------------------------------------------------
// Códigos consecutivos (ING-01, EGR-03, ING-01-002)
// ---------------------------------------------------------------------------

export const PREFIJO_TIPO: Record<TipoMovimientoLike, string> = {
  INGRESO: "ING",
  EGRESO: "EGR",
};

/**
 * Siguiente código de movimiento: `ING-03`, `EGR-05`.
 * Se basa en el máximo existente, no en la cantidad de filas, para que borrar
 * un renglón no reasigne un código ya usado.
 */
export function siguienteCodigo(
  tipo: TipoMovimientoLike,
  codigosExistentes: string[],
): string {
  const prefijo = PREFIJO_TIPO[tipo];
  const patron = new RegExp(`^${prefijo}-(\\d+)$`);
  const max = codigosExistentes.reduce((acc, codigo) => {
    const m = patron.exec(codigo.trim());
    const n = m?.[1] ? Number.parseInt(m[1], 10) : 0;
    return n > acc ? n : acc;
  }, 0);
  return `${prefijo}-${String(max + 1).padStart(2, "0")}`;
}

/** Siguiente subcódigo de desglose: `ING-01-004`. */
export function siguienteSubCodigo(
  codigoPadre: string,
  subCodigosExistentes: string[],
): string {
  const patron = new RegExp(
    `^${codigoPadre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-(\\d+)$`,
  );
  const max = subCodigosExistentes.reduce((acc, sub) => {
    const m = patron.exec(sub.trim());
    const n = m?.[1] ? Number.parseInt(m[1], 10) : 0;
    return n > acc ? n : acc;
  }, 0);
  return `${codigoPadre}-${String(max + 1).padStart(3, "0")}`;
}
