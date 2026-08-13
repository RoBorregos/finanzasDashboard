import Decimal from "decimal.js";
import SuperJSON from "superjson";

/**
 * superjson no sabe serializar Decimal: sin esto, todo campo de dinero llega al
 * cliente como `{}`. Registramos un transformer sobre el singleton de superjson
 * y TODOS los puntos de entrada importan desde aquí en vez de "superjson", para
 * garantizar que el registro corra antes del primer serialize/deserialize.
 *
 * Ojo con `isApplicable`: Prisma trae su propia copia de decimal.js, así que
 * `prismaDecimal instanceof Decimal` es FALSE. `Decimal.isDecimal()` sí lo
 * detecta (compara el toStringTag `[object Decimal]`), y por eso se usa esa.
 *
 * Del lado del cliente los valores se rehidratan como Decimal de decimal.js
 * —no de Prisma—, que es justo lo que necesita la UI para formatear.
 */
SuperJSON.registerCustom<Decimal, string>(
  {
    isApplicable: (v): v is Decimal => Decimal.isDecimal(v),
    serialize: (v) => v.toString(),
    deserialize: (v) => new Decimal(v),
  },
  "decimal.js",
);

export default SuperJSON;
