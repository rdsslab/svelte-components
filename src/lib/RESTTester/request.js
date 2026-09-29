/**
 * Núcleo de construcción y exportación de solicitudes HTTP para RESTTester.
 *
 * No depende del DOM (salvo el runtime del body) para poder usarse tanto desde el
 * componente Svelte como desde Node.js (tests, SSR o integraciones).
 *
 * Formatos soportados:
 *  - `http`       -> archivo `.http` (REST Client / JetBrains HTTP Client / httpyac)
 *  - `curl`       -> script `curl` para Linux/macOS (`.sh`)
 *  - `powershell` -> script PowerShell para Windows (`.ps1`, System.Net.Http)
 */

export const AUTH_TYPES = { NONE: 0, BASIC: 1, BEARER: 2 };
export const BODY_TYPES = { JSON: 0, XML: 1, TEXT: 2, FORM: 3, URLENCODED: 4, BINARY: 5 };

/** Métodos que nunca deben llevar body (fetch lo prohíbe en el navegador). */
const METHODS_WITHOUT_BODY = new Set(['GET', 'HEAD', 'OPTIONS', 'CONNECT', 'TRACE']);

const MIME_JSON = 'application/json';
const MIME_URLENCODED = 'application/x-www-form-urlencoded;charset=UTF-8';
const MIME_MULTIPART = 'multipart/form-data';

/**
 * @typedef {Object} RestField
 * @property {string} key
 * @property {string} value
 * @property {{name: string, size: number, type: string} | null} file
 */

/**
 * @typedef {Object} RestRequest
 * @property {string} method
 * @property {string} url  URL final, incluyendo el query string
 * @property {string} base  Base con la que se resolvió la URL (vacía si no hizo falta)
 * @property {boolean} resolved  true si la URL del campo era relativa y se absolutizó
 * @property {{key: string, value: string}[]} query
 * @property {{key: string, value: string}[]} headers  Headers efectivos (sin Authorization)
 * @property {{type: 'none'|'basic'|'bearer', username: string, password: string, token: string, configured: boolean}} auth
 * @property {{type: string, text: string|null, runtime: any, mime: string|null, fields: RestField[], hasFiles: boolean}} body
 * @property {string[]} warnings
 * @property {string[]} notices
 */

/* -------------------------------------------------------------------------- */
/* Utilidades internas                                                          */
/* -------------------------------------------------------------------------- */

function toRows(source) {
	return Array.isArray(source) ? source : [];
}

/** Sólo filas habilitadas y con clave (misma semántica que el envío actual). */
function readEnabledRows(source) {
	return toRows(source)
		.filter((row) => row && row.enabled && typeof row.key === 'string' && row.key !== '')
		.map((row) => ({ key: row.key, value: row.value == null ? '' : String(row.value) }));
}

/** ¿El valor parece un FileList / array-like de archivos? (SSR safe, sin usar `File`). */
function isFileListLike(value) {
	return !!value && typeof value === 'object' && typeof value.length === 'number';
}

/** Un archivo sólo es enviable si es un Blob/File real (nunca en SSR o Node). */
function isBlobLike(value) {
	return !!value && typeof Blob !== 'undefined' && value instanceof Blob;
}

function readFileInfo(value) {
	const candidate = isFileListLike(value) ? value[0] : value;
	if (
		candidate &&
		typeof candidate === 'object' &&
		typeof candidate.name === 'string' &&
		typeof candidate.size === 'number'
	) {
		return {
			name: candidate.name,
			size: candidate.size,
			type: candidate.type || 'application/octet-stream'
		};
	}
	return null;
}

function readFormFields(source) {
	return toRows(source)
		.filter((row) => row && row.enabled && typeof row.key === 'string' && row.key !== '')
		.map((row) => {
			const file = isFileListLike(row.value) ? readFileInfo(row.value) : null;
			return {
				key: row.key,
				value: isFileListLike(row.value) ? '' : row.value == null ? '' : String(row.value),
				enabled: true,
				file,
				rawValue: row.value
			};
		});
}

/** Combina headers respetando la semántica de `Headers` (case-insensitive, duplicados unidos). */
function normalizeHeaderRows(source) {
	const order = [];
	const map = new Map();

	for (const row of readEnabledRows(source)) {
		if (row.key.toLowerCase() === 'content-length') continue; // uFetch lo elimina siempre
		const name = row.key.toLowerCase();
		if (map.has(name)) {
			map.set(name, `${map.get(name)}, ${row.value}`);
		} else {
			order.push(row.key);
			map.set(name, row.value);
		}
	}

	return order.map((key) => ({ key, value: map.get(key.toLowerCase()) }));
}

function findHeader(headers, name) {
	const target = name.toLowerCase();
	return headers.find((header) => header.key.toLowerCase() === target);
}

function removeHeader(headers, name) {
	const target = name.toLowerCase();
	return headers.filter((header) => header.key.toLowerCase() !== target);
}

function headersToObject(headers) {
	const result = {};
	for (const header of headers) result[header.key] = header.value;
	return result;
}

/**
 * ¿La URL ya trae su propio host/esquema? Un `//host/x` cuenta como absoluta porque
 * `new URL` la resolvería igual, pero sin base no se puede materializar.
 *
 * @param {string} url
 * @returns {boolean}
 */
export function isAbsoluteUrl(url) {
	const value = String(url ?? '').trim();
	if (value === '') return false;
	if (value.startsWith('//')) return false;
	return /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(value);
}

/**
 * Resuelve la URL del campo contra una base. El navegador resuelve las rutas relativas
 * contra el documento (`fetch('/api/x')`), pero un `.sh` / `.http` / `.ps1` se ejecuta
 * sin ninguna base, así que hay que escribir el host en el archivo.
 *
 * @param {string} url
 * @param {string} [base]  Origen o `document.baseURI`; vacío = no se puede resolver.
 * @returns {{url: string, base: string, resolved: boolean}}
 */
export function resolveUrlAgainstBase(url, base = '') {
	const value = String(url ?? '').trim();
	const baseValue = String(base ?? '').trim();

	if (value === '' || isAbsoluteUrl(value)) return { url: value, base: baseValue, resolved: false };
	if (baseValue === '') return { url: value, base: '', resolved: false };

	try {
		return { url: new URL(value, baseValue).toString(), base: baseValue, resolved: true };
	} catch {
		// Base inválida: mejor dejar la ruta como estaba que romper la exportación.
		return { url: value, base: '', resolved: false };
	}
}

function buildFinalUrl(url, params) {
	let finalUrl = url || '';
	if (params.length === 0) return finalUrl;

	const search = new URLSearchParams();
	for (const param of params) search.append(param.key, param.value);
	const queryString = search.toString();
	if (!queryString) return finalUrl;

	const hashIndex = finalUrl.indexOf('#');
	const hash = hashIndex !== -1 ? finalUrl.substring(hashIndex) : '';
	const urlWithoutHash = hashIndex !== -1 ? finalUrl.substring(0, hashIndex) : finalUrl;
	const separator = urlWithoutHash.includes('?') ? '&' : '?';

	return `${urlWithoutHash}${separator}${queryString}${hash}`;
}

function base64Utf8(value) {
	if (typeof Buffer !== 'undefined') return Buffer.from(value, 'utf8').toString('base64');
	if (typeof TextEncoder !== 'undefined' && typeof btoa === 'function') {
		const bytes = new TextEncoder().encode(value);
		let binary = '';
		for (const byte of bytes) binary += String.fromCharCode(byte);
		return btoa(binary);
	}
	return value;
}

function readAuth(source) {
	const auth = source?.auth || {};
	const selection = Number(auth.selection);

	if (selection === AUTH_TYPES.BASIC) {
		const username = auth.basic?.username == null ? '' : String(auth.basic.username);
		const password = auth.basic?.password == null ? '' : String(auth.basic.password);
		return {
			type: 'basic',
			username,
			password,
			token: '',
			// uFetch sólo inyecta Basic si ambos valores están presentes.
			configured: username !== '' && password !== ''
		};
	}

	if (selection === AUTH_TYPES.BEARER) {
		const token = auth.bearer?.token == null ? '' : String(auth.bearer.token);
		return { type: 'bearer', username: '', password: '', token, configured: token !== '' };
	}

	return { type: 'none', username: '', password: '', token: '', configured: false };
}

function buildRuntimeFormData(fields) {
	if (typeof FormData === 'undefined') return undefined;
	const formData = new FormData();
	for (const field of fields) {
		const raw = field.rawValue;
		if (isFileListLike(raw)) {
			for (let index = 0; index < raw.length; index++) {
				const item = raw[index];
				if (item == null) continue;
				// Sólo un Blob/File real puede subirse como archivo (SSR / Node no lo son).
				if (isBlobLike(item)) formData.append(field.key, item, item.name);
				else formData.append(field.key, String(item.name ?? item));
			}
		} else if (isBlobLike(raw)) {
			formData.append(field.key, raw, field.file?.name ?? raw.name);
		} else {
			formData.append(field.key, field.value);
		}
	}
	return formData;
}

/* -------------------------------------------------------------------------- */
/* Normalización                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Construye el modelo de solicitud a partir del estado actual de RESTTester.
 *
 * @param {{url?: string, method?: string, data?: Record<string, any>, baseUrl?: string}} options
 * @param {string} [options.baseUrl]  Base para absolutizar una URL relativa. Si no se
 *   pasa, la URL se queda como está (y se avisa) porque no hay forma de saber el host.
 * @returns {RestRequest}
 */
export function normalizeRequest({ url = '', method = 'GET', data = {}, baseUrl = '' } = {}) {
	const warnings = [];
	const notices = [];

	const normalizedMethod = String(method || 'GET').toUpperCase();
	const query = readEnabledRows(data?.query);

	// La URL se absolutiza antes de componer el query string: una ruta relativa no tiene
	// sentido en el archivo exportado, que se ejecuta sin base.
	const { url: absoluteUrl, base, resolved } = resolveUrlAgainstBase(url, baseUrl);
	// Cuando sí se resolvió no se agrega nada a `notices`: `index.svelte` pregunta con
	// `confirm()` por cada notice y no debe interrumpir una exportación normal solo por
	// usar rutas relativas. El origen usado queda como comentario en el archivo.
	const isRelative = String(url || '').trim() !== '' && !isAbsoluteUrl(url);
	if (isRelative && !resolved) {
		warnings.push(
			'La URL es relativa y no hay base para resolverla: el archivo usa una ruta relativa, que no funcionará fuera de este sitio.'
		);
	}

	const finalUrl = buildFinalUrl(absoluteUrl, query);
	const auth = readAuth(data);

	let headers = normalizeHeaderRows(data?.headers);
	// uFetch da prioridad a la autenticación configurada sobre un header Authorization manual.
	if (auth.configured) headers = removeHeader(headers, 'authorization');

	const acceptsBody = !METHODS_WITHOUT_BODY.has(normalizedMethod);
	const selection = Number(data?.body?.selection ?? BODY_TYPES.JSON);

	let body = {
		type: 'none',
		text: null,
		runtime: undefined,
		mime: null,
		fields: [],
		hasFiles: false
	};

	if (acceptsBody) {
		if (selection === BODY_TYPES.JSON) {
			const code = data?.body?.json?.code;
			if (typeof code === 'string') {
				if (code.trim() === '') {
					body = { ...body, type: 'json-empty' };
				} else {
					try {
						const parsed = JSON.parse(code);
						body = {
							type: 'json',
							text: JSON.stringify(parsed, null, 2),
							runtime: parsed,
							mime: MIME_JSON,
							fields: [],
							hasFiles: false
						};
					} catch (error) {
						warnings.push('El body JSON no es válido: se enviará como texto sin transformar.');
						body = {
							type: 'raw',
							text: code,
							runtime: code,
							mime: null,
							fields: [],
							hasFiles: false
						};
					}
				}
			} else if (code != null && typeof code === 'object') {
				body = {
					type: 'json',
					text: JSON.stringify(code, null, 2),
					runtime: code,
					mime: MIME_JSON,
					fields: [],
					hasFiles: false
				};
			} else {
				body = { ...body, type: 'json-empty' };
			}
		} else if (selection === BODY_TYPES.XML) {
			const code = data?.body?.xml?.code ?? '';
			body = {
				type: 'xml',
				text: String(code),
				runtime: String(code),
				mime: null,
				fields: [],
				hasFiles: false
			};
		} else if (selection === BODY_TYPES.TEXT) {
			const value = data?.body?.text?.value ?? '';
			body = {
				type: 'text',
				text: String(value),
				runtime: String(value),
				mime: null,
				fields: [],
				hasFiles: false
			};
		} else if (selection === BODY_TYPES.FORM) {
			const fields = readFormFields(data?.body?.form);
			body = {
				type: 'form',
				text: null,
				runtime: buildRuntimeFormData(fields),
				mime: MIME_MULTIPART,
				fields,
				hasFiles: fields.some((field) => field.file)
			};
			if (body.hasFiles) {
				notices.push(
					'Los campos de archivo se referencian por nombre; coloca esos archivos junto al script exportado.'
				);
			}
		} else if (selection === BODY_TYPES.URLENCODED) {
			const params = readEnabledRows(data?.body?.urlencoded);
			const search = new URLSearchParams();
			for (const param of params) search.append(param.key, param.value);
			const encoded = search.toString();
			body = {
				type: 'urlencoded',
				text: encoded,
				runtime: new URLSearchParams(encoded),
				mime: MIME_URLENCODED,
				fields: params.map((param) => ({
					...param,
					enabled: true,
					file: null,
					rawValue: param.value
				})),
				hasFiles: false
			};
		}
	} else if (selection === BODY_TYPES.JSON && data?.body?.json?.code != null) {
		warnings.push(`El método ${normalizedMethod} no admite body; el body configurado se omite.`);
	}

	// `json` incluye `{}`; los cuerpos de texto vacíos no se envían (igual que antes:
	// el código previo sólo asignaba `data_send` cuando el body era "truthy").
	body.hasBody =
		body.type === 'json' || body.type === 'form' || body.type === 'urlencoded'
			? true
			: body.type === 'raw' || body.type === 'xml' || body.type === 'text'
				? String(body.text ?? '') !== ''
				: false;

	// Content-Type por defecto sólo para cuerpos JSON (igual que uFetch). Los cuerpos
	// FormData / URLSearchParams los tipa el cliente final, por eso no se fija aquí.
	if (body.type === 'json' && !findHeader(headers, 'content-type')) {
		headers = [...headers, { key: 'Content-Type', value: MIME_JSON }];
	}

	return {
		method: normalizedMethod,
		url: finalUrl,
		base,
		resolved,
		query,
		headers,
		auth,
		body,
		warnings,
		notices
	};
}

/* -------------------------------------------------------------------------- */
/* Helpers de escapado                                                          */
/* -------------------------------------------------------------------------- */

function shellQuote(value) {
	return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

function psQuote(value) {
	return `'${String(value).replace(/'/g, "''")}'`;
}

function pickHeredocDelimiter(text, base) {
	let delimiter = base;
	let counter = 0;
	while (String(text ?? '').includes(delimiter)) {
		counter += 1;
		delimiter = `${base}${counter}`;
	}
	return delimiter;
}

function pickHereStringTerminator(text, base) {
	let terminator = base;
	let counter = 0;
	const escapes = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	while (new RegExp(`^${escapes(terminator)}$`, 'm').test(String(text ?? ''))) {
		counter += 1;
		terminator = `${base}${counter}`;
	}
	return terminator;
}

/* -------------------------------------------------------------------------- */
/* Autenticación por formato                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Calcula el valor de la cabecera Authorization (o la forma específica del formato).
 * @param {RestRequest} model
 * @param {'http'|'curl'|'powershell'} format
 * @param {'variables'|'literal'} secrets
 */
function authForFormat(model, format, secrets) {
	const { auth } = model;
	if (!auth.configured) return null;

	if (auth.type === 'bearer') {
		if (secrets === 'literal') return `Bearer ${auth.token}`;
		if (format === 'http') return 'Bearer {{token}}';
		if (format === 'powershell') return 'Bearer $env:REST_TOKEN';
		return 'Bearer ${REST_TOKEN}';
	}

	// Basic
	if (secrets === 'literal') return `Basic ${base64Utf8(`${auth.username}:${auth.password}`)}`;
	if (format === 'http') return 'Basic {{basicAuth}}';
	if (format === 'powershell') return 'Basic $basicCredentials';
	return 'Basic ${REST_BASIC}';
}

function secretNoticeFor(model, secrets) {
	if (!model.auth.configured) return null;
	if (secrets === 'literal') return 'Este archivo contiene credenciales en texto plano.';
	return 'Las credenciales se leen de variables de entorno.';
}

function commentLines(model, extra = []) {
	const lines = [`# Método: ${model.method}`, `# URL: ${model.url}`];
	// Deja constancia del origen con el que se absolutizó la ruta: el archivo ya no
	// dice de dónde salió el host y sin esto no se puede reconstruir.
	if (model.resolved && model.base) lines.push(`# URL relativa resuelta contra: ${model.base}`);
	for (const warning of model.warnings) lines.push(`# AVISO: ${warning}`);
	for (const notice of model.notices) lines.push(`# NOTA: ${notice}`);
	for (const line of extra) if (line) lines.push(`# ${line}`);
	return lines;
}

/**
 * Devuelve los headers efectivos incluyendo `Authorization`.
 * Se usa para la tabla "Request Headers" y para inspeccionar la solicitud.
 *
 * @param {RestRequest} model
 * @param {'variables'|'literal'} [secrets]
 * @returns {{key: string, value: string}[]}
 */
export function getRequestHeaders(model, secrets = 'literal') {
	const headers = [...model.headers];
	const authValue = authForFormat(model, 'http', secrets);
	if (authValue) headers.push({ key: 'Authorization', value: authValue });
	return headers;
}

/** Convierte la lista de headers a objeto para `fetch`/`uFetch`. */
export function toHeadersObject(model) {
	return headersToObject(model.headers);
}

/* -------------------------------------------------------------------------- */
/* .http                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Genera un archivo `.http` (sintaxis común a los clientes HTTP modernos).
 *
 * @param {RestRequest} model
 * @param {{secrets?: 'variables'|'literal'}} [options]
 * @returns {string}
 */
export function serializeHttp(model, { secrets = 'variables' } = {}) {
	const lines = ['# Generado por @rdsslab/svelte-components - RESTTester (.http)'];
	lines.push(...commentLines(model, [secretNoticeFor(model, secrets)]));

	lines.push('');
	lines.push(`${model.method} ${model.url}`);

	let headers = model.headers;
	let boundary = null;
	if (model.body.type === 'form' && !findHeader(headers, 'content-type')) {
		// El archivo .http necesita un boundary explícito para describir el multipart.
		boundary = `----RESTTesterFormBoundary${model.body.fields.length}`;
		headers = [
			...headers,
			{ key: 'Content-Type', value: `${MIME_MULTIPART}; boundary=${boundary}` }
		];
	} else if (model.body.type === 'urlencoded' && !findHeader(headers, 'content-type')) {
		headers = [...headers, { key: 'Content-Type', value: 'application/x-www-form-urlencoded' }];
	}

	for (const header of headers) lines.push(`${header.key}: ${header.value}`);

	const authValue = authForFormat(model, 'http', secrets);
	if (authValue) {
		lines.push(`Authorization: ${authValue}`);
		if (secrets === 'variables' && model.auth.type === 'basic') {
			lines.push('# basicAuth = Base64("<usuario>:<password>")');
		}
	}

	lines.push('');

	switch (model.body.type) {
		case 'json':
		case 'raw':
		case 'xml':
		case 'text':
		case 'urlencoded':
			if (model.body.hasBody) lines.push(model.body.text ?? '');
			break;
		case 'form':
			for (const field of model.body.fields) {
				lines.push(`--${boundary}`);
				if (field.file) {
					lines.push(
						`Content-Disposition: form-data; name="${field.key}"; filename="${field.file.name}"`
					);
					lines.push(`Content-Type: ${field.file.type}`);
					lines.push(`< ./${field.file.name}`);
				} else {
					lines.push(`Content-Disposition: form-data; name="${field.key}"`);
					lines.push('');
					lines.push(field.value);
				}
			}
			lines.push(`--${boundary}--`);
			break;
		default:
			break;
	}

	return lines.join('\n').replace(/\n+$/, '\n');
}

/* -------------------------------------------------------------------------- */
/* .sh (curl)                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Genera un script `curl` para Linux/macOS.
 *
 * @param {RestRequest} model
 * @param {{secrets?: 'variables'|'literal'}} [options]
 * @returns {string}
 */
export function serializeCurlShell(model, { secrets = 'variables' } = {}) {
	const lines = ['#!/usr/bin/env bash'];
	lines.push('# Generado por @rdsslab/svelte-components - RESTTester (curl)');
	lines.push(...commentLines(model, [secretNoticeFor(model, secrets)]));
	lines.push('');
	lines.push('set -euo pipefail');
	lines.push('');

	const usesFiles = model.body.type === 'form' && model.body.hasFiles;
	if (usesFiles) {
		lines.push('SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"');
		lines.push('');
	}

	const groups = [
		`--request ${model.method}`,
		`--url ${shellQuote(model.url)}`,
		'--location',
		'--silent',
		'--show-error'
	];

	for (const header of model.headers) {
		groups.push(`--header ${shellQuote(`${header.key}: ${header.value}`)}`);
	}

	// curl añade `application/x-www-form-urlencoded` a --data-binary, pero fetch no
	// inventa Content-Type para cuerpos string. Se cancela con un valor vacío.
	const curlSuppliesContentType =
		model.body.type === 'urlencoded' ||
		model.body.type === 'form' ||
		!!findHeader(model.headers, 'content-type');
	if (model.body.hasBody && !curlSuppliesContentType) {
		groups.push(`--header ${shellQuote('Content-Type:')}`);
	}

	if (model.auth.configured) {
		if (model.auth.type === 'basic') {
			groups.push(
				secrets === 'variables'
					? '--user "${REST_USERNAME}:${REST_PASSWORD}"'
					: `--user ${shellQuote(`${model.auth.username}:${model.auth.password}`)}`
			);
		} else if (secrets === 'variables') {
			groups.push(
				'--header "Authorization: Bearer ${REST_TOKEN:?Define REST_TOKEN para ejecutar}"'
			);
		} else {
			groups.push(
				`--header ${shellQuote(`Authorization: ${authForFormat(model, 'curl', secrets)}`)}`
			);
		}
	}

	// El cuerpo va SIEMPRE en la última línea lógica: un heredoc precedido de `\`
	// se comería su propio contenido como argumentos.
	let bodyToken = null;
	let bodyBlock = null;
	if (model.body.type === 'form') {
		for (const field of model.body.fields) {
			if (field.file) {
				groups.push(`--form "${field.key}=@\${SCRIPT_DIR}/${field.file.name}"`);
			} else {
				groups.push(`--form ${shellQuote(`${field.key}=${field.value}`)}`);
			}
		}
	} else if (model.body.hasBody) {
		const delimiter = pickHeredocDelimiter(model.body.text, 'RESTTESTER_BODY_EOF');
		// Un heredoc siempre añade un salto de línea final. Si el body no la trae, se
		// usa sustitución de comandos para no alterar los datos (clave en urlencoded).
		if (model.body.text.endsWith('\n')) {
			bodyToken = `--data-binary @- <<'${delimiter}'`;
			bodyBlock = [model.body.text, delimiter];
		} else {
			bodyToken = `--data-binary "$(cat <<'${delimiter}'`;
			bodyBlock = [model.body.text, delimiter, ')"'];
		}
	}

	const render = (index) => {
		const isFirst = index === 0;
		const isLast = index === groups.length - 1;
		return `${isFirst ? 'curl ' : '  '}${groups[index]}${isLast ? '' : ' \\'}`;
	};

	const command = groups.map((group, index) => render(index));
	if (bodyToken)
		command[command.length - 1] = `${command[command.length - 1].replace(/ \\$/, '')} ${bodyToken}`;

	lines.push(command.join('\n'));
	if (bodyBlock) lines.push(...bodyBlock);

	return lines.join('\n') + '\n';
}

/* -------------------------------------------------------------------------- */
/* .ps1 (PowerShell / System.Net.Http)                                         */
/* -------------------------------------------------------------------------- */

/**
 * Genera un script PowerShell (System.Net.Http) para Windows.
 *
 * @param {RestRequest} model
 * @param {{secrets?: 'variables'|'literal'}} [options]
 * @returns {string}
 */
export function serializePowerShell(model, { secrets = 'variables' } = {}) {
	const lines = [
		'<#',
		'  Generado por @rdsslab/svelte-components - RESTTester (PowerShell)',
		'  Método: ' + model.method,
		'  URL: ' + model.url
	];
	if (model.resolved && model.base) lines.push('  URL relativa resuelta contra: ' + model.base);
	for (const warning of model.warnings) lines.push(`  AVISO: ${warning}`);
	for (const notice of model.notices) lines.push(`  NOTA: ${notice}`);
	const notice = secretNoticeFor(model, secrets);
	if (notice) lines.push(`  SEGURIDAD: ${notice}`);
	lines.push('#>');
	lines.push('');
	lines.push('$ErrorActionPreference = "Stop"');
	lines.push(
		'[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12'
	);
	lines.push(
		"if (-not ('System.Net.Http.HttpClient' -as [type])) { Add-Type -AssemblyName System.Net.Http }"
	);
	lines.push('');
	lines.push(`$Url = ${psQuote(model.url)}`);
	lines.push(`$Method = ${psQuote(model.method)}`);
	lines.push('');

	// Credenciales
	if (model.auth.configured) {
		if (model.auth.type === 'bearer') {
			if (secrets === 'literal') {
				lines.push(`$AuthValue = ${psQuote(`Bearer ${model.auth.token}`)}`);
			} else {
				lines.push(
					'if (-not $env:REST_TOKEN) { throw "Define la variable de entorno REST_TOKEN." }'
				);
				lines.push('$AuthValue = "Bearer $env:REST_TOKEN"');
			}
		} else {
			if (secrets === 'literal') {
				lines.push(
					`$basicCredentials = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(${psQuote(`${model.auth.username}:${model.auth.password}`)}))`
				);
			} else {
				lines.push(
					'if (-not $env:REST_USERNAME -or -not $env:REST_PASSWORD) { throw "Define las variables de entorno REST_USERNAME y REST_PASSWORD." }'
				);
				lines.push(
					'$basicCredentials = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(($env:REST_USERNAME + ":" + $env:REST_PASSWORD)))'
				);
			}
			lines.push('$AuthValue = "Basic $basicCredentials"');
		}
		lines.push('');
	}

	// Headers
	lines.push(
		'$headers = [System.Collections.Generic.List[System.Collections.Generic.KeyValuePair[string,string]]]::new()'
	);
	for (const header of model.headers) {
		lines.push(
			`$headers.Add([System.Collections.Generic.KeyValuePair[string,string]]::new(${psQuote(header.key)}, ${psQuote(header.value)}))`
		);
	}
	if (model.auth.configured) {
		lines.push(
			'$headers.Add([System.Collections.Generic.KeyValuePair[string,string]]::new("Authorization", $AuthValue))'
		);
	}
	lines.push('');

	// Content
	const hasBody = model.body.hasBody;
	if (hasBody) {
		if (model.body.type === 'form') {
			lines.push('$content = [System.Net.Http.MultipartFormDataContent]::new()');
			for (const field of model.body.fields) {
				if (field.file) {
					lines.push(`$filePath = Join-Path $PSScriptRoot ${psQuote(field.file.name)}`);
					lines.push(
						'if (-not (Test-Path -LiteralPath $filePath)) { throw "Archivo no encontrado: $filePath" }'
					);
					lines.push('$stream = [System.IO.File]::OpenRead($filePath)');
					lines.push('$fileContent = [System.Net.Http.StreamContent]::new($stream)');
					lines.push(
						`$fileContent.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::Parse(${psQuote(field.file.type)})`
					);
					lines.push(
						`$content.Add($fileContent, ${psQuote(field.key)}, ${psQuote(field.file.name)})`
					);
				} else {
					lines.push(`$part = [System.Net.Http.StringContent]::new(${psQuote(field.value)})`);
					lines.push(`$content.Add($part, ${psQuote(field.key)})`);
				}
			}
		} else {
			const mediaType = resolvePsMediaType(model);
			lines.push(`$bodyText = ${model.body.text ? "@'" : "''"}`);
			if (model.body.text) {
				lines.push(model.body.text);
				lines.push(pickHereStringTerminator(model.body.text, "'@"));
			}
			if (mediaType) {
				lines.push(
					`$content = [System.Net.Http.StringContent]::new($bodyText, [Text.Encoding]::UTF8, ${psQuote(mediaType)})`
				);
			} else {
				// Sin Content-Type explícito: usar bytes para no inventar un media type.
				lines.push(
					'$content = [System.Net.Http.ByteArrayContent]::new([Text.Encoding]::UTF8.GetBytes($bodyText))'
				);
			}
		}
		lines.push('');
	}

	// Envío
	lines.push(
		'$request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::new($Method), $Url)'
	);
	lines.push(
		'foreach ($header in $headers) { [void]$request.Headers.TryAddWithoutValidation($header.Key, $header.Value) }'
	);
	if (hasBody) lines.push('$request.Content = $content');
	lines.push('');
	lines.push('$client = [System.Net.Http.HttpClient]::new()');
	lines.push('try {');
	lines.push('    $response = $client.SendAsync($request).GetAwaiter().GetResult()');
	lines.push('    Write-Output ("HTTP {0}" -f [int]$response.StatusCode)');
	lines.push('    Write-Output $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()');
	lines.push('} finally {');
	lines.push('    if ($request) { $request.Dispose() }');
	lines.push('    if ($client) { $client.Dispose() }');
	lines.push('}');

	// CRLF + BOM para máxima compatibilidad con Windows PowerShell 5.1 y acentos.
	return '﻿' + lines.join('\r\n') + '\r\n';
}

function resolvePsMediaType(model) {
	const explicit = findHeader(model.headers, 'content-type');
	if (explicit) return explicit.value;
	if (model.body.type === 'json') return MIME_JSON;
	if (model.body.type === 'urlencoded') return 'application/x-www-form-urlencoded';
	return null; // text/xml/raw: replicar fetch (string body sin Content-Type)
}

/* -------------------------------------------------------------------------- */
/* API pública                                                                  */
/* -------------------------------------------------------------------------- */

export const REST_EXPORT_FORMATS = [
	{ id: 'http', label: 'HTTP (.http)', extension: '.http', mime: 'text/plain;charset=utf-8' },
	{
		id: 'curl',
		label: 'curl Linux/macOS (.sh)',
		extension: '.sh',
		mime: 'text/x-shellscript;charset=utf-8'
	},
	{
		id: 'powershell',
		label: 'PowerShell Windows (.ps1)',
		extension: '.ps1',
		mime: 'text/plain;charset=utf-8'
	}
];

/**
 * Serializa una solicitud en el formato indicado.
 *
 * @param {RestRequest} model
 * @param {'http'|'curl'|'powershell'} format
 * @param {{secrets?: 'variables'|'literal'}} [options]
 * @returns {string}
 */
export function serializeRequest(model, format, options) {
	switch (format) {
		case 'http':
			return serializeHttp(model, options);
		case 'curl':
			return serializeCurlShell(model, options);
		case 'powershell':
			return serializePowerShell(model, options);
		default:
			throw new Error(`Formato de exportación no soportado: ${format}`);
	}
}

/** Descarga un archivo generado en el navegador. */
export function downloadRequestFile(
	model,
	format,
	{ secrets = 'variables', baseName = 'rest-request' } = {}
) {
	if (typeof document === 'undefined')
		throw new Error('downloadRequestFile requiere un navegador.');

	const meta = REST_EXPORT_FORMATS.find((item) => item.id === format);
	if (!meta) throw new Error(`Formato de exportación no soportado: ${format}`);

	const content = serializeRequest(model, format, { secrets });
	const blob = new Blob([content], { type: meta.mime });
	const objectUrl = URL.createObjectURL(blob);
	const anchor = document.createElement('a');
	anchor.href = objectUrl;
	anchor.download = `${baseName}${meta.extension}`;
	document.body.appendChild(anchor);
	anchor.click();
	document.body.removeChild(anchor);
	setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);

	return `${baseName}${meta.extension}`;
}
