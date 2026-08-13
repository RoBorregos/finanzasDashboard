# Build: RoBorregos Finance Web App (replaces `presupuesto_general_2026-2027.xlsm`)

You are working inside an existing T3 stack scaffold (Next.js App Router + TypeScript + tRPC + Prisma + Tailwind + NextAuth). Do not re-scaffold. Build the feature described below on top of it.

## 1. Context

RoBorregos (a student robotics team at Tec de Monterrey) currently tracks its whole annual budget in a single macro-enabled Excel workbook. One sheet per event, plus a master sheet that rolls everything up. It works but only one person can edit it, the macros break easily, and nobody else can see the numbers.

Goal: a collaborative web app with the same mental model. A global dashboard, a dashboard per event, and forms to create events and enter/update `estimado` vs `real` for income, expenses, and marketing.

**Everything below is a faithful description of the existing workbook. Match its semantics, not its cell layout.**

## 2. The current workbook, in detail

### 2.1 Structure

- 1 `MAESTRA` sheet: a roll-up table (`Tabla_Maestra`) with one row per event, plus a grand-total row.
- 16 event sheets, one per event: `Recolecta_Basura_Electronica`, `Taller Impresiones 3D`, `Taller CNC cortadora laser`, `Hackdays`, `RoBorregos Day`, `TechTalks`, `Evento networking`, `Candidates`, `RoboCamp`, `RoboRifa`, `Home`, `Larc_Open`, `Larc_VSSS`, `RCJ_Maze`, `RCJ_Soccer_Vision`, `RCJ_Soccer_Infrarred`.
- Every event sheet has the identical layout: a header block, then 4 Excel tables named after the event (`Ingresos_<Evento>`, `Egresos_<Evento>`, `Desglose_<Evento>`, `Marketing_<Evento>`).

### 2.2 Event header block (cells `B6:J9`, per sheet)

| Excel cell | Label | Meaning | Example |
|---|---|---|---|
| `D6` | Nombre del evento | Event name (also drives table renaming via macro) | `RoboCamp` |
| `D7` | Categoría del evento | Enum, free text today | `Proyecto con recaudación`, `Proyecto sin recaudación`, `Competencia` |
| `H6` | Inicio | Start date | `2026-07-27` |
| `J6` | Fin | End date | `2026-08-07` |
| `H7` | Lugar | Venue | `Tec de Monterrey` |
| `H8` | Responsable | Person accountable | `Hans Enrique Velarde Barrón` |
| `H9` | Impactos directos | Direct headcount reached | `51` |

Note: `Proyecto con recaudación` vs `Proyecto con Recaudación` both appear. Normalize to a single enum value.

### 2.3 `Ingresos_<Evento>` (income lines assigned to the event)

Columns: `ID`, `Fuente o Patrocinador`, `Concepto`, `Estimado`, `Real`, `Fecha de Recepción`, `Estatus`.

- `ID` is a per-event human code: `ING-01`, `ING-02`, ...
- `Fuente o Patrocinador` example values: `Cuota de Alumnos`, `Patrocinio`, `Fondo Roborregos`, `Aproximación`.
- **`Estimado` and `Real` are NOT typed here.** They are `SUMIFS` over the `Desglose` table matching on `ID`. They are derived values.
- `Estatus` is derived: `""` if no ID; `Pendiente` if zero breakdown rows carry this ID, or if any matching breakdown row is missing `Estimado`/`Real`; otherwise `Completo`.
- A totals row below the table: `SUM(Estimado)`, `SUM(Real)`, and `Diferencia` = `real / estimado - 1` (variance %).

### 2.4 `Egresos_<Evento>` (expenses)

Identical shape to Ingresos. Columns: `ID` (`EGR-01`, `EGR-02`, ...), `Fuente o Patrocinador` (who funds it, e.g. `Fondo Roborregos`), `Concepto`, `Estimado` (derived), `Real` (derived), `Fecha de Compra`, `Estatus` (derived). Same totals row and variance.

### 2.5 `Desglose_<Evento>` (line-item breakdown, THE actual data entry surface)

Columns: `ID`, `SubID`, `Concepto`, `Estimado`, `Real`.

- `ID` is the foreign key back to an Ingresos or Egresos row (`ING-01`, `EGR-02`, ...). Both income and expense breakdowns live in this one table.
- `SubID` is `<ID>-001`, `<ID>-002`, ...
- `Estimado`/`Real` are the only hand-entered money values in the whole workbook. Real examples:
  - `ING-01-001` "Inscripción Completa": estimado `=7*4000` = 28000, real `=9*4000` = 36000
  - `ING-01-003` "Inscripción Completa Descuento Colaborador": `=5*(4000*(1-0.15))` = 17000
  - `EGR-01-001` "Piezas De Módulo Esp8266...": 1577.68
  - `EGR-01-003` "Motores" (Larc_Open): real `=164.97*17.14` (USD price times FX rate)
- Takeaway: users think in `quantity × unit price`, sometimes `× FX rate`. Support this (see §4).
- Breakdown rows can exist for an `ID` that has no parent row yet (data-entry drift). Handle gracefully, surface as a warning.

### 2.6 `Marketing_<Evento>`

Columns: `ID` (`MKT-01`, ...), `Red Social` (today always `Instagram`), `Concepto` (`Primer reel`, `Tercera Historia`, ...), `Vistas Estimado`, `Vistas Real`, `Interaccion Estimado`, `Interaccion Real`. Flat, no breakdown. Totals row plus variance % for views and interactions.

### 2.7 Event summary block (`L6:N10`) and completeness flag (`E12`)

- `Ingresos` = SUM of the Ingresos table, Aproximado and Real columns.
- `Egresos` = SUM of the Egresos table.
- `Balance` = Ingresos − Egresos, for both Aproximado and Real.
- `E12` shows `Reporte Completo` / `Datos Faltantes`, computed from three hidden checks:
  1. `AA4`: every breakdown row has both `Estimado` and `Real` filled.
  2. `AB4`: every `Egresos` ID has at least one matching breakdown row.
  3. `AC4`: every `Ingresos` ID has at least one matching breakdown row.

  (The Excel version of check 1 is a sloppy `COUNTBLANK(...)=2` that tolerates exactly the one always-empty trailing row. Implement the correct intent: zero breakdown rows with a null `estimado` or `real`.)

### 2.8 `MAESTRA` roll-up

Table `Tabla_Maestra`, one row per event, columns:

`Evento`, `Ingreso Aproximado`, `Egreso Aproximado`, `Balance aproximado` (= difference), `Ingreso Real`, `Egreso Real`, `Balance Real`, `Alcance Aproximado`, `Alcance Real`, `Interacciones Aproximado`, `Interacciones Real`.

Alcance = marketing views total; Interacciones = marketing interactions total. Plus a grand total row (current file: ingreso aprox 510,283.20; egreso aprox 459,139.21; balance aprox 51,143.99; ingreso real 2,000; egreso real 34,356.93; alcance aprox 112,170; alcance real 41,041).

Today this sheet is refreshed by a macro (`Actualizar_Maestra`). **In the web app it must be a live query, never a stored copy.**

### 2.9 VBA macros (what they do and what happens to them)

| Macro | Purpose | Fate in web app |
|---|---|---|
| `Estado_De_Cuenta_Ver` / `Estado_De_Cuenta_PDF` | Builds a corporate "account statement" sheet per event (letterhead: `ROBORREGOS | TECNOLOGICO DE MONTERREY`, finance director name/email, MXN, navy + gold palette, income section, expense section, marketing section, variance %) and exports to PDF | Keep as a feature: per-event printable statement / PDF export |
| `Actualizar_Maestra` | Recomputes MAESTRA from every event sheet | Gone, replaced by live aggregation |
| `Renombrar_Tablas_Del_Evento` | Renames the 4 tables when `D6` changes | Gone, irrelevant |
| `AsegurarFilaLibre` | Keeps a blank row at the end of each table | Gone, replaced by an "add row" button |

## 3. What to build

### Pages (App Router)

1. `/` global dashboard: the MAESTRA equivalent. KPI cards (ingreso estimado vs real, egreso estimado vs real, balance, alcance, interacciones), a sortable table of all events with per-event balance and completeness badge, and charts (estimado vs real per event, balance by category, budget burn).
2. `/eventos/nuevo` create-event form (the header block fields).
3. `/eventos/[id]` event dashboard: header block (inline editable by admins), summary cards (ingresos/egresos/balance, aproximado vs real, variance %), completeness badge with the specific reasons it is failing, then the four tables.
4. `/eventos/[id]/editar` or inline editing, your call, but editing must feel like a spreadsheet: click a cell, type, save on blur, optimistic update.
5. `/eventos/[id]/estado-de-cuenta` printable account statement (print CSS + "Download PDF" via the browser print dialog is fine for v1).

### Table UX requirements

- Income and expense tables render as parent rows with expandable breakdown (`Desglose`) child rows.
- Parent `Estimado`/`Real` cells are **read-only and derived**, shown with a subtle "calculated" style. All money entry happens on breakdown rows.
- Each parent shows its derived `Estatus` badge (`Completo` / `Pendiente`).
- "Add income line" / "Add expense line" auto-suggests the next code (`ING-03`, `EGR-05`). "Add breakdown" auto-suggests `<ID>-00N`.
- Marketing table is flat, editable inline.
- Every money value formatted MXN: `$1,234.56`. Variance shown as a signed percentage with green/red.

## 4. Data model (Prisma)

Use `Decimal @db.Decimal(12,2)` for money, never floats. Configure superjson so Decimal survives tRPC serialization.

```prisma
enum Role {
  ADMIN      // full write
  MIEMBRO    // accepted member: read financials
  EXTERNO    // outsider: no access
}

enum CategoriaEvento {
  PROYECTO_CON_RECAUDACION
  PROYECTO_SIN_RECAUDACION
  COMPETENCIA
}

enum TipoMovimiento {
  INGRESO
  EGRESO
}

model Periodo {           // fiscal year, e.g. "2026-2027"
  id        String   @id @default(cuid())
  nombre    String   @unique
  activo    Boolean  @default(false)
  eventos   Evento[]
}

model Evento {
  id               String          @id @default(cuid())
  periodoId        String
  periodo          Periodo         @relation(fields: [periodoId], references: [id])
  nombre           String
  slug             String
  categoria        CategoriaEvento
  inicio           DateTime
  fin              DateTime
  lugar            String?
  responsable      String?         // free text for now; later a User relation
  impactosDirectos Int             @default(0)
  movimientos      Movimiento[]
  marketing        MarketingItem[]
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt
  @@unique([periodoId, slug])
}

model Movimiento {         // one row of Ingresos_<Evento> or Egresos_<Evento>
  id        String         @id @default(cuid())
  eventoId  String
  evento    Evento         @relation(fields: [eventoId], references: [id], onDelete: Cascade)
  tipo      TipoMovimiento
  codigo    String         // "ING-01" / "EGR-03"
  fuente    String?        // Fuente o Patrocinador
  concepto  String
  fecha     DateTime?      // Fecha de Recepción (ingreso) / Fecha de Compra (egreso)
  desglose  Desglose[]
  @@unique([eventoId, codigo])
}

model Desglose {
  id           String     @id @default(cuid())
  movimientoId String
  movimiento   Movimiento @relation(fields: [movimientoId], references: [id], onDelete: Cascade)
  subCodigo    String     // "ING-01-002"
  concepto     String
  // money: store the resolved amount, keep the inputs so the math is auditable
  estimado     Decimal?   @db.Decimal(12,2)
  real         Decimal?   @db.Decimal(12,2)
  cantidad     Decimal?   @db.Decimal(12,3)  // optional: quantity
  precioUnit   Decimal?   @db.Decimal(12,2)  // optional: unit price
  tipoCambio   Decimal?   @db.Decimal(12,4)  // optional: FX rate for USD purchases
  nota         String?
  @@unique([movimientoId, subCodigo])
}

model MarketingItem {
  id                  String @id @default(cuid())
  eventoId            String
  evento              Evento @relation(fields: [eventoId], references: [id], onDelete: Cascade)
  codigo              String // "MKT-01"
  redSocial           String // Instagram, TikTok, LinkedIn...
  concepto            String
  vistasEstimado      Int?
  vistasReal          Int?
  interaccionEstimado Int?
  interaccionReal     Int?
  @@unique([eventoId, codigo])
}
```

Keep the existing NextAuth `User`/`Account`/`Session` models and add `role Role @default(EXTERNO)` to `User`.

## 5. Derived values (single source of truth, server side)

Put these in `src/server/finanzas/calc.ts`, pure functions over the fetched rows, and reuse everywhere (dashboards, statement, CSV export). Never duplicate this logic in components.

```
movimiento.estimado        = sum(desglose.estimado)
movimiento.real            = sum(desglose.real)
movimiento.estatus         = desglose.length === 0            -> "Pendiente"
                           : desglose.some(d => d.estimado == null || d.real == null) -> "Pendiente"
                           : "Completo"

evento.ingresoEstimado     = sum of movimientos where tipo=INGRESO
evento.ingresoReal, evento.egresoEstimado, evento.egresoReal likewise
evento.balanceEstimado     = ingresoEstimado - egresoEstimado
evento.balanceReal         = ingresoReal - egresoReal
evento.varianzaIngreso     = ingresoReal / ingresoEstimado - 1   (null when estimado = 0)
evento.alcanceEstimado     = sum(marketing.vistasEstimado)        // "Alcance"
evento.alcanceReal, evento.interaccionesEstimado, evento.interaccionesReal likewise

evento.completo            = todosDesglosesLlenos && todoIngresoTieneDesglose && todoEgresoTieneDesglose
                             // return the three booleans, not just the AND, so the UI can say WHY

periodo totals             = sum over all eventos of each field above
```

Division by zero must yield `null` and render as `—`, never `Infinity` or `#DIV/0!` (the workbook currently shows `#DIV/0!` on several sheets).

## 6. tRPC routers

- `evento`: `list` (with computed totals, filterable by periodo/categoria), `byId`, `create`, `update`, `delete`.
- `movimiento`: `create`, `update`, `delete`, `nextCodigo({ eventoId, tipo })`.
- `desglose`: `create`, `update`, `delete`, `nextSubCodigo({ movimientoId })`.
- `marketing`: `create`, `update`, `delete`.
- `dashboard`: `resumenGlobal({ periodoId })` returning the MAESTRA equivalent plus grand totals.
- `export`: `csv({ eventoId })` and `estadoDeCuenta({ eventoId })`.

Validate everything with zod. Money inputs accept a string and parse to Decimal, tolerating `$`, commas, and spaces.

## 7. Auth and permissions (stub now, wired later)

I am handling the actual auth flow separately. For now:

- Add `role` to `User` and to the session callback.
- Create three tRPC procedure helpers in `src/server/api/trpc.ts`: `publicProcedure` (existing), `memberProcedure` (requires session and role in `[ADMIN, MIEMBRO]`), `adminProcedure` (requires `ADMIN`).
- All read queries about money go through `memberProcedure`. All mutations go through `adminProcedure`.
- Middleware: unauthenticated or `EXTERNO` users get a "sin acceso" page, they must not see any figures.
- Add a `src/server/auth/permissions.ts` with a single `can(user, action)` helper so the rules live in one place and I can extend it.
- Do not build sign-up, invites, or role management UI. Leave a `TODO(auth)` comment where they belong.

## 8. Seed

`seed-presupuesto.json` (next to this prompt) is a full export of the real workbook: 16 events with their income lines, expense lines, breakdowns, and marketing rows for period 2026-2027. Write `prisma/seed.ts` to import it. Shape:

```jsonc
{
  "periodo": "2026-2027",
  "moneda": "MXN",
  "eventos": [
    {
      "sheet": "RoboCamp",
      "nombre": "RoboCamp",
      "categoria": "Proyecto con recaudación",
      "inicio": "2026-07-27", "fin": "2026-08-07",
      "lugar": "Tec de Monterrey",
      "responsable": "Hans Enrique Velarde Barrón",
      "impactosDirectos": 51,
      "ingresos":  [{ "codigo": "ING-01", "fuente": "Cuota de Alumnos", "concepto": "Aportación por alumno", "fecha": "2026-07-27" }],
      "egresos":   [{ "codigo": "EGR-01", "fuente": "Fondo Roborregos", "concepto": "Componentes Semana 1", "fecha": null }],
      "desglose":  [{ "codigo": "ING-01", "subCodigo": "ING-01-001", "concepto": "Inscripción Completa", "estimado": 28000, "real": 36000 }],
      "marketing": [{ "codigo": "MKT-01", "redSocial": "Instagram", "concepto": "Primer reel", "vistasEstimado": 2000, "vistasReal": 3094, "interaccionEstimado": 1000, "interaccionReal": 1468 }]
    }
  ]
}
```

Seeder notes: map `categoria` strings to the enum case-insensitively; attach each `desglose` row to the `Movimiento` with the matching `codigo` in the same event; if no parent exists, log a warning and skip that row (this happens in a couple of sheets); dates are `YYYY-MM-DD` or null.

After seeding, `/` must reproduce the MAESTRA grand totals listed in §2.8. Treat that as the acceptance test.

## 9. Non-goals for this pass

No multi-tenant orgs, no receipts/file uploads, no approval workflow, no email notifications, no real-time collaboration (plain revalidation is fine), no Excel import UI, no mobile-specific layout beyond responsive Tailwind.

## 10. Deliverables

1. Updated `prisma/schema.prisma` + a migration.
2. `prisma/seed.ts` + the JSON wired into `package.json`.
3. `src/server/finanzas/calc.ts` with unit tests (vitest) covering: derived totals, `Estatus`, the three completeness checks, division by zero, and the RoboCamp numbers from the real data.
4. tRPC routers per §6.
5. The pages per §3, in Spanish, MXN formatted.
6. A short `README-finanzas.md` explaining the model and how the derived values map back to the old spreadsheet, so the finance team can trust it.

Work in that order. Run the seed and the tests before telling me it is done.
