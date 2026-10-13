/**
 * Persistencia en el navegador de las columnas que el usuario ocultó.
 *
 * Se guarda únicamente la lista de columnas OCULTAS por el usuario (nunca las
 * visibles): así, cuando el servidor añade una columna nueva, el merge de la
 * tabla la muestra por defecto en lugar de dejarla oculta para siempre.
 *
 * El acceso a `localStorage` va siempre protegido: en SSR (SvelteKit) no existe
 * y en modo privado o con políticas restrictivas puede lanzar al escribir.
 * Cualquier fallo se degrada a "sin preferencias guardadas" para no romper la
 * tabla.
 */

/** Prefijo de las claves para no colisionar con otras apps del mismo origen. */
const STORAGE_PREFIX = 'sc:table';
/** Versión del formato; permite migrar el esquema en el futuro. */
const STORAGE_VERSION = 1;

/**
 * Clave de `localStorage` para una tabla concreta.
 * @param {string} tableKey - Identificador estable de la tabla.
 * @returns {string}
 */
export function columnPreferencesKey(tableKey) {
	return `${STORAGE_PREFIX}:${tableKey}:columns:v${STORAGE_VERSION}`;
}

/**
 * Indica si `localStorage` está disponible y operable.
 * @returns {boolean}
 */
function storageAvailable() {
	try {
		return typeof localStorage !== 'undefined' && localStorage !== null;
	} catch {
		return false;
	}
}

/**
 * Lee las preferencias de columnas de una tabla.
 * @param {string} tableKey - Identificador estable de la tabla.
 * @returns {Record<string, true>} Mapa `{ nombreColumna: true }` con las columnas ocultas.
 */
export function loadColumnPreferences(tableKey) {
	if (!tableKey || !storageAvailable()) return {};

	try {
		const raw = localStorage.getItem(columnPreferencesKey(tableKey));
		if (!raw) return {};

		const parsed = JSON.parse(raw);
		if (!parsed || parsed.v !== STORAGE_VERSION || !Array.isArray(parsed.hidden)) {
			return {};
		}

		/** @type {Record<string, true>} */
		const hidden = {};
		for (const name of parsed.hidden) {
			if (typeof name === 'string' && name.length > 0) {
				hidden[name] = true;
			}
		}
		return hidden;
	} catch (error) {
		console.warn('[Table] No se pudieron leer las preferencias de columnas:', error);
		return {};
	}
}

/**
 * Guarda las preferencias de columnas de una tabla. Si no hay columnas ocultas
 * se elimina la entrada para no dejar basura.
 * @param {string} tableKey - Identificador estable de la tabla.
 * @param {Record<string, boolean>} hiddenMap - Mapa `{ nombreColumna: oculta }`.
 */
export function saveColumnPreferences(tableKey, hiddenMap) {
	if (!tableKey || !storageAvailable()) return;

	try {
		const hidden = Object.keys(hiddenMap || {}).filter((name) => hiddenMap[name] === true);

		if (hidden.length === 0) {
			localStorage.removeItem(columnPreferencesKey(tableKey));
			return;
		}

		localStorage.setItem(
			columnPreferencesKey(tableKey),
			JSON.stringify({ v: STORAGE_VERSION, hidden })
		);
	} catch (error) {
		console.warn('[Table] No se pudieron guardar las preferencias de columnas:', error);
	}
}

/**
 * Borra las preferencias de columnas de una tabla.
 * @param {string} tableKey - Identificador estable de la tabla.
 */
export function clearColumnPreferences(tableKey) {
	if (!tableKey || !storageAvailable()) return;

	try {
		localStorage.removeItem(columnPreferencesKey(tableKey));
	} catch (error) {
		console.warn('[Table] No se pudieron borrar las preferencias de columnas:', error);
	}
}
