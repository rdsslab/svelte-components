/**
 * Construye el modelo de solicitud a partir del estado actual de RESTTester.
 *
 * @param {{url?: string, method?: string, data?: Record<string, any>}} options
 * @returns {RestRequest}
 */
export function normalizeRequest({ url, method, data }?: {
    url?: string;
    method?: string;
    data?: Record<string, any>;
}): RestRequest;
/**
 * Devuelve los headers efectivos incluyendo `Authorization`.
 * Se usa para la tabla "Request Headers" y para inspeccionar la solicitud.
 *
 * @param {RestRequest} model
 * @param {'variables'|'literal'} [secrets]
 * @returns {{key: string, value: string}[]}
 */
export function getRequestHeaders(model: RestRequest, secrets?: "variables" | "literal"): {
    key: string;
    value: string;
}[];
/** Convierte la lista de headers a objeto para `fetch`/`uFetch`. */
export function toHeadersObject(model: any): {};
/**
 * Genera un archivo `.http` (sintaxis común a los clientes HTTP modernos).
 *
 * @param {RestRequest} model
 * @param {{secrets?: 'variables'|'literal'}} [options]
 * @returns {string}
 */
export function serializeHttp(model: RestRequest, { secrets }?: {
    secrets?: "variables" | "literal";
}): string;
/**
 * Genera un script `curl` para Linux/macOS.
 *
 * @param {RestRequest} model
 * @param {{secrets?: 'variables'|'literal'}} [options]
 * @returns {string}
 */
export function serializeCurlShell(model: RestRequest, { secrets }?: {
    secrets?: "variables" | "literal";
}): string;
/**
 * Genera un script PowerShell (System.Net.Http) para Windows.
 *
 * @param {RestRequest} model
 * @param {{secrets?: 'variables'|'literal'}} [options]
 * @returns {string}
 */
export function serializePowerShell(model: RestRequest, { secrets }?: {
    secrets?: "variables" | "literal";
}): string;
/**
 * Serializa una solicitud en el formato indicado.
 *
 * @param {RestRequest} model
 * @param {'http'|'curl'|'powershell'} format
 * @param {{secrets?: 'variables'|'literal'}} [options]
 * @returns {string}
 */
export function serializeRequest(model: RestRequest, format: "http" | "curl" | "powershell", options?: {
    secrets?: "variables" | "literal";
}): string;
/** Descarga un archivo generado en el navegador. */
export function downloadRequestFile(model: any, format: any, { secrets, baseName }?: {
    secrets?: string;
    baseName?: string;
}): string;
export namespace AUTH_TYPES {
    let NONE: number;
    let BASIC: number;
    let BEARER: number;
}
export namespace BODY_TYPES {
    let JSON: number;
    let XML: number;
    let TEXT: number;
    let FORM: number;
    let URLENCODED: number;
    let BINARY: number;
}
export const REST_EXPORT_FORMATS: {
    id: string;
    label: string;
    extension: string;
    mime: string;
}[];
export type RestField = {
    key: string;
    value: string;
    file: {
        name: string;
        size: number;
        type: string;
    } | null;
};
export type RestRequest = {
    method: string;
    /**
     * URL final, incluyendo el query string
     */
    url: string;
    query: {
        key: string;
        value: string;
    }[];
    /**
     * Headers efectivos (sin Authorization)
     */
    headers: {
        key: string;
        value: string;
    }[];
    auth: {
        type: "none" | "basic" | "bearer";
        username: string;
        password: string;
        token: string;
        configured: boolean;
    };
    body: {
        type: string;
        text: string | null;
        runtime: any;
        mime: string | null;
        fields: RestField[];
        hasFiles: boolean;
    };
    warnings: string[];
    notices: string[];
};
