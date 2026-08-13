"use client";

import { Boton } from "~/app/_components/ui";

/**
 * El PDF sale del diálogo de impresión del navegador ("Guardar como PDF"),
 * que respeta el print CSS de globals.css. Suficiente para v1: no hace falta
 * una librería de PDF del lado del servidor.
 */
export function BotonImprimir() {
  return <Boton onClick={() => window.print()}>Imprimir o guardar PDF</Boton>;
}
