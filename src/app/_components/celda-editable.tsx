"use client";

import { useEffect, useRef, useState } from "react";

import { formatMXN } from "~/lib/format";

type Estado = "reposo" | "guardando" | "error";

/**
 * Celda tipo hoja de cálculo: se ve como texto hasta que la tocas, se edita al
 * hacer clic, guarda al salir (blur) o con Enter, y descarta con Escape.
 *
 * El guardado es optimista: el valor nuevo se pinta de inmediato y solo se
 * revierte si el servidor lo rechaza. Sin spinners bloqueantes — capturar 176
 * renglones con un diálogo de "guardando" en cada uno sería insufrible.
 */
export function CeldaEditable({
  valorInicial,
  onGuardar,
  formato = "texto",
  editable = true,
  alineacion,
  placeholder,
}: {
  valorInicial: string | null;
  onGuardar: (valor: string | null) => Promise<unknown>;
  formato?: "texto" | "dinero" | "entero";
  editable?: boolean;
  alineacion?: "izquierda" | "derecha";
  placeholder?: string;
}) {
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState(valorInicial ?? "");
  // Valor mostrado: se adelanta al servidor para que la captura no se sienta lenta.
  const [confirmado, setConfirmado] = useState(valorInicial);
  const [estado, setEstado] = useState<Estado>("reposo");
  const inputRef = useRef<HTMLInputElement>(null);

  // Si el servidor devuelve algo distinto (revalidación, otro usuario), se acata.
  useEffect(() => {
    if (!editando && estado !== "guardando") setConfirmado(valorInicial);
  }, [valorInicial, editando, estado]);

  const derecha =
    alineacion === "derecha" ||
    (alineacion === undefined && formato !== "texto");

  const mostrar = () => {
    if (confirmado === null || confirmado === "") {
      return <span className="text-navy-900/25">{placeholder ?? "—"}</span>;
    }
    if (formato === "dinero") return formatMXN(confirmado);
    if (formato === "entero")
      return new Intl.NumberFormat("es-MX").format(Number(confirmado));
    return confirmado;
  };

  async function confirmar() {
    setEditando(false);
    const limpio = borrador.trim();
    const nuevo = limpio === "" ? null : limpio;

    if (nuevo === confirmado) return;

    const anterior = confirmado;
    setConfirmado(nuevo); // optimista
    setEstado("guardando");
    try {
      await onGuardar(nuevo);
      setEstado("reposo");
    } catch {
      setConfirmado(anterior); // rollback
      setEstado("error");
      setTimeout(() => setEstado("reposo"), 2500);
    }
  }

  if (!editable) {
    return (
      <div
        className={`px-2 py-1 tabular-nums ${derecha ? "text-right" : ""} text-navy-900/70`}
      >
        {mostrar()}
      </div>
    );
  }

  if (editando) {
    return (
      <input
        ref={inputRef}
        autoFocus
        className={`celda-input ${derecha ? "text-right" : "text-left"}`}
        value={borrador}
        onChange={(e) => setBorrador(e.target.value)}
        onBlur={() => void confirmar()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            inputRef.current?.blur();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setBorrador(confirmado ?? "");
            setEditando(false);
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      title={estado === "error" ? "No se pudo guardar. Intenta de nuevo." : undefined}
      onClick={() => {
        setBorrador(confirmado ?? "");
        setEditando(true);
      }}
      className={`celda-input ${derecha ? "text-right" : "text-left"} ${
        estado === "error" ? "!border-rose-400 !bg-rose-50" : ""
      } ${estado === "guardando" ? "opacity-60" : ""}`}
    >
      {mostrar()}
    </button>
  );
}

/** Celda derivada: se ve distinta y no se puede tocar (el SUMIFS del Excel). */
export function CeldaCalculada({
  valor,
  titulo,
}: {
  valor: string;
  titulo?: string;
}) {
  return (
    <div
      title={titulo ?? "Calculado a partir del desglose"}
      className="celda-input celda-calculada text-right"
    >
      {valor}
    </div>
  );
}
