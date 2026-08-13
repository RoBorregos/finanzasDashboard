# RoBorregos · Finanzas

Reemplaza `presupuesto_general_2026-2027.xlsm`. Mismo modelo mental que el
archivo de Excel —un evento por hoja, una hoja maestra que consolida— pero
colaborativo, auditable y sin macros que se rompan.

Este documento existe para que el equipo de finanzas **pueda confiar en los
números**: explica de dónde sale cada cifra y a qué fórmula del workbook
corresponde.

---

## 1. De dónde sale cada número

Ninguna cifra derivada se guarda en la base. Todas se calculan al momento de
consultarlas, con las funciones de [`src/server/finanzas/calc.ts`](src/server/finanzas/calc.ts).
Eso elimina de raíz el problema que tenía el archivo: que la hoja MAESTRA
mostrara cifras viejas porque alguien no volvió a correr la macro.

| En la app | En el workbook | Cómo se calcula |
|---|---|---|
| `movimiento.estimado` / `.real` | Columnas `Estimado`/`Real` de `Ingresos_<Evento>` y `Egresos_<Evento>` | `SUMIFS` sobre `Desglose` filtrando por `ID`. **Nunca se capturan.** |
| `movimiento.estatus` | Columna `Estatus` | `Pendiente` si no hay desglose, o si algún renglón tiene estimado o real vacío. Si no, `Completo`. |
| Fila de totales de cada tabla | Fila `SUM` bajo cada tabla | Suma de los movimientos del tipo. |
| `Diferencia` | `real / estimado - 1` | Igual, pero **si el estimado es cero da `—`**, no `#DIV/0!`. |
| `evento.ingresoEstimado`, `egresoReal`, etc. | Bloque de resumen `L6:N10` | Suma de los movimientos de cada tipo. |
| `evento.balanceEstimado` / `.balanceReal` | `Balance` del bloque de resumen | Ingresos − Egresos. |
| `evento.alcance*` / `.interacciones*` | Totales de `Marketing_<Evento>` | Suma de vistas e interacciones. |
| Badge de completitud | Celda `E12` (`Reporte Completo` / `Datos Faltantes`) | Los tres checks de abajo. |
| Tabla del dashboard global | `Tabla_Maestra` de la hoja MAESTRA | Agregación en vivo de todos los eventos del periodo. |
| Fila de gran total | Fila de totales de MAESTRA | Suma de todos los eventos. |

### Los tres checks de completitud

El workbook los tenía escondidos en las celdas `AA4`, `AB4` y `AC4` y solo
mostraba el veredicto final en `E12`. Aquí se devuelven por separado, así que la
pantalla dice **qué** falta, no nada más que falta algo:

| Check | Celda original | Qué verifica |
|---|---|---|
| `todosDesglosesLlenos` | `AA4` | Ningún renglón de desglose tiene estimado o real vacío |
| `todoEgresoTieneDesglose` | `AB4` | Todo egreso tiene al menos un renglón de desglose |
| `todoIngresoTieneDesglose` | `AC4` | Todo ingreso tiene al menos un renglón de desglose |

> **Diferencia deliberada con el Excel:** el primer check en el workbook es un
> `COUNTBLANK(...)=2` que tolera exactamente la fila vacía del final de la tabla.
> Aquí se implementó la intención correcta —cero renglones con huecos—, así que
> la app puede marcar `Datos faltantes` en un evento que el archivo daba por
> completo. Cuando eso pase, la app tiene razón.

---

## 2. Reglas que no se rompen

**El dinero solo se captura en el desglose.** Los montos de las filas de ingreso
y egreso son de solo lectura y se muestran con estilo distinto. Es exactamente
lo que hacía el `SUMIFS`: capturar ahí habría permitido que el padre y la suma
de sus partidas se contradijeran.

**El dinero es `numeric(12,2)`, nunca float.** El export del workbook trae
valores como `881.5999999999999` y `7516.799999999999` — artefactos de punto
flotante heredados de las fórmulas de Excel. Toda la aritmética de la app usa
`Decimal`, y los montos se redondean a centavos al guardarse.

> Consecuencia esperada: sumar renglones ya redondeados a centavos puede diferir
> por uno o dos centavos de sumar en precisión completa. Es lo correcto — un
> libro contable no guarda fracciones de centavo.

**La cuenta queda auditable.** Los usuarios piensan en *cantidad × precio
unitario*, a veces *× tipo de cambio* (los Motores de Larc_Open: 164.97 USD ×
17.14). El desglose guarda el monto resuelto **y** los tres insumos, así que
siempre se puede ver de dónde salió la cifra. Si capturas cantidad y precio, el
estimado se recalcula solo.

**Las fechas no se corren de día.** `inicio`, `fin` y `fecha` son fechas de
calendario, no instantes: se guardan como `date` y se formatean en UTC. Sin eso,
`2026-07-27` se vería como "26 jul" en la zona de México (UTC−6). Hay un test
que lo verifica, y la suite corre fijada a `America/Monterrey` para que la
regresión se detecte en cualquier máquina.

**División entre cero da `—`.** Nunca `Infinity`, `NaN` ni `#DIV/0!` (que hoy
aparece en varias hojas del archivo).

---

## 3. Modelo de datos

```
Periodo  (ejercicio fiscal: "2026-2027")   ← equivale a un archivo .xlsm
  └── Evento                               ← una hoja de evento
        ├── Movimiento (INGRESO | EGRESO)  ← una fila de Ingresos_/Egresos_
        │     └── Desglose                 ← Desglose_<Evento>: aquí y solo aquí se captura dinero
        └── MarketingItem                  ← Marketing_<Evento>, plano
```

Borrar en cascada: borrar un evento se lleva sus movimientos, su desglose y su
marketing. Borrar un movimiento se lleva su desglose.

Códigos (`ING-01`, `EGR-03`, `ING-01-002`, `MKT-01`) son únicos dentro de su
ámbito y se autosugieren a partir del **máximo existente**, no del conteo: borrar
un renglón no reasigna un código que ya pudo haberse impreso en un reporte.

---

## 4. Permisos

| Rol | Puede |
|---|---|
| `ADMIN` | Todo: ver y capturar |
| `MIEMBRO` | Solo ver cifras |
| `EXTERNO` | Nada. Es el rol por defecto de todo registro nuevo |

Las reglas viven en un solo lugar, [`src/server/auth/permissions.ts`](src/server/auth/permissions.ts).
Toda lectura de dinero pasa por `memberProcedure`; toda escritura, por
`adminProcedure`. Un rol desconocido se trata como `EXTERNO`: **el sistema falla
cerrado, no abierto.**

El middleware de Next solo revisa si existe la cookie de sesión — corre en el
edge, donde no hay base de datos. La autorización real vive en las procedures de
tRPC y en `requiereMiembro()`. Una cookie presente no prueba nada.

### Asignar roles

Todavía no hay pantalla de administración (queda fuera de alcance por ahora).
Desde la terminal:

```bash
npm run rol                                    # lista usuarios y sus roles
npm run rol -- alguien@ejemplo.com ADMIN       # promueve
```

El usuario debe haberse registrado antes en la app.

### Seguridad de la base

Las tablas viven en el schema `public`, que Supabase expone por su Data API
(PostgREST) con la llave anónima, que es pública por diseño. Sin protección,
cualquiera con esa llave leería el presupuesto completo rodeando los permisos de
la app.

Por eso la migración inicial habilita **RLS sin ninguna política** en todas las
tablas: PostgREST queda negando todo, y Prisma no se ve afectado porque conecta
como `postgres`, dueño de las tablas. No se usa `FORCE ROW LEVEL SECURITY`, que
también le aplicaría RLS al dueño y dejaría la app sin acceso.

> **Al agregar tablas nuevas**, repite en su migración:
> ```sql
> ALTER TABLE "NuevaTabla" ENABLE ROW LEVEL SECURITY;
> REVOKE ALL ON "NuevaTabla" FROM anon, authenticated;
> ```

---

## 5. Puesta en marcha

```bash
npm install
cp .env.example .env       # y llena las dos cadenas de Supabase
npm run db:migrate         # aplica migraciones
npm run db:seed            # importa seed-presupuesto.json
npm run dev
```

`.env` necesita **dos** cadenas de conexión, del dashboard de Supabase en
*Project Settings → Database → Connection string → pestaña ORMs*:

- `DATABASE_URL` — pooled, puerto **6543**, con `pgbouncer=true`. La usa la app.
- `DIRECT_URL` — directa, puerto **5432**. Solo la usan las migraciones, porque
  PgBouncer en modo transacción no soporta ese DDL.

Al desplegar (Vercel u otro serverless), agrega `connection_limit=1` a
`DATABASE_URL` y define `BETTER_AUTH_URL` con la URL pública, o los callbacks de
OAuth fallan.

> `start-database.sh` quedó obsoleto: era para levantar Postgres local en Docker,
> antes de mover la base a Supabase.

### Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run test` | Suite de vitest sobre `calc.ts` y el formateo |
| `npm run check` | Lint + typecheck |
| `npm run db:seed` | Reimporta el presupuesto (idempotente) |
| `npm run db:studio` | Explorador de la base |
| `npm run rol` | Lista o asigna roles |

---

## 6. Notas sobre el import del workbook

`seed-presupuesto.json` es un export del archivo original. Al importarlo salieron
dos cosas que conviene tener presentes:

**Subcódigos repetidos.** En RoBorregos Day, Tech Talks, Evento Networking y
Candidates había dos renglones distintos con el mismo subcódigo (`ING-02-001`
para "Donativo empresa comida" **y** para "…bebida", cada uno con su monto). Son
partidas reales, así que el seeder las **renumera** en vez de descartarlas —
descartarlas habría borrado presupuesto. Cada caso se reporta como aviso al
sembrar.

**Los totales de MAESTRA no cuadran con las hojas.** El archivo original afirma
en su hoja maestra un ingreso real de $2,000 para los 16 eventos, pero solo
RoboCamp ya tiene $79,952 capturados en su desglose. La causa es justamente el
problema que este proyecto resuelve: MAESTRA era un *snapshot* de la macro
`Actualizar_Maestra` y se quedaba viejo en cuanto alguien editaba una hoja sin
volver a correrla. La app agrega en vivo, así que ese desfase ya no puede
ocurrir.

---

## 7. Qué quedó fuera

Sin organizaciones múltiples, sin subida de comprobantes, sin flujo de
aprobación, sin notificaciones por correo, sin colaboración en tiempo real
(revalidación normal), sin UI de importación de Excel.

Los puntos donde falta trabajo de autenticación están marcados con `TODO(auth)`
en el código: registro, invitaciones y pantalla de gestión de roles.
