"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { CeldaCalculada, CeldaEditable } from "~/app/_components/celda-editable";
import { BadgeEstatus, Boton, Varianza } from "~/app/_components/ui";
import { formatFechaISO, formatMXN } from "~/lib/format";
// calc.ts es puro (solo depende de decimal.js), así que se puede usar también
// del lado del cliente: la fila de totales sale de la MISMA función que el
// servidor, no de una copia reimplementada aquí.
import { sumaDinero, totalesMovimiento, varianza } from "~/server/finanzas/calc";
import { api, type RouterOutputs } from "~/trpc/react";

type Evento = RouterOutputs["evento"]["byId"];
type Movimiento = Evento["movimientos"][number];

export function TablaMovimientos({
  eventoId,
  tipo,
  movimientos,
  puedeEditar,
}: {
  eventoId: string;
  tipo: "INGRESO" | "EGRESO";
  movimientos: Movimiento[];
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const refrescar = () => router.refresh();

  const mMovimiento = {
    update: api.movimiento.update.useMutation({ onSuccess: refrescar }),
    create: api.movimiento.create.useMutation({ onSuccess: refrescar }),
    delete: api.movimiento.delete.useMutation({ onSuccess: refrescar }),
  };
  const mDesglose = {
    update: api.desglose.update.useMutation({ onSuccess: refrescar }),
    create: api.desglose.create.useMutation({ onSuccess: refrescar }),
    delete: api.desglose.delete.useMutation({ onSuccess: refrescar }),
  };

  const esIngreso = tipo === "INGRESO";
  const filas = movimientos.filter((m) => m.tipo === tipo);

  // Totales de la tabla: la fila de SUM del workbook.
  const totales = filas.map((m) => totalesMovimiento(m.desglose));
  const sumaEstimado = sumaDinero(totales.map((t) => t.estimado));
  const sumaReal = sumaDinero(totales.map((t) => t.real));

  const toggle = (id: string) =>
    setAbiertos((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide text-navy-900/70 uppercase">
          {esIngreso ? "Ingresos" : "Egresos"}
        </h2>
        {puedeEditar && (
          <Boton
            variante="secundario"
            onClick={() =>
              mMovimiento.create.mutate({
                eventoId,
                tipo,
                concepto: "",
              })
            }
            disabled={mMovimiento.create.isPending}
          >
            + Agregar {esIngreso ? "ingreso" : "egreso"}
          </Boton>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-navy-100 bg-white shadow-sm">
        <table className="w-full min-w-[52rem] text-sm">
          <thead>
            <tr className="border-b border-navy-100 bg-navy-50/60 text-left text-xs font-medium tracking-wide text-navy-900/60 uppercase">
              <th className="w-8" />
              <th className="px-3 py-2">ID</th>
              <th className="px-3 py-2">Fuente o patrocinador</th>
              <th className="px-3 py-2">Concepto</th>
              <th className="px-3 py-2 text-right">Estimado</th>
              <th className="px-3 py-2 text-right">Real</th>
              <th className="px-3 py-2">
                {esIngreso ? "Fecha de recepción" : "Fecha de compra"}
              </th>
              <th className="px-3 py-2">Estatus</th>
              {puedeEditar && <th className="w-10" />}
            </tr>
          </thead>
          <tbody>
            {filas.length === 0 && (
              <tr>
                <td
                  colSpan={puedeEditar ? 9 : 8}
                  className="px-3 py-8 text-center text-navy-900/40"
                >
                  Sin {esIngreso ? "ingresos" : "egresos"} registrados.
                </td>
              </tr>
            )}

            {filas.map((m, i) => {
              const t = totales[i]!;
              const abierto = abiertos.has(m.id);
              return (
                <FilaMovimiento
                  key={m.id}
                  movimiento={m}
                  totales={t}
                  abierto={abierto}
                  onToggle={() => toggle(m.id)}
                  puedeEditar={puedeEditar}
                  colSpan={puedeEditar ? 9 : 8}
                  mMovimiento={mMovimiento}
                  mDesglose={mDesglose}
                />
              );
            })}
          </tbody>

          {filas.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-navy-200 bg-navy-50/40 font-semibold">
                <td />
                <td colSpan={3} className="px-3 py-2 text-navy-900/70">
                  Total {esIngreso ? "ingresos" : "egresos"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatMXN(sumaEstimado)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatMXN(sumaReal)}
                </td>
                <td className="px-3 py-2 text-xs font-normal text-navy-900/50">
                  Diferencia
                </td>
                <td className="px-3 py-2">
                  <Varianza
                    valor={varianza(sumaEstimado, sumaReal)}
                    invertir={!esIngreso}
                  />
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

function FilaMovimiento({
  movimiento: m,
  totales: t,
  abierto,
  onToggle,
  puedeEditar,
  colSpan,
  mMovimiento,
  mDesglose,
}: {
  movimiento: Movimiento;
  totales: ReturnType<typeof totalesMovimiento>;
  abierto: boolean;
  onToggle: () => void;
  puedeEditar: boolean;
  colSpan: number;
  mMovimiento: {
    update: ReturnType<typeof api.movimiento.update.useMutation>;
    create: ReturnType<typeof api.movimiento.create.useMutation>;
    delete: ReturnType<typeof api.movimiento.delete.useMutation>;
  };
  mDesglose: {
    update: ReturnType<typeof api.desglose.update.useMutation>;
    create: ReturnType<typeof api.desglose.create.useMutation>;
    delete: ReturnType<typeof api.desglose.delete.useMutation>;
  };
}) {
  return (
    <>
      <tr className="border-b border-navy-100 hover:bg-navy-50/30">
        <td className="pl-2">
          <button
            type="button"
            onClick={onToggle}
            aria-label={abierto ? "Ocultar desglose" : "Ver desglose"}
            className="flex h-6 w-6 items-center justify-center rounded text-navy-900/40 hover:bg-navy-100 hover:text-navy-700"
          >
            <span
              className={`inline-block transition-transform ${abierto ? "rotate-90" : ""}`}
            >
              ▸
            </span>
          </button>
        </td>
        <td className="px-3 py-1.5 font-medium whitespace-nowrap text-navy-800">
          {m.codigo}
          {m.desglose.length > 0 && (
            <span className="ml-1.5 text-xs font-normal text-navy-900/35">
              ({m.desglose.length})
            </span>
          )}
        </td>
        <td className="px-1">
          <CeldaEditable
            valorInicial={m.fuente}
            editable={puedeEditar}
            alineacion="izquierda"
            placeholder="—"
            onGuardar={(v) =>
              mMovimiento.update.mutateAsync({ id: m.id, fuente: v })
            }
          />
        </td>
        <td className="px-1">
          <CeldaEditable
            valorInicial={m.concepto}
            editable={puedeEditar}
            alineacion="izquierda"
            placeholder="Sin concepto"
            onGuardar={(v) =>
              mMovimiento.update.mutateAsync({ id: m.id, concepto: v ?? "" })
            }
          />
        </td>
        {/* Estimado y Real del padre son DERIVADOS: no se capturan aquí. */}
        <td className="px-1">
          <CeldaCalculada valor={formatMXN(t.estimado)} />
        </td>
        <td className="px-1">
          <CeldaCalculada valor={formatMXN(t.real)} />
        </td>
        <td className="px-1">
          <CeldaEditable
            valorInicial={formatFechaISO(m.fecha) || null}
            editable={puedeEditar}
            alineacion="izquierda"
            placeholder="—"
            onGuardar={(v) => mMovimiento.update.mutateAsync({ id: m.id, fecha: v })}
          />
        </td>
        <td className="px-3">
          <BadgeEstatus estatus={t.estatus} />
        </td>
        {puedeEditar && (
          <td className="pr-2">
            <BotonBorrar
              titulo={`Borrar ${m.codigo} y todo su desglose`}
              onConfirmar={() => mMovimiento.delete.mutate({ id: m.id })}
            />
          </td>
        )}
      </tr>

      {abierto && (
        <tr>
          <td colSpan={colSpan} className="bg-navy-50/40 px-2 pt-1 pb-3 pl-10">
            <TablaDesglose
              movimiento={m}
              puedeEditar={puedeEditar}
              mDesglose={mDesglose}
            />
          </td>
        </tr>
      )}
    </>
  );
}

/** El desglose: la ÚNICA superficie donde se captura dinero. */
function TablaDesglose({
  movimiento: m,
  puedeEditar,
  mDesglose,
}: {
  movimiento: Movimiento;
  puedeEditar: boolean;
  mDesglose: {
    update: ReturnType<typeof api.desglose.update.useMutation>;
    create: ReturnType<typeof api.desglose.create.useMutation>;
    delete: ReturnType<typeof api.desglose.delete.useMutation>;
  };
}) {
  return (
    <div className="rounded-lg border border-navy-100 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-navy-100 text-left text-xs font-medium text-navy-900/50">
            <th className="px-3 py-1.5">SubID</th>
            <th className="px-3 py-1.5">Concepto</th>
            <th className="px-3 py-1.5 text-right">Cantidad</th>
            <th className="px-3 py-1.5 text-right">P. unitario</th>
            <th className="px-3 py-1.5 text-right">T. cambio</th>
            <th className="px-3 py-1.5 text-right">Estimado</th>
            <th className="px-3 py-1.5 text-right">Real</th>
            {puedeEditar && <th className="w-10" />}
          </tr>
        </thead>
        <tbody>
          {m.desglose.length === 0 && (
            <tr>
              <td
                colSpan={puedeEditar ? 8 : 7}
                className="px-3 py-4 text-center text-xs text-amber-700"
              >
                Sin desglose. Mientras no tenga al menos un renglón, {m.codigo}{" "}
                queda como Pendiente.
              </td>
            </tr>
          )}
          {m.desglose.map((d) => (
            <tr key={d.id} className="border-b border-navy-50 last:border-0">
              <td className="px-3 py-1 font-mono text-xs whitespace-nowrap text-navy-900/60">
                {d.subCodigo}
              </td>
              <td className="px-1">
                <CeldaEditable
                  valorInicial={d.concepto}
                  editable={puedeEditar}
                  alineacion="izquierda"
                  placeholder="Sin concepto"
                  onGuardar={(v) =>
                    mDesglose.update.mutateAsync({ id: d.id, concepto: v ?? "" })
                  }
                />
              </td>
              <td className="px-1">
                <CeldaEditable
                  valorInicial={d.cantidad?.toString() ?? null}
                  editable={puedeEditar}
                  onGuardar={(v) =>
                    mDesglose.update.mutateAsync({ id: d.id, cantidad: v })
                  }
                />
              </td>
              <td className="px-1">
                <CeldaEditable
                  valorInicial={d.precioUnit?.toString() ?? null}
                  formato="dinero"
                  editable={puedeEditar}
                  onGuardar={(v) =>
                    mDesglose.update.mutateAsync({ id: d.id, precioUnit: v })
                  }
                />
              </td>
              <td className="px-1">
                <CeldaEditable
                  valorInicial={d.tipoCambio?.toString() ?? null}
                  editable={puedeEditar}
                  onGuardar={(v) =>
                    mDesglose.update.mutateAsync({ id: d.id, tipoCambio: v })
                  }
                />
              </td>
              <td className="px-1">
                <CeldaEditable
                  valorInicial={d.estimado?.toString() ?? null}
                  formato="dinero"
                  editable={puedeEditar}
                  onGuardar={(v) =>
                    mDesglose.update.mutateAsync({ id: d.id, estimado: v })
                  }
                />
              </td>
              <td className="px-1">
                <CeldaEditable
                  valorInicial={d.real?.toString() ?? null}
                  formato="dinero"
                  editable={puedeEditar}
                  onGuardar={(v) =>
                    mDesglose.update.mutateAsync({ id: d.id, real: v })
                  }
                />
              </td>
              {puedeEditar && (
                <td className="pr-2">
                  <BotonBorrar
                    titulo={`Borrar ${d.subCodigo}`}
                    onConfirmar={() => mDesglose.delete.mutate({ id: d.id })}
                  />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {puedeEditar && (
        <div className="border-t border-navy-50 px-3 py-1.5">
          <button
            type="button"
            onClick={() =>
              mDesglose.create.mutate({ movimientoId: m.id, concepto: "" })
            }
            disabled={mDesglose.create.isPending}
            className="text-xs font-medium text-navy-600 hover:text-navy-800 disabled:opacity-50"
          >
            + Agregar desglose
          </button>
        </div>
      )}
    </div>
  );
}

/** Borrar pide confirmación: en cascada se lleva el desglose. */
function BotonBorrar({
  titulo,
  onConfirmar,
}: {
  titulo: string;
  onConfirmar: () => void;
}) {
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
      title={titulo}
      onClick={() => setConfirmando(true)}
      className="rounded px-1.5 py-0.5 text-navy-900/25 hover:bg-rose-50 hover:text-rose-600"
    >
      ×
    </button>
  );
}
