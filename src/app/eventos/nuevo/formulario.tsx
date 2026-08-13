"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Boton, etiquetaCategoria } from "~/app/_components/ui";
import { api } from "~/trpc/react";

const CATEGORIAS = [
  "PROYECTO_CON_RECAUDACION",
  "PROYECTO_SIN_RECAUDACION",
  "COMPETENCIA",
] as const;

const etiqueta = "block text-sm font-medium text-navy-900/70";
const control =
  "mt-1 w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-600/20";

/** El bloque de encabezado del workbook (D6, D7, H6, J6, H7, H8, H9). */
export function FormularioNuevoEvento() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const crear = api.evento.create.useMutation({
    onSuccess: (evento) => {
      router.push(`/eventos/${evento.id}`);
      router.refresh();
    },
    onError: (e) => setError(e.message),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const f = new FormData(e.currentTarget);
        const texto = (k: string) => {
          const v = f.get(k);
          return typeof v === "string" && v.trim() !== "" ? v.trim() : null;
        };
        crear.mutate({
          nombre: texto("nombre") ?? "",
          categoria: (texto("categoria") ??
            "PROYECTO_SIN_RECAUDACION") as (typeof CATEGORIAS)[number],
          inicio: texto("inicio"),
          fin: texto("fin"),
          lugar: texto("lugar"),
          responsable: texto("responsable"),
          impactosDirectos: Number(texto("impactosDirectos") ?? 0),
        });
      }}
      className="space-y-4"
    >
      <div>
        <label htmlFor="nombre" className={etiqueta}>
          Nombre del evento
        </label>
        <input
          id="nombre"
          name="nombre"
          required
          placeholder="RoboCamp"
          className={control}
        />
      </div>

      <div>
        <label htmlFor="categoria" className={etiqueta}>
          Categoría
        </label>
        <select id="categoria" name="categoria" className={control}>
          {CATEGORIAS.map((c) => (
            <option key={c} value={c}>
              {etiquetaCategoria(c)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="inicio" className={etiqueta}>
            Inicio
          </label>
          <input id="inicio" name="inicio" type="date" required className={control} />
        </div>
        <div>
          <label htmlFor="fin" className={etiqueta}>
            Fin
          </label>
          <input id="fin" name="fin" type="date" required className={control} />
        </div>
      </div>

      <div>
        <label htmlFor="lugar" className={etiqueta}>
          Lugar
        </label>
        <input
          id="lugar"
          name="lugar"
          placeholder="Tec de Monterrey"
          className={control}
        />
      </div>

      <div>
        <label htmlFor="responsable" className={etiqueta}>
          Responsable
        </label>
        <input
          id="responsable"
          name="responsable"
          placeholder="Nombre de quien rinde cuentas"
          className={control}
        />
      </div>

      <div>
        <label htmlFor="impactosDirectos" className={etiqueta}>
          Impactos directos
        </label>
        <input
          id="impactosDirectos"
          name="impactosDirectos"
          type="number"
          min={0}
          defaultValue={0}
          className={control}
        />
        <p className="mt-1 text-xs text-navy-900/45">
          Personas alcanzadas de forma directa por el evento.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        <Boton type="submit" disabled={crear.isPending}>
          {crear.isPending ? "Creando…" : "Crear evento"}
        </Boton>
        <Boton href="/" variante="secundario">
          Cancelar
        </Boton>
      </div>
    </form>
  );
}
