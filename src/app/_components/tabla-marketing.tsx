"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { CeldaEditable } from "~/app/_components/celda-editable";
import { Boton, Varianza } from "~/app/_components/ui";
import { formatEntero } from "~/lib/format";
import { sumaEnteros, varianza } from "~/server/finanzas/calc";
import { api, type RouterOutputs } from "~/trpc/react";

type Marketing = RouterOutputs["evento"]["byId"]["marketing"];

/** Plano, sin desglose: alcance e interacciones, estimado contra real. */
export function TablaMarketing({
  eventoId,
  marketing,
  puedeEditar,
}: {
  eventoId: string;
  marketing: Marketing;
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const refrescar = () => router.refresh();
  const update = api.marketing.update.useMutation({ onSuccess: refrescar });
  const create = api.marketing.create.useMutation({ onSuccess: refrescar });
  const borrar = api.marketing.delete.useMutation({ onSuccess: refrescar });

  const vistasEst = sumaEnteros(marketing.map((m) => m.vistasEstimado));
  const vistasReal = sumaEnteros(marketing.map((m) => m.vistasReal));
  const intEst = sumaEnteros(marketing.map((m) => m.interaccionEstimado));
  const intReal = sumaEnteros(marketing.map((m) => m.interaccionReal));

  const num = (v: string | null) => (v === null ? null : Number(v));

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-navy-900/70 uppercase">
          Marketing
        </h2>
        {puedeEditar && (
          <Boton
            variante="secundario"
            onClick={() => create.mutate({ eventoId, concepto: "" })}
            disabled={create.isPending}
          >
            + Agregar publicación
          </Boton>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-navy-100 bg-white shadow-sm">
        <table className="w-full min-w-[46rem] text-sm">
          <thead>
            <tr className="border-b border-navy-100 bg-navy-50/60 text-left text-xs font-medium tracking-wide text-navy-900/60 uppercase">
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Red social</th>
              <th className="px-3 py-2">Concepto</th>
              <th className="px-3 py-2 text-right">Vistas est.</th>
              <th className="px-3 py-2 text-right">Vistas real</th>
              <th className="px-3 py-2 text-right">Interac. est.</th>
              <th className="px-3 py-2 text-right">Interac. real</th>
              {puedeEditar && <th className="w-10" />}
            </tr>
          </thead>
          <tbody>
            {marketing.length === 0 && (
              <tr>
                <td
                  colSpan={puedeEditar ? 8 : 7}
                  className="px-3 py-8 text-center text-navy-900/40"
                >
                  Sin publicaciones registradas.
                </td>
              </tr>
            )}
            {marketing.map((mk) => (
              <tr key={mk.id} className="border-b border-navy-50 hover:bg-navy-50/30">
                <td className="px-3 py-1.5 font-medium whitespace-nowrap text-navy-800">
                  {mk.codigo}
                </td>
                <td className="px-1">
                  <CeldaEditable
                    valorInicial={mk.redSocial}
                    editable={puedeEditar}
                    alineacion="izquierda"
                    onGuardar={(v) =>
                      update.mutateAsync({ id: mk.id, redSocial: v ?? "" })
                    }
                  />
                </td>
                <td className="px-1">
                  <CeldaEditable
                    valorInicial={mk.concepto}
                    editable={puedeEditar}
                    alineacion="izquierda"
                    placeholder="Sin concepto"
                    onGuardar={(v) =>
                      update.mutateAsync({ id: mk.id, concepto: v ?? "" })
                    }
                  />
                </td>
                {(
                  [
                    ["vistasEstimado", mk.vistasEstimado],
                    ["vistasReal", mk.vistasReal],
                    ["interaccionEstimado", mk.interaccionEstimado],
                    ["interaccionReal", mk.interaccionReal],
                  ] as const
                ).map(([campo, valor]) => (
                  <td key={campo} className="px-1">
                    <CeldaEditable
                      valorInicial={valor?.toString() ?? null}
                      formato="entero"
                      editable={puedeEditar}
                      onGuardar={(v) =>
                        update.mutateAsync({ id: mk.id, [campo]: num(v) })
                      }
                    />
                  </td>
                ))}
                {puedeEditar && (
                  <td className="pr-2">
                    <BotonBorrarMkt onConfirmar={() => borrar.mutate({ id: mk.id })} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>

          {marketing.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-navy-200 bg-navy-50/40 font-semibold">
                <td colSpan={3} className="px-3 py-2 text-navy-900/70">
                  Total
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatEntero(vistasEst)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatEntero(vistasReal)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatEntero(intEst)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatEntero(intReal)}
                </td>
                {puedeEditar && <td />}
              </tr>
              <tr className="bg-navy-50/40 text-xs">
                <td colSpan={3} className="px-3 pb-2 text-navy-900/50">
                  Diferencia
                </td>
                <td colSpan={2} className="px-3 pb-2 text-right">
                  <Varianza valor={varianza(vistasEst, vistasReal)} />
                  <span className="ml-1 text-navy-900/40">alcance</span>
                </td>
                <td colSpan={2} className="px-3 pb-2 text-right">
                  <Varianza valor={varianza(intEst, intReal)} />
                  <span className="ml-1 text-navy-900/40">interacciones</span>
                </td>
                {puedeEditar && <td />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
}

function BotonBorrarMkt({ onConfirmar }: { onConfirmar: () => void }) {
  const [confirmando, setConfirmando] = useState(false);
  if (confirmando) {
    return (
      <div className="flex gap-1">
        <button
          type="button"
          onClick={onConfirmar}
          className="rounded px-1.5 py-0.5 text-xs font-medium text-rose-600 hover:bg-rose-50"
        >
          Sí
        </button>
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          className="rounded px-1.5 py-0.5 text-xs text-navy-900/50 hover:bg-navy-50"
        >
          No
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => setConfirmando(true)}
      className="rounded px-1.5 py-0.5 text-navy-900/25 hover:bg-rose-50 hover:text-rose-600"
    >
      ×
    </button>
  );
}
