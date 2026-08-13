import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";

import {
  formatEntero,
  formatFecha,
  formatFechaISO,
  formatMXN,
  formatVarianza,
  parseFechaISO,
  slugify,
} from "./format";

describe("formatMXN", () => {
  it("formatea pesos con separador de miles y dos decimales", () => {
    expect(formatMXN(1234.56)).toBe("$1,234.56");
    expect(formatMXN(new Decimal("510283.20"))).toBe("$510,283.20");
    expect(formatMXN("0")).toBe("$0.00");
  });

  it("muestra guion en nulos, nunca $NaN", () => {
    expect(formatMXN(null)).toBe("—");
    expect(formatMXN(undefined)).toBe("—");
  });
});

describe("formatVarianza", () => {
  it("muestra el signo explícito", () => {
    expect(formatVarianza(new Decimal("0.2857142857"))).toBe("+28.6%");
    expect(formatVarianza(new Decimal("-0.15"))).toBe("-15.0%");
    expect(formatVarianza(new Decimal("0"))).toBe("+0.0%");
  });

  it("null (división entre cero) se muestra como guion, no #DIV/0!", () => {
    expect(formatVarianza(null)).toBe("—");
  });
});

describe("formatFecha — el bug de la zona horaria", () => {
  it("NO corre la fecha un día hacia atrás en zona de México", () => {
    // Prisma devuelve las columnas `date` en medianoche UTC. Formatear esto en
    // America/Monterrey (UTC-6) daría "26 jul 2026", que es el bug clásico.
    const inicio = new Date("2026-07-27T00:00:00.000Z");
    expect(formatFecha(inicio)).toBe("27 jul 2026");
  });

  it("respeta el día en los bordes de mes y año", () => {
    expect(formatFecha(new Date("2026-01-01T00:00:00.000Z"))).toBe("1 ene 2026");
    expect(formatFecha(new Date("2026-12-31T00:00:00.000Z"))).toBe(
      "31 dic 2026",
    );
  });

  it("muestra guion en nulos y fechas inválidas", () => {
    expect(formatFecha(null)).toBe("—");
    expect(formatFecha(new Date("no es fecha"))).toBe("—");
  });
});

describe("parseFechaISO / formatFechaISO", () => {
  it("da la vuelta completa sin perder el día", () => {
    const d = parseFechaISO("2026-07-27");
    expect(d?.toISOString()).toBe("2026-07-27T00:00:00.000Z");
    expect(formatFechaISO(d)).toBe("2026-07-27");
    expect(formatFecha(d)).toBe("27 jul 2026");
  });

  it("rechaza formatos que no sean YYYY-MM-DD", () => {
    expect(parseFechaISO("27/07/2026")).toBeNull();
    expect(parseFechaISO("")).toBeNull();
    expect(parseFechaISO(null)).toBeNull();
  });
});

describe("formatEntero", () => {
  it("agrupa miles para alcance e interacciones", () => {
    expect(formatEntero(112170)).toBe("112,170");
    expect(formatEntero(0)).toBe("0");
    expect(formatEntero(null)).toBe("—");
  });
});

describe("slugify", () => {
  it("genera slugs de URL a partir de los nombres reales de las hojas", () => {
    expect(slugify("RoboCamp")).toBe("robocamp");
    expect(slugify("Taller CNC cortadora laser")).toBe(
      "taller-cnc-cortadora-laser",
    );
    expect(slugify("Recolecta_Basura_Electronica")).toBe(
      "recolecta-basura-electronica",
    );
    expect(slugify("Evento networking")).toBe("evento-networking");
  });

  it("quita acentos", () => {
    expect(slugify("Aportación por alumno")).toBe("aportacion-por-alumno");
  });
});
