import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import {
  parseDinero,
  resolverMonto,
  resumenEvento,
  resumenPeriodo,
  siguienteCodigo,
  siguienteSubCodigo,
  sumaDinero,
  toDecimal,
  totalesMovimiento,
  varianza,
  type EventoLike,
  type MovimientoLike,
} from "./calc";

/** Helper: compara Decimals por valor, no por identidad. */
const igual = (recibido: Decimal | null, esperado: string | null) =>
  expect(recibido === null ? null : recibido.toString()).toBe(esperado);

// ---------------------------------------------------------------------------

describe("toDecimal", () => {
  it("normaliza number, string y Decimal", () => {
    igual(toDecimal(1577.68), "1577.68");
    igual(toDecimal("28000"), "28000");
    igual(toDecimal(new Decimal("17000.00")), "17000");
  });

  it("devuelve null para vacíos y basura, nunca NaN", () => {
    igual(toDecimal(null), null);
    igual(toDecimal(undefined), null);
    igual(toDecimal(""), null);
    igual(toDecimal("   "), null);
    igual(toDecimal("abc"), null);
    igual(toDecimal(Number.NaN), null);
    igual(toDecimal(Number.POSITIVE_INFINITY), null);
  });

  it("no pierde precisión como sí lo haría un float", () => {
    // 0.1 + 0.2 === 0.30000000000000004 en punto flotante.
    igual(sumaDinero(["0.1", "0.2"]), "0.3");
  });
});

describe("parseDinero", () => {
  it("tolera $, comas y espacios", () => {
    igual(parseDinero("$1,234.56"), "1234.56");
    igual(parseDinero("  28,000 "), "28000");
    igual(parseDinero("$ 459,139.21"), "459139.21");
  });

  it("acepta el espacio duro que pega Excel", () => {
    igual(parseDinero("$1 234.56"), "1234.56");
  });

  it("interpreta paréntesis como negativo (notación contable)", () => {
    igual(parseDinero("(1,234.56)"), "-1234.56");
  });

  it("devuelve null en vacío y lanza en basura", () => {
    igual(parseDinero(""), null);
    igual(parseDinero(null), null);
    expect(() => parseDinero("doce pesos")).toThrow(/Monto inválido/);
  });
});

describe("resolverMonto", () => {
  it("resuelve cantidad × precio unitario", () => {
    // ING-01-001 "Inscripción Completa": =7*4000
    igual(resolverMonto({ cantidad: 7, precioUnit: 4000 }), "28000");
    // real: =9*4000
    igual(resolverMonto({ cantidad: 9, precioUnit: 4000 }), "36000");
  });

  it("aplica tipo de cambio para compras en USD", () => {
    // EGR-01-003 "Motores" (Larc_Open): =164.97*17.14 = 2827.5858
    igual(
      resolverMonto({ cantidad: 1, precioUnit: 164.97, tipoCambio: 17.14 }),
      "2827.59",
    );
  });

  it("redondea a la precisión de la columna numeric(12,2)", () => {
    igual(resolverMonto({ cantidad: 3, precioUnit: "10.005" }), "30.02");
  });

  it("devuelve null si faltan insumos", () => {
    igual(resolverMonto({ cantidad: 7 }), null);
    igual(resolverMonto({ precioUnit: 4000 }), null);
    igual(resolverMonto({}), null);
  });
});

describe("varianza", () => {
  it("calcula real/estimado - 1", () => {
    // 36000 sobre 28000 estimado = +28.57%. Es periódico, así que se compara al
    // redondeo con el que se muestra, no la cadena completa de 20 dígitos.
    expect(varianza(28000, 36000)?.toFixed(6)).toBe("0.285714");
    igual(varianza(100, 50), "-0.5");
    igual(varianza(100, 100), "0");
  });

  it("devuelve null en división entre cero — nunca Infinity ni #DIV/0!", () => {
    igual(varianza(0, 5000), null);
    igual(varianza(null, 5000), null);
    igual(varianza("", 5000), null);
  });

  it("devuelve null si falta el real", () => {
    igual(varianza(28000, null), null);
  });
});

// ---------------------------------------------------------------------------

describe("totalesMovimiento (el SUMIFS del workbook)", () => {
  it("suma el desglose y marca Completo", () => {
    const t = totalesMovimiento([
      { estimado: 28000, real: 36000 },
      { estimado: 17000, real: 17000 },
    ]);
    igual(t.estimado, "45000");
    igual(t.real, "53000");
    expect(t.estatus).toBe("Completo");
  });

  it("sin desglose ⇒ Pendiente y totales en cero", () => {
    const t = totalesMovimiento([]);
    igual(t.estimado, "0");
    igual(t.real, "0");
    expect(t.estatus).toBe("Pendiente");
  });

  it("con algún renglón sin estimado o sin real ⇒ Pendiente", () => {
    expect(
      totalesMovimiento([{ estimado: 28000, real: null }]).estatus,
    ).toBe("Pendiente");
    expect(
      totalesMovimiento([{ estimado: null, real: 36000 }]).estatus,
    ).toBe("Pendiente");
    expect(
      totalesMovimiento([
        { estimado: 100, real: 100 },
        { estimado: 200, real: null },
      ]).estatus,
    ).toBe("Pendiente");
  });

  it("suma los renglones llenos aunque el estatus sea Pendiente", () => {
    const t = totalesMovimiento([
      { estimado: 100, real: 100 },
      { estimado: 200, real: null },
    ]);
    igual(t.estimado, "300");
    igual(t.real, "100");
  });
});

// ---------------------------------------------------------------------------

describe("resumenEvento — los tres checks de completitud (AA4/AB4/AC4)", () => {
  const evento = (movimientos: MovimientoLike[]): EventoLike => ({
    movimientos,
    marketing: [],
  });

  it("todo lleno ⇒ los tres checks pasan", () => {
    const r = resumenEvento(
      evento([
        { tipo: "INGRESO", desglose: [{ estimado: 100, real: 100 }] },
        { tipo: "EGRESO", desglose: [{ estimado: 40, real: 40 }] },
      ]),
    );
    expect(r.completitud).toEqual({
      completo: true,
      todosDesglosesLlenos: true,
      todoIngresoTieneDesglose: true,
      todoEgresoTieneDesglose: true,
    });
  });

  it("AA4: un desglose con hueco tumba solo todosDesglosesLlenos", () => {
    const r = resumenEvento(
      evento([
        { tipo: "INGRESO", desglose: [{ estimado: 100, real: null }] },
        { tipo: "EGRESO", desglose: [{ estimado: 40, real: 40 }] },
      ]),
    );
    expect(r.completitud.todosDesglosesLlenos).toBe(false);
    expect(r.completitud.todoIngresoTieneDesglose).toBe(true);
    expect(r.completitud.todoEgresoTieneDesglose).toBe(true);
    expect(r.completitud.completo).toBe(false);
  });

  it("AC4: un ingreso sin desglose tumba solo todoIngresoTieneDesglose", () => {
    const r = resumenEvento(
      evento([
        { tipo: "INGRESO", desglose: [] },
        { tipo: "EGRESO", desglose: [{ estimado: 40, real: 40 }] },
      ]),
    );
    expect(r.completitud.todoIngresoTieneDesglose).toBe(false);
    expect(r.completitud.todoEgresoTieneDesglose).toBe(true);
    expect(r.completitud.todosDesglosesLlenos).toBe(true);
    expect(r.completitud.completo).toBe(false);
  });

  it("AB4: un egreso sin desglose tumba solo todoEgresoTieneDesglose", () => {
    const r = resumenEvento(
      evento([
        { tipo: "INGRESO", desglose: [{ estimado: 100, real: 100 }] },
        { tipo: "EGRESO", desglose: [] },
      ]),
    );
    expect(r.completitud.todoEgresoTieneDesglose).toBe(false);
    expect(r.completitud.todoIngresoTieneDesglose).toBe(true);
    expect(r.completitud.completo).toBe(false);
  });

  it("un evento vacío está 'completo': no hay nada que reclamar", () => {
    expect(resumenEvento(evento([])).completitud.completo).toBe(true);
  });
});

describe("resumenEvento — totales y balance", () => {
  it("balance = ingresos − egresos, en estimado y en real", () => {
    const r = resumenEvento({
      movimientos: [
        { tipo: "INGRESO", desglose: [{ estimado: 28000, real: 36000 }] },
        { tipo: "INGRESO", desglose: [{ estimado: 17000, real: 17000 }] },
        { tipo: "EGRESO", desglose: [{ estimado: 1577.68, real: 1577.68 }] },
      ],
      marketing: [],
    });
    igual(r.ingresoEstimado, "45000");
    igual(r.ingresoReal, "53000");
    igual(r.egresoEstimado, "1577.68");
    igual(r.egresoReal, "1577.68");
    igual(r.balanceEstimado, "43422.32");
    igual(r.balanceReal, "51422.32");
  });

  it("suma alcance e interacciones de marketing tratando null como 0", () => {
    const r = resumenEvento({
      movimientos: [],
      marketing: [
        {
          vistasEstimado: 2000,
          vistasReal: 3094,
          interaccionEstimado: 1000,
          interaccionReal: 1468,
        },
        {
          vistasEstimado: 500,
          vistasReal: null,
          interaccionEstimado: null,
          interaccionReal: 32,
        },
      ],
    });
    expect(r.alcanceEstimado).toBe(2500);
    expect(r.alcanceReal).toBe(3094);
    expect(r.interaccionesEstimado).toBe(1000);
    expect(r.interaccionesReal).toBe(1500);
  });

  it("varianza null cuando no hay estimado (evento sin capturar)", () => {
    const r = resumenEvento({ movimientos: [], marketing: [] });
    igual(r.varianzaIngreso, null);
    igual(r.varianzaEgreso, null);
    igual(r.varianzaAlcance, null);
  });
});

// ---------------------------------------------------------------------------

describe("resumenEvento — números reales de RoboCamp (§2.5 del workbook)", () => {
  // ING-01 "Aportación por alumno", con su desglose real:
  //   ING-01-001 Inscripción Completa            estimado =7*4000  real =9*4000
  //   ING-01-003 Inscripción Completa Descuento  estimado =5*(4000*(1-0.15))
  const inscripcionCompleta = {
    estimado: resolverMonto({ cantidad: 7, precioUnit: 4000 }),
    real: resolverMonto({ cantidad: 9, precioUnit: 4000 }),
  };
  const inscripcionDescuento = {
    estimado: resolverMonto({ cantidad: 5, precioUnit: 4000 * (1 - 0.15) }),
    real: null,
  };

  it("reproduce los montos del desglose", () => {
    igual(inscripcionCompleta.estimado, "28000");
    igual(inscripcionCompleta.real, "36000");
    igual(inscripcionDescuento.estimado, "17000");
  });

  it("el padre ING-01 suma su desglose y queda Pendiente por el hueco", () => {
    const t = totalesMovimiento([inscripcionCompleta, inscripcionDescuento]);
    igual(t.estimado, "45000"); // 28000 + 17000
    igual(t.real, "36000");
    expect(t.estatus).toBe("Pendiente"); // al descuento le falta el real
  });

  it("el evento arrastra el hueco al badge de completitud", () => {
    const r = resumenEvento({
      movimientos: [
        {
          tipo: "INGRESO",
          desglose: [inscripcionCompleta, inscripcionDescuento],
        },
        {
          tipo: "EGRESO",
          desglose: [{ estimado: 1577.68, real: 1577.68 }],
        },
      ],
      marketing: [
        {
          vistasEstimado: 2000,
          vistasReal: 3094,
          interaccionEstimado: 1000,
          interaccionReal: 1468,
        },
      ],
    });

    igual(r.ingresoEstimado, "45000");
    igual(r.ingresoReal, "36000");
    igual(r.balanceEstimado, "43422.32");
    expect(r.completitud.completo).toBe(false);
    expect(r.completitud.todosDesglosesLlenos).toBe(false);
    expect(r.completitud.todoIngresoTieneDesglose).toBe(true);
    expect(r.completitud.todoEgresoTieneDesglose).toBe(true);
    expect(r.alcanceReal).toBe(3094);
  });
});

// ---------------------------------------------------------------------------

describe("resumenPeriodo (la hoja MAESTRA)", () => {
  it("acumula los resúmenes por evento y calcula el gran total", () => {
    const a = resumenEvento({
      movimientos: [
        { tipo: "INGRESO", desglose: [{ estimado: "510283.20", real: 2000 }] },
      ],
      marketing: [
        {
          vistasEstimado: 112170,
          vistasReal: 41041,
          interaccionEstimado: 0,
          interaccionReal: 0,
        },
      ],
    });
    const b = resumenEvento({
      movimientos: [
        {
          tipo: "EGRESO",
          desglose: [{ estimado: "459139.21", real: "34356.93" }],
        },
      ],
      marketing: [],
    });

    const total = resumenPeriodo([a, b]);

    // Los totales de §2.8 del workbook, que son el test de aceptación.
    igual(total.ingresoEstimado, "510283.2");
    igual(total.egresoEstimado, "459139.21");
    igual(total.balanceEstimado, "51143.99");
    igual(total.ingresoReal, "2000");
    igual(total.egresoReal, "34356.93");
    igual(total.balanceReal, "-32356.93");
    expect(total.alcanceEstimado).toBe(112170);
    expect(total.alcanceReal).toBe(41041);
    expect(total.totalEventos).toBe(2);
  });

  it("un periodo sin eventos da ceros y varianzas null, no NaN", () => {
    const total = resumenPeriodo([]);
    igual(total.ingresoEstimado, "0");
    igual(total.balanceEstimado, "0");
    igual(total.varianzaIngreso, null);
    expect(total.totalEventos).toBe(0);
  });
});

// ---------------------------------------------------------------------------

describe("códigos consecutivos", () => {
  it("sugiere el siguiente código de movimiento", () => {
    expect(siguienteCodigo("INGRESO", [])).toBe("ING-01");
    expect(siguienteCodigo("INGRESO", ["ING-01", "ING-02"])).toBe("ING-03");
    expect(siguienteCodigo("EGRESO", ["EGR-01", "EGR-04"])).toBe("EGR-05");
  });

  it("se basa en el máximo, no en el conteo: borrar no reasigna códigos", () => {
    expect(siguienteCodigo("EGRESO", ["EGR-01", "EGR-07"])).toBe("EGR-08");
  });

  it("ignora códigos del otro tipo", () => {
    expect(siguienteCodigo("INGRESO", ["EGR-09", "ING-01"])).toBe("ING-02");
  });

  it("sugiere el siguiente subcódigo de desglose", () => {
    expect(siguienteSubCodigo("ING-01", [])).toBe("ING-01-001");
    expect(
      siguienteSubCodigo("ING-01", ["ING-01-001", "ING-01-003"]),
    ).toBe("ING-01-004");
    expect(siguienteSubCodigo("EGR-12", ["EGR-12-009"])).toBe("EGR-12-010");
  });
});
