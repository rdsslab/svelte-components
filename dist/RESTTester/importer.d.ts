/**
 * Separa un comando shell en tokens respetando comillas, continuaciones de línea
 * (`\` al final), sustituciones `$()` / `${}` y heredocs.
 *
 * @param {string} source
 * @returns {string[]}
 */
export function tokenizeShell(source: string): string[];
/** Analiza un literal de objeto o array JS a partir del inicio del texto. */
export function parseJsLiteral(text: any): any;
/**
 * Deduce el formato a partir del contenido y, si no es suficiente, de la
 * extensión del archivo (sirve para archivos escritos a mano o guardados como
 * `.txt`).
 *
 * @param {string} text
 * @param {string} [fileName]
 * @returns {'http'|'curl'|'powershell'|'fetch'|null}
 */
export function detectImportFormat(text: string, fileName?: string): "http" | "curl" | "powershell" | "fetch" | null;
/**
 * Parsea un archivo `.http`.
 *
 * @param {string} source
 * @param {{fileName?: string}} [options]
 */
export function parseHttpRequest(source: string, { fileName }?: {
    fileName?: string;
}): {
    method: string;
    url: string;
    data: object;
    warnings: string[];
    notices: string[];
};
/**
 * Parsea un comando `curl` (propio, DevTools, Postman, Swagger o escrito a mano).
 *
 * @param {string} source
 * @param {{fileName?: string}} [options]
 */
export function parseCurlRequest(source: string, { fileName }?: {
    fileName?: string;
}): {
    method: string;
    url: string;
    data: object;
    warnings: string[];
    notices: string[];
};
/**
 * Parsea un script de PowerShell: el generado por RESTTester,
 * `Invoke-RestMethod` e `Invoke-WebRequest`.
 *
 * @param {string} source
 * @param {{fileName?: string}} [options]
 */
export function parsePowerShellRequest(source: string, { fileName }?: {
    fileName?: string;
}): {
    method: string;
    url: string;
    data: object;
    warnings: string[];
    notices: string[];
};
/**
 * Parsea un fragmento `fetch(...)` o `axios(...)` (DevTools → "Copy as fetch",
 * ejemplos de Axios, etc.).
 *
 * @param {string} source
 * @param {{fileName?: string}} [options]
 */
export function parseFetchRequest(source: string, { fileName }?: {
    fileName?: string;
}): {
    method: string;
    url: string;
    data: object;
    warnings: string[];
    notices: string[];
};
/**
 * Convierte el texto de un archivo en el estado de RESTTester.
 *
 * @param {string} text Contenido completo del archivo.
 * @param {{fileName?: string, format?: 'http'|'curl'|'powershell'|'fetch'}} [options]
 * @returns {{format: string, fileName: string, method: string, url: string, data: object,
 *            name: string, warnings: string[], notices: string[]}}
 */
export function parseRequestFile(text: string, { fileName, format }?: {
    fileName?: string;
    format?: "http" | "curl" | "powershell" | "fetch";
}): {
    format: string;
    fileName: string;
    method: string;
    url: string;
    data: object;
    name: string;
    warnings: string[];
    notices: string[];
};
/** Formatos que el importador sabe leer (la UI usa `extensions` para el input). */
export const REST_IMPORT_FORMATS: {
    id: string;
    label: string;
    extensions: string[];
    mime: string;
}[];
/** Extensiones aceptadas por el input de archivo. */
export const REST_IMPORT_ACCEPT: string;
