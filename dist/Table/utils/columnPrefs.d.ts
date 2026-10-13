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
