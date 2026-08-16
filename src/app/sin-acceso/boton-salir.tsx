"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "~/server/better-auth/client";

/**
 * Cerrar sesión desde el muro de acceso.
 *
 * Existe sobre todo para poder cambiar de cuenta: quien entró con el correo
 * equivocado quedaría atrapado aquí, porque el muro no muestra nada más.
 *
 * `router.refresh()` tras el signOut es lo que hace que la página se vuelva a
 * pintar ya sin sesión; sin eso queda el render cacheado del servidor con el
 * correo del usuario que acaba de salir.
 */
export function BotonSalir() {
  const router = useRouter();
  const [saliendo, setSaliendo] = useState(false);

  return (
    <button
      type="button"
      disabled={saliendo}
      onClick={() => {
        setSaliendo(true);
        void authClient.signOut().then(() => {
          router.push("/iniciar-sesion");
          router.refresh();
        });
      }}
      className="text-sm font-medium text-navy-700 underline underline-offset-4 transition hover:text-navy-900 disabled:opacity-60"
    >
      {saliendo ? "Cerrando sesión…" : "Cerrar sesión y entrar con otra cuenta"}
    </button>
  );
}
