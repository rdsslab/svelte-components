/**
 * Clave de `localStorage` para una tabla concreta.
 * @param {string} tableKey - Identificador estable de la tabla.
 * @returns {string}
 */
export function columnPreferencesKey(tableKey: string): string;
/**
 * Lee las preferencias de columnas de una tabla.
 * @param {string} tableKey - Identificador estable de la tabla.
 * @returns {Record<string, true>} Mapa `{ nombreColumna: true }` con las columnas ocultas.
 */
export function loadColumnPreferences(tableKey: string): Record<string, true>;
/**
 * Guarda las preferencias de columnas de una tabla. Si no hay columnas ocultas
 * se elimina la entrada para no dejar basura.
 * @param {string} tableKey - Identificador estable de la tabla.
 * @param {Record<string, boolean>} hiddenMap - Mapa `{ nombreColumna: oculta }`.
 */
export function saveColumnPreferences(tableKey: string, hiddenMap: Record<string, boolean>): void;
/**
 * Borra las preferencias de columnas de una tabla.
 * @param {string} tableKey - Identificador estable de la tabla.
 */
export function clearColumnPreferences(tableKey: string): void;
/**
 * Construye una clave automática y estable para una tabla que no recibió
 * `storageKey`. Se apoya en la ruta actual y en la firma de sus columnas, de
 * modo que dos tablas con columnas distintas obtengan claves distintas.
 *
 * Límite conocido: dos tablas con la MISMA firma de columnas y en la misma
 * ruta comparten clave. En ese caso conviene definir `storageKey` explícito
 * (el registro de claves activas avisa por consola de la colisión).
 *
 * @param {string} path - Ruta de la página (p.ej. `location.pathname`).
 * @param {Iterable<string>} columnNames - Nombres de las columnas.
 * @returns {string} Clave de tabla con el prefijo `auto:`.
 */
export function autoColumnPreferencesKey(path: string, columnNames: Iterable<string>): string;
/**
 * Registra una clave activa y avisa si otra tabla ya la está usando. En una
 * misma pestaña el evento `storage` no se dispara, así que dos tablas con la
 * misma clave se pisarían silenciosamente; este aviso lo hace visible.
 * @param {string} tableKey
 */
export function registerActiveColumnPreferencesKey(tableKey: string): void;
/**
 * Libera una clave registrada al desmontar la tabla.
 * @param {string} tableKey
 */
export function unregisterActiveColumnPreferencesKey(tableKey: string): void;
