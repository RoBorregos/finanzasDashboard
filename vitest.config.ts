import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Resuelve el alias `~/` de tsconfig.json dentro de los tests.
    tsconfigPaths: true,
  },
  test: {
    // calc.ts es puro: no necesita jsdom ni base de datos.
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Se fija la zona del equipo. Las columnas `date` llegan en medianoche UTC;
    // si el formateo se hiciera en hora local, 2026-07-27 se vería como el 26.
    // Con esto la regresión se detecta corra donde corra la suite, no solo en
    // la máquina de quien esté en México.
    env: { TZ: "America/Monterrey" },
  },
});
