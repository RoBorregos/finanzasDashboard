import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";

import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "RoBorregos · Finanzas",
  description:
    "Presupuesto y control financiero de RoBorregos, Tecnológico de Monterrey.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${geist.variable}`}>
      <body className="font-sans antialiased">
        <TRPCReactProvider>
          <header className="no-imprimir border-b border-navy-800 bg-navy-900 text-white">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
              <Link href="/" className="flex items-baseline gap-2">
                <span className="text-lg font-bold tracking-tight">
                  RoBorregos
                </span>
                <span className="text-sm text-oro-400">Finanzas</span>
              </Link>
              <nav className="flex items-center gap-1 text-sm">
                <Link
                  href="/"
                  className="rounded-lg px-3 py-1.5 text-white/80 transition hover:bg-white/10 hover:text-white"
                >
                  Dashboard
                </Link>
                <Link
                  href="/eventos/nuevo"
                  className="rounded-lg bg-white/10 px-3 py-1.5 font-medium transition hover:bg-white/20"
                >
                  Nuevo evento
                </Link>
              </nav>
            </div>
          </header>
          {children}
        </TRPCReactProvider>
      </body>
    </html>
  );
}
