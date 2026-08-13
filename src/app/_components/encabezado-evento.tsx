"use client";

import { useRouter } from "next/navigation";

import { CeldaEditable } from "~/app/_components/celda-editable";
import { etiquetaCategoria } from "~/app/_components/ui";
import { formatFechaISO } from "~/lib/format";
import { api, type RouterOutputs } from "~/trpc/react";

type Evento = RouterOutputs["evento"]["byId"];

const CATEGORIAS = [
  "PROYECTO_CON_RECAUDACION",
  "PROYECTO_SIN_RECAUDACION",
  "COMPETENCIA",
] as const;

/** El bloque de encabezado del workbook (celdas B6:J9), editable en su lugar. */
export function EncabezadoEvento({
  evento,
  puedeEditar,
}: {
  evento: Evento;
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const update = api.evento.update.useMutation({
    onSuccess: () => router.refresh(),
  });

  const campo = (
    etiqueta: string,
    valor: string | null,
    guardar: (v: string | null) => Promise<unknown>,
    placeholder?: string,
  ) => (
    <div>
      <dt className="text-xs font-medium tracking-wide text-navy-900/45 uppercase">
        {etiqueta}
      </dt>
      <dd className="mt-0.5">
        <CeldaEditable
          valorInicial={valor}
          editable={puedeEditar}
          alineacion="izquierda"
          placeholder={placeholder}
          onGuardar={guardar}
        />
      </dd>
    </div>
  );

  return (
    <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
      {campo("Inicio", formatFechaISO(evento.inicio) || null, (v) =>
        update.mutateAsync({ id: evento.id, inicio: v }),
      )}
      {campo("Fin", formatFechaISO(evento.fin) || null, (v) =>
        update.mutateAsync({ id: evento.id, fin: v }),
      )}
      {campo(
        "Lugar",
        evento.lugar,
        (v) => update.mutateAsync({ id: evento.id, lugar: v }),
        "Sin especificar",
      )}
      {campo(
        "Responsable",
        evento.responsable,
        (v) => update.mutateAsync({ id: evento.id, responsable: v }),
        "Sin asignar",
      )}
      {campo("Impactos directos", String(evento.impactosDirectos), (v) =>
        update.mutateAsync({ id: evento.id, impactosDirectos: Number(v ?? 0) }),
      )}

      <div>
        <dt className="text-xs font-medium tracking-wide text-navy-900/45 uppercase">
          Categoría
        </dt>
        <dd className="mt-0.5">
          {puedeEditar ? (
            <select
              value={evento.categoria}
              onChange={(e) =>
                update.mutate({
                  id: evento.id,
                  categoria: e.target.value as (typeof CATEGORIAS)[number],
                })
              }
              className="w-full rounded border border-transparent bg-transparent px-2 py-1 text-sm hover:border-navy-200 hover:bg-white focus:border-navy-600 focus:bg-white focus:outline-none"
            >
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {etiquetaCategoria(c)}
                </option>
              ))}
            </select>
          ) : (
            <div className="px-2 py-1 text-sm text-navy-900/70">
              {etiquetaCategoria(evento.categoria)}
            </div>
          )}
        </dd>
      </div>
    </dl>
  );
}
