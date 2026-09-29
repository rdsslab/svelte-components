/**
 * Importador de solicitudes HTTP para RESTTester.
 *
 * Convierte archivos generados por otras herramientas (o escritos a mano) en el
 * estado que RESTTester ya entiende (`{ url, method, data }`), de forma inversa
 * a los exportadores de `request.js`.
 *
 * Formatos soportados:
 *  - `http`       -> `.http` (REST Client de VS Code / JetBrains, httpyac)
 *  - `curl`       -> scripts `curl` (DevTools del navegador, Postman, Swagger, hechos a mano)
 *  - `powershell` -> `.ps1` propio, `Invoke-RestMethod`, `Invoke-WebRequest`
 *  - `fetch`      -> `fetch(...)` y `axios(...)` de JavaScript
 *
 * No depende del DOM: el componente Svelte sólo lee el texto del archivo y lo
 * entrega aquí, de modo que los parsers se pueden probar en Node.
 */

import { AUTH_TYPES, BODY_TYPES } from './request.js';

/* -------------------------------------------------------------------------- */
/* Metadatos                                                                   */
/* -------------------------------------------------------------------------- */

/** Formatos que el importador sabe leer (la UI usa `extensions` para el input). */
export const REST_IMPORT_FORMATS = [
	{
		id: 'http',
		label: 'HTTP client (.http)',
		extensions: ['.http', '.rest'],
		mime: 'text/plain'
	},
	{
		id: 'curl',
		label: 'curl / bash (.sh)',
		extensions: ['.sh', '.bash', '.zsh', '.curl'],
		mime: 'text/plain'
	},
	{
		id: 'powershell',
		label: 'PowerShell (.ps1)',
		extensions: ['.ps1', '.psm1'],
		mime: 'text/plain'
	},
	{
		id: 'fetch',
		label: 'JavaScript fetch / axios (.js)',
		extensions: ['.js', '.mjs', '.cjs', '.ts'],
		mime: 'text/plain'
	}
];

/** Extensiones aceptadas por el input de archivo. */
export const REST_IMPORT_ACCEPT = [
	...new Set(REST_IMPORT_FORMATS.flatMap((format) => format.extensions)),
	'.txt'
].join(',');

const HTTP_METHODS = [
	'GET',
	'POST',
	'PUT',
	'DELETE',
	'PATCH',
	'QUERY',
	'HEAD',
	'OPTIONS',
	'TRACE',
	'CONNECT'
];

const METHODS_WITHOUT_BODY = new Set(['GET', 'HEAD', 'OPTIONS', 'CONNECT', 'TRACE']);

/**
 * Cabeceras que el navegador no permite fijar desde `fetch` (o que él solo
 * gestiona). Se descartan con un aviso para no fallar en silencio.
 */
const FORBIDDEN_HEADERS = new Set([
	'accept-charset',
	'accept-encoding',
	'connection',
	'content-length',
	'cookie',
	'cookie2',
	'date',
	'dnt',
	'expect',
	'host',
	'keep-alive',
	'origin',
	'permissions-policy',
	'referer',
	'set-cookie',
	'te',
	'trailer',
	'transfer-encoding',
	'upgrade',
	'via'
]);

const FORBIDDEN_HEADER_PREFIXES = ['sec-', 'proxy-', 'x-http-method-'];

/** Variables dinámicas del REST Client que no se pueden resolver. */
const DYNAMIC_HTTP_VARIABLES = new Set([
	'$randomInt',
	'$guid',
	'$timestamp',
	'$localDatetime',
	'$processEnv',
	'$dotenv'
]);

const MIME_JSON = 'application/json';
const MIME_URLENCODED = 'application/x-www-form-urlencoded';
const MIME_MULTIPART = 'multipart/form-data';

const UNRESOLVED_VARIABLE = /\{\{|\$\{|\$[A-Za-z_]/;

/* -------------------------------------------------------------------------- */
/* Utilidades generales                                                         */
/* -------------------------------------------------------------------------- */

function stripBom(text) {
	return toText(text).replace(/^﻿/, '');
}

function normalizeNewlines(text) {
	return stripBom(text).replace(/\r\n?/g, '\n');
}

function toText(value) {
	if (value == null) return '';
	return String(value);
}

function extensionOf(fileName) {
	const match = /\.([A-Za-z0-9]+)$/.exec(toText(fileName).trim());
	return match ? `.${match[1].toLowerCase()}` : '';
}

function escapeRegExp(value) {
	return toText(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function decodeBase64(value) {
	// Node decora silenciosamente lo que no es base64; se filtra antes de decodificar.
	const clean = toText(value).trim().replace(/\s+/g, '');
	if (!clean || !/^[A-Za-z0-9+/_-]+={0,2}$/.test(clean)) return null;
	try {
		if (typeof Buffer !== 'undefined') {
			return Buffer.from(clean, 'base64').toString('utf8');
		}
		if (typeof atob === 'function') {
			const binary = atob(clean);
			const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
			return new TextDecoder().decode(bytes);
		}
	} catch {
		return null;
	}
	return null;
}

function encodeBase64(value) {
	const text = toText(value);
	if (typeof Buffer !== 'undefined') return Buffer.from(text, 'utf8').toString('base64');
	if (typeof btoa === 'function') return btoa(unescape(encodeURIComponent(text)));
	return '';
}

function isJsonLike(text) {
	const clean = toText(text).trim();
	if (!clean) return false;
	const first = clean[0];
	const last = clean[clean.length - 1];
	if (!((first === '{' && last === '}') || (first === '[' && last === ']'))) return false;
	try {
		JSON.parse(clean);
		return true;
	} catch {
		return false;
	}
}

function isXmlLike(text) {
	const clean = toText(text).trim();
	return clean.startsWith('<') && /<\/[^>]+>\s*$/.test(clean);
}

/** Devuelve el JSON indentado si el texto es JSON válido; si no, `null`. */
function prettyJson(text) {
	try {
		return JSON.stringify(JSON.parse(toText(text)), null, 2);
	} catch {
		return null;
	}
}

function unquote(value) {
	const text = toText(value).trim();
	if (text.length >= 2 && text.startsWith("'") && text.endsWith("'")) {
		return text.slice(1, -1).replace(/''/g, "'");
	}
	if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) {
		return text.slice(1, -1).replace(/\\(.)/g, (match, char) => {
			const map = { b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
			return map[char] !== undefined ? map[char] : char;
		});
	}
	return text;
}

function isQuoted(value) {
	const text = toText(value).trim();
	return text.length >= 2 && (text[0] === "'" || text[0] === '"') && text.at(-1) === text[0];
}

function safeDecode(value) {
	try {
		return decodeURIComponent(toText(value).replace(/\+/g, ' '));
	} catch {
		return toText(value);
	}
}

/** Elimina duplicados de cabeceras (mismo nombre, sin distinguir mayúsculas). */
function dedupeHeaders(headers) {
	const seen = new Set();
	const result = [];
	for (const header of headers) {
		const key = toText(header.key).trim();
		if (!key) continue;
		const lower = key.toLowerCase();
		if (seen.has(lower)) continue;
		seen.add(lower);
		result.push({ enabled: true, key, value: toText(header.value) });
	}
	return result;
}

/* -------------------------------------------------------------------------- */
/* Lectores de cadenas                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Lector de cadenas entre comillas simples.
 * - `shell` (por defecto): POSIX, sin escapes y sin concatenación (`'a''b'` -> `ab`).
 * - `powerShell` / `javaScript`: `''` y `\'` representan una comilla simple.
 */
function readSingleQuoted(source, from, dialect = 'shell') {
	const escapes = dialect !== 'shell';
	const joins = dialect !== 'shell';
	let value = '';
	let index = from;

	while (index < source.length) {
		const char = source[index];

		if (char === '\\' && escapes && source[index + 1] === "'") {
			value += "'";
			index += 2;
			continue;
		}

		if (char === "'" && joins && source[index + 1] === "'") {
			value += "'";
			index += 2;
			continue;
		}

		if (char === "'") return { value, end: index + 1 };

		value += char;
		index += 1;
	}

	return { value, end: source.length };
}

/** Lector de cadenas entre comillas dobles con escapes estilo shell. */
function readDoubleQuoted(source, from) {
	let value = '';
	let index = from;

	while (index < source.length) {
		const char = source[index];

		if (char === '"') return { value, end: index + 1 };

		if (char === '\\') {
			const next = source[index + 1];
			if (next === '\n') {
				index += 2;
				continue;
			}
			if (next === undefined) {
				index += 1;
				continue;
			}
			const map = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f' };
			value += map[next] !== undefined ? map[next] : next;
			index += 2;
			continue;
		}

		// `${...}` y `$(...)` se conservan literalmente (no se evalúan).
		if (char === '$' && (source[index + 1] === '{' || source[index + 1] === '(')) {
			const block = readBalanced(
				source,
				index + 1,
				source[index + 1] === '{' ? '{' : '(',
				source[index + 1] === '{' ? '}' : ')'
			);
			value += source.slice(index, block.end);
			index = block.end;
			continue;
		}

		value += char;
		index += 1;
	}

	return { value, end: index };
}

/** Lector de cadenas entre comillas dobles estilo PowerShell (`""` escapa). */
function readPowerShellDoubleQuoted(source, from) {
	let value = '';
	let index = from;

	while (index < source.length) {
		const char = source[index];

		if (char === '"') {
			if (source[index + 1] === '"') {
				value += '"';
				index += 2;
				continue;
			}
			return { value, end: index + 1 };
		}

		value += char;
		index += 1;
	}

	return { value, end: source.length };
}

/** Avanza hasta el paréntesis/llave que cierra el bloque abierto en `index`. */
function readBalanced(source, index, open = '(', close = ')', dialect = 'shell') {
	let depth = 0;
	let cursor = index;

	while (cursor < source.length) {
		const char = source[cursor];

		if (char === "'") {
			cursor = readSingleQuoted(source, cursor + 1, dialect).end;
			continue;
		}

		if (char === '"') {
			cursor =
				dialect === 'powerShell'
					? readPowerShellDoubleQuoted(source, cursor + 1).end
					: readDoubleQuoted(source, cursor + 1).end;
			continue;
		}

		if (char === open) depth += 1;
		else if (char === close) {
			depth -= 1;
			if (depth === 0) return { end: cursor + 1 };
		}

		cursor += 1;
	}

	return { end: source.length };
}

function readAnsiCQuoted(source, from) {
	const map = {
		n: '\n',
		t: '\t',
		r: '\r',
		b: '\b',
		f: '\f',
		0: '\0',
		'\\': '\\',
		"'": "'",
		'"': '"'
	};
	let value = '';
	let index = from;

	while (index < source.length && source[index] !== "'") {
		if (source[index] === '\\' && index + 1 < source.length) {
			const next = source[index + 1];
			if (map[next] !== undefined) {
				value += map[next];
				index += 2;
				continue;
			}
		}
		value += source[index];
		index += 1;
	}

	return { value, end: Math.min(index + 1, source.length) };
}

/* -------------------------------------------------------------------------- */
/* Lector tipo shell (curl)                                                    */
/* -------------------------------------------------------------------------- */

/** Marcador interno que sustituye al cuerpo de un heredoc. */
function heredocMarker(index) {
	return ` heredoc-${index} `;
}

function heredocIndexOf(value) {
	return /(?:^|\s)heredoc-(\d+)(?:\s|$)/.exec(toText(value).trim());
}

/**
 * Extrae los cuerpos de los heredocs (`<<EOF` ... `EOF`) y los sustituye por un
 * marcador, para que el tokenizador no destroce el cuerpo del comando.
 *
 * @param {string} source
 * @returns {{source: string, bodies: string[]}}
 */
function extractHeredocs(source) {
	const text = normalizeNewlines(source);
	const bodies = [];
	let result = '';
	let index = 0;

	while (index < text.length) {
		const found = /<<[-~]?\s*(['"`]?)([A-Za-z_][A-Za-z0-9_]*)\1/.exec(text.slice(index));
		if (!found) {
			result += text.slice(index);
			break;
		}

		const start = index + found.index;
		const delimiter = found[2];
		const lineEnd = text.indexOf('\n', start + found[0].length);
		if (lineEnd === -1) {
			result += text.slice(index);
			break;
		}

		// La línea del `<<` pertenece al comando; sólo se sustituye el `<<DELIM`.
		result += text.slice(index, start);
		result += heredocMarker(bodies.length);
		index = lineEnd + 1;

		const bodyLines = [];
		let closed = false;

		while (index < text.length) {
			const nextEnd = text.indexOf('\n', index);
			const line = nextEnd === -1 ? text.slice(index) : text.slice(index, nextEnd);
			if (line.trim() === delimiter) {
				index = nextEnd === -1 ? text.length : nextEnd + 1;
				closed = true;
				break;
			}
			bodyLines.push(line);
			if (nextEnd === -1) {
				index = text.length;
				break;
			}
			index = nextEnd + 1;
		}

		bodies.push(bodyLines.join('\n'));
		if (!closed) break;
	}

	return { source: result, bodies };
}

/** Quita los comentarios de línea completa de un script shell. */
function stripShellComments(source) {
	return source
		.split('\n')
		.filter((line) => !/^\s*#/.test(line))
		.join('\n');
}

/** Sustituye los marcadores de heredoc por su contenido real. */
function restoreHeredocs(value, bodies) {
	let result = toText(value);
	for (let index = 0; index < bodies.length; index += 1) {
		result = result.split(heredocMarker(index)).join(bodies[index]);
	}
	return result;
}

/**
 * Separa un comando shell en tokens respetando comillas, continuaciones de línea
 * (`\` al final), sustituciones `$()` / `${}` y heredocs.
 *
 * @param {string} source
 * @returns {string[]}
 */
export function tokenizeShell(source) {
	const text = normalizeNewlines(source);
	const tokens = [];
	let current = '';
	let started = false;
	let index = 0;

	const push = () => {
		if (started) {
			tokens.push(current);
			current = '';
			started = false;
		}
	};

	while (index < text.length) {
		const char = text[index];

		if (/\s/.test(char)) {
			push();
			index += 1;
			continue;
		}

		// Continuación de línea o escape.
		if (char === '\\') {
			const next = text[index + 1];
			if (next === '\n') {
				index += 2;
				continue;
			}
			if (next === undefined) {
				index += 1;
				continue;
			}
			const map = { n: '\n', t: '\t', r: '\r' };
			current += map[next] !== undefined ? map[next] : next;
			started = true;
			index += 2;
			continue;
		}

		if (char === "'") {
			const block = readSingleQuoted(text, index + 1);
			current += block.value;
			started = true;
			index = block.end;
			continue;
		}

		if (char === '"') {
			const block = readDoubleQuoted(text, index + 1);
			current += block.value;
			started = true;
			index = block.end;
			continue;
		}

		if (char === '$' && text[index + 1] === "'") {
			const block = readAnsiCQuoted(text, index + 2);
			current += block.value;
			started = true;
			index = block.end;
			continue;
		}

		// `$(...)` sin comillas.
		if (char === '$' && text[index + 1] === '(') {
			const block = readBalanced(text, index + 1);
			current += text.slice(index, block.end);
			started = true;
			index = block.end;
			continue;
		}

		// Separadores de comandos: no forman parte de la llamada.
		if (';|&`()'.includes(char)) {
			push();
			index += 1;
			continue;
		}

		current += char;
		started = true;
		index += 1;
	}

	push();
	return tokens;
}

/* -------------------------------------------------------------------------- */
/* Lector de literales JavaScript                                               */
/* -------------------------------------------------------------------------- */

const JS_IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*/;

/**
 * Lector tolerante de literales JS/JSON: objetos, arrays, cadenas (comillas
 * simples, dobles y plantillas), números, booleanos y `null`.
 *
 * Lo que no sabe resolver (funciones, referencias) se devuelve como el código
 * fuente original, para poder avisar en lugar de perder información.
 *
 * @param {string} text
 * @param {number} start
 * @returns {{value: any, end: number}}
 */
function readJsValue(text, start = 0) {
	let index = start;

	const skipSpace = () => {
		while (index < text.length) {
			if (/\s/.test(text[index])) {
				index += 1;
				continue;
			}
			if (text[index] === '/' && text[index + 1] === '/') {
				const end = text.indexOf('\n', index);
				index = end === -1 ? text.length : end + 1;
				continue;
			}
			if (text[index] === '/' && text[index + 1] === '*') {
				const end = text.indexOf('*/', index + 2);
				index = end === -1 ? text.length : end + 2;
				continue;
			}
			break;
		}
	};

	const readString = () => {
		if (text[index] === "'") return readSingleQuoted(text, index + 1, 'javaScript');
		if (text[index] === '`') {
			const end = text.indexOf('`', index + 1);
			const stop = end === -1 ? text.length : end;
			return { value: text.slice(index + 1, stop), end: stop + 1 };
		}
		return readDoubleQuoted(text, index + 1);
	};

	const readArguments = () => {
		const args = [];
		skipSpace();
		while (index < text.length && text[index] !== ')') {
			const value = readJsValue(text, index);
			args.push(value.value);
			index = value.end;
			skipSpace();
			if (text[index] === ',') index += 1;
			skipSpace();
		}
		if (text[index] === ')') index += 1;
		return args;
	};

	skipSpace();
	if (index >= text.length) return { value: '', end: index };

	const char = text[index];

	if (char === '{') {
		index += 1;
		const result = {};
		skipSpace();
		while (index < text.length && text[index] !== '}') {
			skipSpace();
			if (text[index] === '}') {
				index += 1;
				break;
			}

			// Clave.
			let key;
			if (text[index] === "'") {
				const block = readSingleQuoted(text, index + 1, 'javaScript');
				key = block.value;
				index = block.end;
			} else if (text[index] === '"' || text[index] === '`') {
				const block = readString();
				key = block.value;
				index = block.end;
			} else {
				const match = JS_IDENTIFIER.exec(text.slice(index));
				if (!match) {
					index += 1;
					continue;
				}
				key = match[0];
				index += key.length;
			}

			skipSpace();
			let value = '';
			if (text[index] === ':') {
				index += 1;
				const read = readJsValue(text, index);
				value = read.value;
				index = read.end;
			}
			result[key] = value;

			skipSpace();
			if (text[index] === ',') index += 1;
			skipSpace();
		}
		if (text[index] === '}') index += 1;
		return { value: result, end: index };
	}

	if (char === '[') {
		index += 1;
		const list = [];
		skipSpace();
		while (index < text.length && text[index] !== ']') {
			skipSpace();
			if (text[index] === ']') {
				index += 1;
				break;
			}
			const read = readJsValue(text, index);
			list.push(read.value);
			index = read.end;
			skipSpace();
			if (text[index] === ',') index += 1;
			skipSpace();
		}
		if (text[index] === ']') index += 1;
		return { value: list, end: index };
	}

	if (char === "'" || char === '"' || char === '`') {
		const block = readString();
		return { value: block.value, end: block.end };
	}

	if (text.startsWith('new ', index)) {
		index += 4;
		skipSpace();
		const match = JS_IDENTIFIER.exec(text.slice(index));
		if (match) index += match[0].length;
		skipSpace();
		if (text[index] === '(') {
			index += 1;
			return { value: readArguments()[0], end: index };
		}
		return { value: '', end: index };
	}

	const number = /^-?\d+(\.\d+)?([eE][+-]?\d+)?/.exec(text.slice(index));
	if (number && /[0-9-]/.test(char)) {
		const value = Number(number[0]);
		return { value: Number.isNaN(value) ? number[0] : value, end: index + number[0].length };
	}

	if (JS_IDENTIFIER.test(text.slice(index))) {
		const match = JS_IDENTIFIER.exec(text.slice(index));
		const word = match[0];

		if (word === 'true') return { value: true, end: index + 4 };
		if (word === 'false') return { value: false, end: index + 5 };
		if (word === 'null') return { value: null, end: index + 4 };
		if (word === 'undefined') return { value: undefined, end: index + 9 };

		// Cadena de identificadores: `URL(...)`, `JSON.stringify({...})`, `a.b.c`.
		let cursor = index + word.length;
		let last = word;
		while (cursor < text.length) {
			let probe = cursor;
			while (probe < text.length && /\s/.test(text[probe])) probe += 1;
			if (text[probe] !== '.') break;
			probe += 1;
			while (probe < text.length && /\s/.test(text[probe])) probe += 1;
			const member = JS_IDENTIFIER.exec(text.slice(probe));
			if (!member) break;
			last = member[0];
			cursor = probe + member[0].length;
		}

		let callIndex = cursor;
		while (callIndex < text.length && /\s/.test(text[callIndex])) callIndex += 1;
		if (text[callIndex] === '(') {
			index = callIndex + 1;
			return { value: readArguments()[0], end: index };
		}

		return { value: last, end: cursor };
	}

	// Expresión no reconocida: se devuelve tal cual para no perder información.
	const raw = /[^,)}\]]+/.exec(text.slice(index));
	const value = raw ? raw[0].trim() : '';
	return { value, end: index + value.length };
}

/** Analiza un literal de objeto o array JS a partir del inicio del texto. */
export function parseJsLiteral(text) {
	return readJsValue(normalizeNewlines(text), 0).value;
}

/* -------------------------------------------------------------------------- */
/* Lector de hashtables de PowerShell                                           */
/* -------------------------------------------------------------------------- */

/**
 * Convierte un literal `@{ ... }` de PowerShell en un objeto plano.
 * Acepta claves con o sin comillas, `;` o saltos de línea como separadores,
 * `$true/$false/$null`, números, `@(1,2)` y hashtables anidados.
 */
function readPowerShellHashtable(source, start) {
	let index = start;
	while (index < source.length && /\s/.test(source[index])) index += 1;

	if (source.slice(index, index + 2) !== '@{') return { value: null, end: index };
	index += 2;

	const result = {};
	let depth = 1;

	while (index < source.length && depth > 0) {
		// Separadores: espacios, `;`, saltos de línea y comentarios.
		while (index < source.length && /[\s;]/.test(source[index])) index += 1;
		if (index >= source.length) break;

		if (source[index] === '#') {
			const end = source.indexOf('\n', index);
			index = end === -1 ? source.length : end + 1;
			continue;
		}

		if (source[index] === '}') {
			depth -= 1;
			index += 1;
			break;
		}

		// Clave.
		let key = '';
		let keyEnd = index;
		if (source[index] === "'") {
			const block = readSingleQuoted(source, index + 1, 'powerShell');
			key = block.value;
			keyEnd = block.end;
		} else if (source[index] === '"') {
			const block = readPowerShellDoubleQuoted(source, index + 1);
			key = block.value;
			keyEnd = block.end;
		} else {
			const match = /^[^=;{}]+/.exec(source.slice(index));
			key = (match ? match[0] : '').trim();
			keyEnd = index + (match ? match[0].length : 0);
		}

		if (keyEnd === index) {
			index += 1; // carácter inesperado: se avanza para no bloquear el bucle
			continue;
		}

		index = keyEnd;
		while (index < source.length && /\s/.test(source[index])) index += 1;

		if (source[index] !== '=') {
			// Entrada sin valor: se ignora y se continúa tras la clave.
			continue;
		}
		index += 1;
		while (index < source.length && /[ \t]/.test(source[index])) index += 1;

		if (source.slice(index, index + 2) === '@{') {
			const nested = readPowerShellHashtable(source, index);
			result[key] = nested.value;
			index = nested.end;
			continue;
		}

		const value = readPowerShellValue(source, index);
		if (key !== '') result[key] = value.value;
		index = Math.max(value.end, index + 1);
	}

	return { value: result, end: index };
}

/**
 * Lee un valor simple de PowerShell desde la posición indicada.
 *
 * @returns {{value: any, end: number, raw: string}} `raw` es el código fuente
 * leído, útil cuando el valor es una expresión que no se puede evaluar.
 */
function readPowerShellValue(source, start) {
	let index = start;
	while (index < source.length && /\s/.test(source[index])) index += 1;

	const finish = (value, end) => ({ value, end, raw: source.slice(index, end).trim() });

	if (source.slice(index, index + 2) === '@{') {
		const table = readPowerShellHashtable(source, index);
		return { value: table.value, end: table.end, raw: source.slice(index, table.end) };
	}

	if (source[index] === '@' && source[index + 1] === '(') {
		const block = readBalanced(source, index + 1, '(', ')', 'powerShell');
		const inner = source.slice(index + 2, Math.max(index + 2, block.end - 1));
		const list = inner
			.split(',')
			.map((part) => readPowerShellValue(part, 0).value)
			.filter((item) => item !== '');
		return { value: list, end: block.end, raw: source.slice(index, block.end) };
	}

	if (source[index] === "'") {
		const block = readSingleQuoted(source, index + 1, 'powerShell');
		return finish(block.value, block.end);
	}

	if (source[index] === '"') {
		const block = readPowerShellDoubleQuoted(source, index + 1);
		return finish(block.value, block.end);
	}

	const variable = /^\$[A-Za-z_][A-Za-z0-9_]*/.exec(source.slice(index));
	if (variable) {
		const word = variable[0].toLowerCase();
		if (word === '$true') return finish(true, index + 5);
		if (word === '$false') return finish(false, index + 6);
		if (word === '$null') return finish(null, index + 5);
		return finish(variable[0], index + variable[0].length);
	}

	const number = /^-?\d+(\.\d+)?/.exec(source.slice(index));
	if (number) return finish(Number(number[0]), index + number[0].length);

	// Expresión: `Get-Item 'x'`, `1 + 2`, `ConvertTo-Json`, ...
	const raw = /^[^;,}\n]+/.exec(source.slice(index));
	const value = raw ? raw[0].trim() : '';
	return { value, end: index + Math.max(value.length, 1), raw: value };
}

/* -------------------------------------------------------------------------- */
/* Armado del estado de RESTTester                                              */
/* -------------------------------------------------------------------------- */

function emptyAuth() {
	return {
		selection: AUTH_TYPES.NONE,
		basic: { username: '', password: '' },
		bearer: { token: '' }
	};
}

function emptyBody(selection = BODY_TYPES.JSON) {
	return {
		selection,
		js: {},
		json: { code: '' },
		xml: { code: '' },
		text: { value: '' },
		form: [],
		urlencoded: []
	};
}

/** Convierte un query string (`a=1&b=2`) en filas para las tablas de parámetros. */
function parseQueryString(text, warnings) {
	const rows = [];

	for (const chunk of toText(text).split('&')) {
		if (chunk === '') continue;
		const separator = chunk.indexOf('=');
		const key = separator === -1 ? chunk : chunk.slice(0, separator);
		const value = separator === -1 ? '' : chunk.slice(separator + 1);
		if (separator === -1) {
			warnings.push(`The parameter "${key}" had no value and was imported empty.`);
		}
		rows.push({ enabled: true, key: safeDecode(key), value: safeDecode(value) });
	}

	return rows;
}

/** Divide la URL en base y parámetros, como hace la pestaña "Query Parameters". */
function splitUrl(url, warnings) {
	const text = toText(url).trim();
	if (!text) return { base: '', query: [] };

	const hashIndex = text.indexOf('#');
	const withoutHash = hashIndex === -1 ? text : text.slice(0, hashIndex);
	const queryIndex = withoutHash.indexOf('?');
	if (queryIndex === -1) return { base: text, query: [] };

	return {
		base: text.slice(0, queryIndex),
		query: parseQueryString(withoutHash.slice(queryIndex + 1), warnings)
	};
}

/**
 * Normaliza una URL: quita comillas sueltas de un archivo escrito a mano y añade
 * el esquema si falta (`localhost:3000/api`).
 */
function normalizeUrl(url, notices) {
	let text = toText(url).trim();

	while (
		(text.startsWith("'") && text.endsWith("'")) ||
		(text.startsWith('"') && text.endsWith('"'))
	) {
		text = text.slice(1, -1).trim();
	}

	if (text.endsWith(';')) text = text.slice(0, -1).trim();
	if (text.endsWith(')') && !text.includes('(')) text = text.slice(0, -1).trim();

	if (!text) return text;
	if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(text)) return text;
	if (/^(mailto|tel|data|file|blob|about|javascript):/i.test(text)) return text;
	if (text.includes('{{') || text.includes('${')) return text;

	// `localhost:3000/api`, `api.example.com/v1`, `10.0.0.1:8080/health`
	if (/^[^\s/?#]+(\.[^\s/?#]*)?(:\d+)?([/?#]|$)/.test(text)) {
		notices.push('The URL had no scheme; "http://" was assumed.');
		return `http://${text}`;
	}

	return text;
}

function dropForbiddenHeaders(headers, notices) {
	const dropped = [];
	const kept = [];

	for (const header of headers) {
		const name = toText(header.key).trim();
		const lower = name.toLowerCase();
		if (!name) continue;
		if (
			FORBIDDEN_HEADERS.has(lower) ||
			FORBIDDEN_HEADER_PREFIXES.some((prefix) => lower.startsWith(prefix))
		) {
			dropped.push(name);
			continue;
		}
		kept.push({ key: name, value: toText(header.value).trim() });
	}

	if (dropped.length > 0) {
		notices.push(`Headers that the browser controls were discarded: ${dropped.join(', ')}.`);
	}

	return kept;
}

/**
 * Resuelve credenciales Basic escritas como comando de shell, muy habitual en
 * ejemplos copiados: `$(printf 'user:%s' 'pass' | base64)`, `$(echo -n u:p | base64)`.
 *
 * @param {string} value
 * @returns {string|null} `usuario:clave` o `null` si no se puede resolver.
 */
function decodeShellCredential(value) {
	const text = toText(value).trim();
	const inner = /^\$\(([\s\S]*)\)$/.exec(text)?.[1]?.trim() ?? text;
	if (!/(^|[|\s])base64\b/i.test(inner)) return null;

	const quoted = [...inner.matchAll(/'([^']*)'|"([^"]*)"/g)].map((match) => match[1] ?? match[2]);
	if (quoted.length === 0) return null;

	// `base64 -d`: lo entrecomillado ya venía en base64.
	if (/(^|\s)(-d|--decode|-D)(\s|$)/.test(inner)) {
		const decoded = decodeBase64(quoted.join(''));
		return decoded && decoded.includes(':') ? decoded : null;
	}

	// `base64` a secas: lo entrecomillado es el texto plano a codificar.
	let plain;
	if (/(^|[|\s])printf\b/.test(inner)) {
		const format = quoted[0];
		const rest = quoted.slice(1);
		plain = format.replace(/%s/g, () => rest.shift() ?? '');
	} else {
		plain = quoted.join('');
	}
	return plain.includes(':') ? plain : null;
}

/**
 * Traduce la cabecera `Authorization` a la pestaña Auth y la elimina de la lista.
 * @param {{key: string, value: string}[]} headers
 * @param {string[]} notices
 */
function extractAuth(headers, notices) {
	const auth = emptyAuth();
	const index = headers.findIndex(
		(header) => toText(header.key).trim().toLowerCase() === 'authorization'
	);
	if (index === -1) return { auth, headers };

	const value = toText(headers[index].value).trim();
	const rest = headers.filter((_header, position) => position !== index);
	const match = /^(\S+)\s*([\s\S]*)$/.exec(value);
	const scheme = match ? match[1].toLowerCase() : '';
	const credentials = match ? match[2].trim() : '';

	if (scheme === 'bearer' || scheme === 'token') {
		auth.selection = AUTH_TYPES.BEARER;
		auth.bearer.token = credentials;
		if (credentials === '') notices.push('The Authorization header had no token value.');
		return { auth, headers: rest };
	}

	if (scheme === 'basic') {
		const decoded = decodeBase64(credentials) ?? decodeShellCredential(credentials);
		if (decoded && decoded.includes(':')) {
			const separator = decoded.indexOf(':');
			auth.selection = AUTH_TYPES.BASIC;
			auth.basic.username = decoded.slice(0, separator);
			auth.basic.password = decoded.slice(separator + 1);
			return { auth, headers: rest };
		}
		// Sin credenciales legibles: la cabecera se conserva tal cual.
		notices.push('The Basic credentials could not be decoded; the header was kept as-is.');
		return { auth, headers };
	}

	if (value === '') notices.push('The Authorization header was empty and was discarded.');

	return { auth, headers: rest };
}

/** Traduce `-u/--user` de curl (o `$usuario:$clave`) a la pestaña Auth. */
function authFromUser(value, auth, notices) {
	const text = toText(value);
	if (!text.includes(':')) {
		auth.selection = AUTH_TYPES.BASIC;
		auth.basic.username = text;
		notices.push('Only a user was given for Basic auth; the password was left empty.');
		return;
	}
	const separator = text.indexOf(':');
	auth.selection = AUTH_TYPES.BASIC;
	auth.basic.username = text.slice(0, separator);
	auth.basic.password = text.slice(separator + 1);
}

function detectBodyType(contentType, text) {
	const mime = toText(contentType).split(';')[0].trim().toLowerCase();
	const raw = toText(text);

	if (mime.includes('json')) return BODY_TYPES.JSON;
	if (mime === MIME_URLENCODED) return BODY_TYPES.URLENCODED;
	if (mime === MIME_MULTIPART) return BODY_TYPES.FORM;
	if (mime.includes('xml')) return BODY_TYPES.XML;
	if (raw.trim() === '') return null;
	if (!mime) {
		if (isJsonLike(raw)) return BODY_TYPES.JSON;
		if (isXmlLike(raw)) return BODY_TYPES.XML;
	}
	return BODY_TYPES.TEXT;
}

/** Traduce el cuerpo libre (o sus campos) al formato de la pestaña Body. */
function buildBody({
	contentType,
	text,
	formFields,
	urlencodedParams,
	forcedType,
	warnings,
	notices
}) {
	const body = emptyBody();
	const raw = toText(text);

	if (formFields && formFields.length > 0) {
		body.selection = BODY_TYPES.FORM;
		body.form = formFields.map((field) => ({
			enabled: true,
			key: toText(field.key),
			value: field.file ? '' : toText(field.value),
			type: field.file ? 3 : /[\r\n]/.test(toText(field.value)) ? 2 : 1
		}));

		const files = formFields
			.filter((field) => field.file)
			.map((field) => field.file)
			.filter(Boolean);
		if (files.length > 0) {
			notices.push(
				`File fields must be selected again: ${files.join(', ')} (binaries cannot be imported).`
			);
		}
		return body;
	}

	if (urlencodedParams && urlencodedParams.length > 0) {
		body.selection = BODY_TYPES.URLENCODED;
		body.urlencoded = urlencodedParams.map((param) => ({
			enabled: true,
			key: toText(param.key),
			value: toText(param.value)
		}));
		return body;
	}

	const type = forcedType || detectBodyType(contentType, raw);
	if (type == null) return body;

	if (type === BODY_TYPES.JSON) {
		const pretty = prettyJson(raw);
		if (pretty === null) {
			warnings.push(
				'The body says it is JSON but it could not be parsed; it was imported as text.'
			);
			body.selection = BODY_TYPES.TEXT;
			body.text.value = raw;
			return body;
		}
		body.selection = BODY_TYPES.JSON;
		body.json.code = pretty;
		return body;
	}

	// `a=1&b=2` con Content-Type urlencoded: se reparte en la tabla de campos.
	if (type === BODY_TYPES.URLENCODED && !body.urlencoded.length && /=/.test(raw)) {
		body.selection = BODY_TYPES.URLENCODED;
		body.urlencoded = parseQueryString(raw, warnings);
		return body;
	}

	body.selection = type;
	if (type === BODY_TYPES.XML) body.xml.code = raw;
	else body.text.value = raw;
	return body;
}

/**
 * Punto de encuentro de todos los parsers: normaliza lo que cada formato haya
 * dissimilar y devuelve el estado que RESTTester consume.
 *
 * @returns {{method: string, url: string, data: object, warnings: string[], notices: string[]}}
 */
function assemble({
	method,
	url,
	headers = [],
	bodyText = '',
	formFields = null,
	urlencodedParams = null,
	extraQuery = [],
	forcedBodyType = null,
	auth: authOverride = null,
	warnings = [],
	notices = [],
	name = '',
	format = undefined
}) {
	const wantedMethod = toText(method).toUpperCase();
	const safeMethod = HTTP_METHODS.includes(wantedMethod) ? wantedMethod : 'GET';

	if (method && !HTTP_METHODS.includes(wantedMethod)) {
		notices.push(`Unsupported method "${method}"; GET was used instead.`);
	}

	let finalUrl = normalizeUrl(url, notices);
	if (!finalUrl) throw new Error('The file does not contain a URL.');
	if (UNRESOLVED_VARIABLE.test(finalUrl)) {
		notices.push(
			'The URL has variables that cannot be resolved here; replace them before sending.'
		);
	}

	const split = splitUrl(finalUrl, warnings);
	finalUrl = split.base;
	// Parámetros que venían aparte de la URL (`params` de axios, `-G` de curl).
	const queryRows = [...split.query, ...extraQuery];

	let headerRows = dropForbiddenHeaders(
		headers.map((header) => ({ key: header.key, value: header.value })),
		notices
	);

	const extracted = extractAuth(headerRows, notices);
	headerRows = extracted.headers;
	// curl y PowerShell generan el auth por su cuenta (`-u`, `$AuthValue`).
	const auth = authOverride ?? extracted.auth;

	if (
		UNRESOLVED_VARIABLE.test(auth.bearer.token) ||
		UNRESOLVED_VARIABLE.test(auth.basic.username) ||
		UNRESOLVED_VARIABLE.test(auth.basic.password)
	) {
		notices.push('The credentials contain unresolved variables; enter the real value.');
	}

	let body = emptyBody();
	const acceptsBody = !METHODS_WITHOUT_BODY.has(safeMethod);

	if (!acceptsBody) {
		if (toText(bodyText).trim() !== '' || formFields) {
			warnings.push(`${safeMethod} does not accept a body; the imported body was discarded.`);
		}
	} else {
		body = buildBody({
			contentType: headerRows.find((header) => header.key.toLowerCase() === 'content-type')?.value,
			text: bodyText,
			formFields,
			urlencodedParams,
			forcedType: forcedBodyType,
			warnings,
			notices
		});
	}

	// FormData y URLSearchParams fijan su propio Content-Type.
	if (body.selection === BODY_TYPES.FORM || body.selection === BODY_TYPES.URLENCODED) {
		headerRows = headerRows.filter((header) => header.key.toLowerCase() !== 'content-type');
	}

	return {
		format,
		method: safeMethod,
		url: finalUrl,
		data: { query: queryRows, headers: dedupeHeaders(headerRows), auth, body },
		name,
		warnings,
		notices
	};
}

/* -------------------------------------------------------------------------- */
/* Detección de formato                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Deduce el formato a partir del contenido y, si no es suficiente, de la
 * extensión del archivo (sirve para archivos escritos a mano o guardados como
 * `.txt`).
 *
 * @param {string} text
 * @param {string} [fileName]
 * @returns {'http'|'curl'|'powershell'|'fetch'|null}
 */
export function detectImportFormat(text, fileName = '') {
	const source = normalizeNewlines(text);
	const extension = extensionOf(fileName);

	// curl: el comando empieza una línea (propio, DevTools, Postman, Swagger).
	if (/^\s*(?:[A-Za-z_][A-Za-z0-9_]*=\S+\s+)*curl(?:\.exe)?\s/m.test(source)) return 'curl';
	if (/\bcurl\s+-{1,2}[A-Za-z]/.test(source)) return 'curl';

	// PowerShell: asignaciones, cmdlets de red o System.Net.Http.
	if (
		/^\s*\$[A-Za-z_][A-Za-z0-9_:]*\s*=/m.test(source) ||
		/\bInvoke-(RestMethod|WebRequest)\b/.test(source) ||
		/\[System\.Net\.Http\./.test(source) ||
		/\[(Convert|NET\.WebClient|System\.Net\.WebRequest)/.test(source)
	) {
		return 'powershell';
	}

	// JavaScript: fetch / axios.
	if (/(^|[^.\w])fetch\s*\(/.test(source) || /\baxios(\.\w+)?\s*\(/.test(source)) {
		return 'fetch';
	}

	// Línea de petición estilo `.http`.
	if (/^\s*(GET|POST|PUT|DELETE|PATCH|QUERY|HEAD|OPTIONS|TRACE|CONNECT)\s+\S+/m.test(source)) {
		return 'http';
	}

	if (extension === '.http' || extension === '.rest') return 'http';
	if (extension === '.ps1' || extension === '.psm1') return 'powershell';
	if (['.sh', '.bash', '.zsh', '.curl'].includes(extension)) return 'curl';
	if (['.js', '.mjs', '.cjs', '.ts'].includes(extension)) return 'fetch';

	return null;
}

/* -------------------------------------------------------------------------- */
/* Formato .http (REST Client, JetBrains, httpyac)                              */
/* -------------------------------------------------------------------------- */

/** Resuelve `{{variable}}` con las variables `@nombre = valor` del archivo. */
function interpolateHttp(text, variables, warnings) {
	return toText(text).replace(/\{\{([^{}]+)\}\}/g, (match, name) => {
		const key = name.trim();
		if (variables.has(key)) return variables.get(key);

		if (DYNAMIC_HTTP_VARIABLES.has(key) || key.startsWith('$')) {
			warnings.push(`The dynamic variable "${key}" was left as-is.`);
			return match;
		}

		warnings.push(`The variable "${key}" is not defined in the file; it was left as-is.`);
		return match;
	});
}

/** Divide un cuerpo `multipart/form-data` escrito a mano en campos. */
function parseMultipartText(text, boundary) {
	const delimiter = `--${boundary}`;
	const lines = normalizeNewlines(text).split('\n');
	const parts = [];
	let current = null;

	const flush = () => {
		if (current && current.name !== '') {
			parts.push({
				key: current.name,
				value: current.value.join('\n'),
				file: current.filename,
				mime: current.type || 'text'
			});
		}
		current = null;
	};

	for (const line of lines) {
		const trimmed = line.trim();

		if (trimmed.startsWith(delimiter)) {
			flush();
			if (trimmed === `${delimiter}--`) break;
			current = { name: '', value: [], filename: null, type: null };
			continue;
		}

		if (!current) continue;

		if (/^content-disposition:/i.test(trimmed)) {
			current.name =
				/name="([^"]*)"/i.exec(trimmed)?.[1] ?? /name=([^;]+)/i.exec(trimmed)?.[1]?.trim() ?? '';
			current.filename = /filename="([^"]*)"/i.exec(trimmed)?.[1] ?? null;
			if (!current.filename && /filename\*=/i.test(trimmed)) {
				current.filename = /filename\*=[^']*'[^']*'([^;\s]+)/i.exec(trimmed)?.[1] ?? null;
			}
			continue;
		}

		if (/^content-type:/i.test(trimmed)) {
			current.type = trimmed.slice(trimmed.indexOf(':') + 1).trim();
			continue;
		}

		// Hasta la primera línea en blanco sólo hay cabeceras de la parte.
		if (current.type === null && current.filename === null && current.value.length === 0) {
			if (trimmed === '' || /^[A-Za-z-]+:/.test(trimmed)) continue;
		}

		current.value.push(line);
	}

	flush();
	return parts;
}

/**
 * Parsea un archivo `.http`.
 *
 * @param {string} source
 * @param {{fileName?: string}} [options]
 */
export function parseHttpRequest(source, { fileName = '' } = {}) {
	const text = normalizeNewlines(source);
	const warnings = [];
	const notices = [];
	const variables = new Map();
	const lines = text.split('\n');

	// Cualquier verbo seguido de URL vale como línea de petición: si no está en
	// la lista admitida, `assemble` avisa y usa GET.
	const requestLinePattern = /^\s*([A-Za-z][A-Za-z-]*)\s+(\S+)/;
	const variablePattern = /^\s*@([A-Za-z_][A-Za-z0-9_.-]*)\s*=\s*(.*)$/;

	// 1. Variables de archivo: sólo antes de la primera petición (el cuerpo de una
	//    petición puede contener líneas que empiezan por `@`).
	const contentLines = [];
	let collectingVariables = true;
	for (const line of lines) {
		if (collectingVariables && requestLinePattern.test(line)) collectingVariables = false;
		if (collectingVariables) {
			const match = variablePattern.exec(line);
			if (match) {
				variables.set(match[1], unquote(match[2]));
				continue;
			}
		}
		contentLines.push(line);
	}

	// 2. Separación de solicitudes por `###`.
	const blocks = [];
	let current = [];
	for (const line of contentLines) {
		if (/^\s*#{2,}/.test(line)) {
			if (current.some((item) => item.trim() !== '')) blocks.push(current);
			current = [];
			continue;
		}
		current.push(line);
	}
	if (current.some((item) => item.trim() !== '')) blocks.push(current);

	if (blocks.length === 0) throw new Error('No request was found in the .http file.');
	if (blocks.length > 1) {
		notices.push(`The file has ${blocks.length} requests; only the first one was imported.`);
	}

	const block = blocks[0];

	// 3. Línea de petición, saltando líneas vacías y comentarios.
	let requestIndex = -1;
	for (let index = 0; index < block.length; index += 1) {
		const line = block[index].trim();
		if (line === '' || line.startsWith('//')) continue;
		if (requestLinePattern.test(line)) {
			requestIndex = index;
			break;
		}
	}

	if (requestIndex === -1) throw new Error('No request line was found in the .http file.');

	const separator = requestLinePattern.exec(block[requestIndex].trim());
	const method = separator[1].toUpperCase();
	let url = separator[2].replace(/\s+HTTP\/[\d.]+\s*$/i, '').trim();

	// Nombre de la solicitud: `### Get users` en la línea anterior.
	let name = fileName;
	if (requestIndex > 0) {
		const previous = block[requestIndex - 1].trim();
		if (previous.startsWith('#')) name = previous.replace(/^#+\s*/, '') || fileName;
	}

	// 4. Cabeceras hasta la primera línea en blanco.
	const headers = [];
	let cursor = requestIndex + 1;
	for (; cursor < block.length; cursor += 1) {
		const line = block[cursor];
		if (line.trim() === '') {
			cursor += 1;
			break;
		}
		const match = /^\s*([^:]+):\s*(.*)$/.exec(line);
		if (match) headers.push({ key: match[1].trim(), value: match[2].trim() });
	}

	// 5. Cuerpo: todo lo que queda hasta la siguiente solicitud.
	let bodyText = block.slice(cursor).join('\n').replace(/^\n+/, '').replace(/\s+$/, '');

	url = interpolateHttp(url, variables, warnings);
	const resolvedHeaders = headers.map((header) => ({
		key: interpolateHttp(header.key, variables, warnings),
		value: interpolateHttp(header.value, variables, warnings)
	}));

	// Cuerpo tomado de un archivo (`< ./data.json`).
	const fileReference = /^\s*<\s+(\S+)/.exec(bodyText);
	if (fileReference) {
		notices.push(`The body pointed to the file "${fileReference[1]}"; select it in the Body tab.`);
		bodyText = '';
	}

	// Convenciones del REST Client para cuerpos XML (`<!--` ... `-->`).
	if (/^\s*<!--/.test(bodyText) && /-->\s*$/.test(bodyText)) {
		bodyText = bodyText
			.replace(/^\s*<!--\n?/, '')
			.replace(/-->\s*$/, '')
			.replace(/^\n+|\n+$/g, '');
	}

	const contentType = resolvedHeaders.find(
		(header) => header.key.toLowerCase() === 'content-type'
	)?.value;

	let formFields = null;
	if (toText(contentType).toLowerCase().startsWith(MIME_MULTIPART)) {
		const boundary = /boundary="?([^";]+)"?/i.exec(toText(contentType))?.[1];
		if (boundary) {
			formFields = parseMultipartText(bodyText, boundary);
			if (formFields.length === 0) notices.push('The multipart body was empty.');
		}
	}

	return assemble({
		format: 'http',
		method,
		url,
		headers: resolvedHeaders,
		bodyText,
		formFields,
		warnings,
		notices,
		name
	});
}

/* -------------------------------------------------------------------------- */
/* Formato curl                                                                */
/* -------------------------------------------------------------------------- */

const CURL_LONG_VALUE = new Set([
	'--request',
	'--header',
	'--data',
	'--data-raw',
	'--data-ascii',
	'--data-binary',
	'--data-urlencode',
	'--json',
	'--form',
	'--form-string',
	'--user',
	'--user-agent',
	'--cookie',
	'--referer',
	'--proxy',
	'--proxy-user',
	'--upload-file',
	'--url',
	'--output',
	'--write-out',
	'--max-time',
	'--connect-timeout',
	'--cert',
	'--key',
	'--cacert',
	'--resolve',
	'--interface',
	'--limit-rate',
	'--max-redirs',
	'--retry',
	'--retry-delay',
	'--continue-at',
	'--dump-header',
	'--config',
	'--local-port',
	'--time-cond',
	'--ftp-port',
	'--quote'
]);

const CURL_SHORT_VALUE = new Set([
	'X',
	'H',
	'd',
	'F',
	'u',
	'A',
	'b',
	'e',
	'x',
	'y',
	'z',
	'T',
	'o',
	'm',
	'E',
	'w',
	'c',
	'C',
	'D',
	'K',
	'P',
	't',
	'Q',
	'a',
	'U',
	'V'
]);

const CURL_SHORT_FLAG = new Set([
	's',
	'S',
	'v',
	'i',
	'I',
	'L',
	'k',
	'g',
	'G',
	'f',
	'4',
	'6',
	'N',
	'0',
	'O',
	'J',
	'j',
	'B',
	'R',
	'q',
	'h',
	'#',
	':',
	'%'
]);

/** Quita el envoltorio `$(cat ...)` que usan algunos exportadores. */
function unwrapCat(value) {
	const match = /^\$\(\s*cat\b([\s\S]*)\)$/.exec(value.trim());
	return match ? match[1].replace(/^\n/, '').replace(/\n$/, '') : value;
}

/**
 * Resuelve el valor de una opción de datos de curl, incluidos los heredocs
 * (`--data-binary @- <<'EOF'` y `--data-binary "$(cat <<'EOF' ...)"`).
 */
function resolveCurlData(rawValue, peekValue, bodies, context) {
	const peek = heredocIndexOf(peekValue);
	if (peek) return bodies[Number(peek[1])];

	const own = heredocIndexOf(rawValue);
	if (own) {
		// El marcador deja espacios sobrantes alrededor: se limpian del cuerpo.
		return unwrapCat(restoreHeredocs(rawValue, bodies)).trim();
	}

	const text = toText(rawValue);
	if (!text.startsWith('@')) return text;

	const file = text.slice(1);
	if (file === '-') {
		context.notices.push('The body was read from stdin; nothing was imported.');
		return '';
	}
	context.notices.push(`The body pointed to the file "${file}"; select it in the Body tab.`);
	context.warnings.push('A body read from a file cannot be imported automatically.');
	return '';
}

/** Interpreta un valor `-F name=@archivo` / `-F name=(literal)`. */
function readCurlFormField(value, notices) {
	const text = toText(value);
	const separator = text.indexOf('=');
	if (separator === -1) {
		notices.push(`The form field "${text}" has no value and was discarded.`);
		return null;
	}

	const key = text.slice(0, separator);
	const rest = text
		.slice(separator + 1)
		.replace(/;type=[^;]*/gi, '')
		.replace(/;filename=[^;]*/gi, '');

	if (rest.startsWith('@') || rest.startsWith('<')) {
		const file = rest.slice(1).replace(/^["']|["']$/g, '');
		return { key, value: '', file: file.split('/').pop() };
	}

	if (rest.startsWith('(') && rest.endsWith(')')) {
		return { key, value: rest.slice(1, -1) };
	}

	return { key, value: rest };
}

/**
 * Parsea un comando `curl` (propio, DevTools, Postman, Swagger o escrito a mano).
 *
 * @param {string} source
 * @param {{fileName?: string}} [options]
 */
export function parseCurlRequest(source, { fileName = '' } = {}) {
	const warnings = [];
	const notices = [];
	const context = { warnings, notices };
	const { source: withoutHeredocs, bodies } = extractHeredocs(stripBom(source));
	const tokens = tokenizeShell(stripShellComments(withoutHeredocs));

	// Todo lo anterior al comando `curl` (shebang, `set -e`, variables) se ignora.
	const commandIndex = tokens.findIndex((token) => /^curl(\.exe)?$/i.test(token));
	if (commandIndex === -1) throw new Error('No curl command was found in the file.');

	const state = {
		method: '',
		urls: [],
		headers: [],
		data: [],
		urlencode: [],
		forms: [],
		user: '',
		flags: new Set(),
		unknown: new Set(),
		commands: 0
	};

	const addHeader = (key, value) => {
		const text = toText(value);
		if (!text.trim()) return; // `Header:` vacío: curl lo usa para borrar la cabecera
		state.headers.push({ key: toText(key).trim(), value: text });
	};

	const handleOption = (name, rawValue, peekValue) => {
		switch (name) {
			case '-X':
			case '--request':
				state.method = toText(rawValue).toUpperCase();
				break;
			case '--url':
				state.urls.push(toText(rawValue));
				break;
			case '-H':
			case '--header': {
				const text = toText(rawValue);
				const separator = text.indexOf(':');
				if (separator === -1) state.unknown.add(name);
				else addHeader(text.slice(0, separator), text.slice(separator + 1));
				break;
			}
			case '-A':
			case '--user-agent':
				addHeader('User-Agent', rawValue);
				break;
			case '-b':
			case '--cookie':
				addHeader('Cookie', rawValue);
				break;
			case '-e':
			case '--referer':
				addHeader('Referer', rawValue);
				break;
			case '-d':
			case '--data':
			case '--data-raw':
			case '--data-ascii':
			case '--data-binary':
				state.data.push(resolveCurlData(rawValue, peekValue, bodies, context));
				break;
			case '--json':
				state.data.push(resolveCurlData(rawValue, peekValue, bodies, context));
				if (!state.method) state.method = 'POST';
				if (!state.headers.some((header) => header.key.toLowerCase() === 'content-type')) {
					state.headers.push({ key: 'Content-Type', value: MIME_JSON });
					state.headers.push({ key: 'Accept', value: MIME_JSON });
				}
				break;
			case '--data-urlencode':
				state.urlencode.push(toText(rawValue));
				break;
			case '-F':
			case '--form':
			case '--form-string': {
				const field = readCurlFormField(rawValue, notices);
				if (field) state.forms.push(field);
				break;
			}
			case '-u':
			case '--user':
				state.user = toText(rawValue);
				break;
			case '-T':
			case '--upload-file':
				state.forms.push({ key: 'file', value: '', file: toText(rawValue).split('/').pop() });
				if (!state.method) state.method = 'PUT';
				break;
			default:
				state.unknown.add(name);
				break;
		}
	};

	for (let index = commandIndex + 1; index < tokens.length; index += 1) {
		const token = tokens[index];

		if (/^curl(\.exe)?$/i.test(token)) {
			state.commands += 1;
			continue;
		}

		if (token === '--') {
			if (tokens[index + 1]) state.urls.push(tokens[index + 1]);
			index += 1;
			continue;
		}

		if (token.startsWith('--')) {
			const equals = token.indexOf('=');
			const name = equals === -1 ? token : token.slice(0, equals);
			if (CURL_LONG_VALUE.has(name)) {
				const inline = equals !== -1 ? token.slice(equals + 1) : null;
				const value = inline ?? tokens[index + 1] ?? '';
				if (inline === null) index += 1;
				handleOption(name, value, tokens[index + 1]);
			} else {
				state.flags.add(name);
			}
			continue;
		}

		if (token.startsWith('-') && token.length > 1) {
			// Opciones cortas agrupadas: `-sSLk`, `-XPOST`, `-H'Accept: x'`.
			for (let cursor = 1; cursor < token.length; cursor += 1) {
				const letter = token[cursor];
				const short = `-${letter}`;
				if (CURL_SHORT_VALUE.has(letter)) {
					const attached = token.slice(cursor + 1);
					const value = attached !== '' ? attached : (tokens[index + 1] ?? '');
					if (attached === '') index += 1;
					handleOption(short, value, tokens[index + 1]);
					break;
				}
				if (CURL_SHORT_FLAG.has(letter)) {
					state.flags.add(short);
					continue;
				}
				state.unknown.add(short);
			}
			continue;
		}

		// `@archivo` y los marcadores de heredoc no son URLs aunque no lleven guion.
		if (token.startsWith('@') || /^heredoc-\d+$/.test(token)) continue;

		state.urls.push(token);
	}

	if (state.commands > 0) {
		notices.push(`The file has ${state.commands + 1} curl commands; only the first was imported.`);
	}
	if (state.unknown.size > 0) {
		notices.push(`Options not taken into account: ${[...state.unknown].join(', ')}.`);
	}

	const candidates = state.urls.filter((url) => url.trim() !== '');
	if (candidates.length === 0) throw new Error('No URL was found in the curl command.');
	if (candidates.length > 1) {
		notices.push('The command had more than one URL; only the first one was imported.');
	}
	let url = candidates[0];

	// `-G` / `--get`: los datos van a la query, no al cuerpo.
	const asQuery = state.flags.has('-G') || state.flags.has('--get');
	let bodyText = state.data.join('&');
	let formFields = state.forms.length > 0 ? state.forms : null;
	let urlencodedParams = null;

	const appendQuery = (pairs) => {
		const search = new URLSearchParams();
		for (const pair of pairs) search.append(pair.key, pair.value);
		const query = search.toString();
		if (query) url = `${url}${url.includes('?') ? '&' : '?'}${query}`;
	};

	if (asQuery && bodyText !== '') {
		appendQuery(
			bodyText
				.split('&')
				.filter((part) => part !== '')
				.map((part) => {
					const separator = part.indexOf('=');
					return {
						key: separator === -1 ? part : part.slice(0, separator),
						value: separator === -1 ? '' : part.slice(separator + 1)
					};
				})
		);
		bodyText = '';
		formFields = null;
		urlencodedParams = null;
	}

	if (state.urlencode.length > 0) {
		const params = [];
		for (const item of state.urlencode) {
			if (item.startsWith('@')) {
				notices.push(`The urlencoded data pointed to the file "${item.slice(1)}".`);
				continue;
			}
			const separator = item.indexOf('=');
			params.push({
				key: separator === -1 ? item : item.slice(0, separator),
				value: separator === -1 ? '' : item.slice(separator + 1)
			});
		}

		if (asQuery) appendQuery(params);
		else if (bodyText !== '' || formFields) {
			appendQuery(params);
			notices.push('The command mixed --data and --data-urlencode; the latter went to the query.');
		} else {
			urlencodedParams = params;
		}
	}

	const hasContentType = state.headers.some(
		(header) => header.key.toLowerCase() === 'content-type'
	);
	if (formFields && !hasContentType) {
		state.headers.push({ key: 'Content-Type', value: MIME_MULTIPART });
	}
	// curl envía `-d` como `application/x-www-form-urlencoded`, salvo que el
	// cuerpo sea JSON (snippets copiados de blogs que omiten la cabecera).
	if (bodyText !== '' && !hasContentType && !formFields) {
		state.headers.push({
			key: 'Content-Type',
			value: isJsonLike(bodyText) ? MIME_JSON : MIME_URLENCODED
		});
	}

	let method = state.method;
	if (!method) {
		if (state.flags.has('-I') || state.flags.has('--head')) method = 'HEAD';
		else if (bodyText !== '' || formFields || urlencodedParams) method = 'POST';
		else method = 'GET';
	}

	if (state.user) {
		const auth = emptyAuth();
		authFromUser(state.user, auth, notices);
		state.headers = state.headers.filter((header) => header.key.toLowerCase() !== 'authorization');
		state.auth = auth;
	}

	return assemble({
		format: 'curl',
		method,
		url,
		headers: state.headers,
		bodyText,
		formFields,
		urlencodedParams,
		warnings,
		notices,
		name: fileName,
		auth: state.auth
	});
}

/* -------------------------------------------------------------------------- */
/* Formato PowerShell                                                          */
/* -------------------------------------------------------------------------- */

/** Localiza here-strings (`@'...'@` / `@"..."@`) y guarda su contenido. */
function readPowerShellHereStrings(text, variables, warnings) {
	const pattern = /^[ \t]*(\$[A-Za-z_][A-Za-z0-9_]*)[ \t]*=[ \t]*@(['"])\r?\n/gm;
	const ranges = [];
	let match;

	while ((match = pattern.exec(text)) !== null) {
		const name = match[1].slice(1);
		const quote = match[2];
		const rest = text.slice(match.index + match[0].length);
		const lines = rest.split('\n');
		const body = [];
		let consumed = 0;
		let closed = false;

		for (let index = 0; index < lines.length; index += 1) {
			if (lines[index].trimEnd() === `${quote}@`) {
				closed = true;
				consumed = lines.slice(0, index + 1).join('\n').length + (index < lines.length - 1 ? 1 : 0);
				break;
			}
			body.push(lines[index]);
		}

		if (!closed) {
			warnings.push(`The here-string of $${name} is not closed; it was discarded.`);
			break;
		}

		variables.set(name.toLowerCase(), { kind: 'string', value: body.join('\n') });
		ranges.push({ start: match.index, end: match.index + match[0].length + consumed });
	}

	return ranges;
}

/** Quita los fragmentos reemplazados por variables ya resueltas. */
function withoutRanges(text, ranges) {
	if (ranges.length === 0) return text;
	let result = '';
	let cursor = 0;
	for (const range of ranges) {
		result += text.slice(cursor, range.start);
		cursor = range.end;
	}
	return result + text.slice(cursor);
}

/** Recoleta `$nombre = valor` y los `$headers.Add(...)` del script. */
function collectPowerShellVariables(text) {
	const variables = new Map();
	let match;

	// `$headers.Add([System...KeyValuePair[string,string]]::new('K', 'V'))`
	const addPattern =
		/\$([A-Za-z_][A-Za-z0-9_]*)\s*\.\s*Add\(\s*\[[\s\S]*?KeyValuePair[\s\S]*?\]::\s*new\(\s*(['"])([\s\S]*?)\2\s*,\s*(['"])([\s\S]*?)\4\s*\)/g;
	while ((match = addPattern.exec(text)) !== null) {
		const entries = variables.get(match[1].toLowerCase())?.entries ?? [];
		entries.push({ key: match[3], value: match[5] });
		variables.set(match[1].toLowerCase(), { kind: 'pairs', entries });
	}

	// `$part = [System.Net.Http.StringContent]::new('valor')`
	const partPattern =
		/\$([A-Za-z_][A-Za-z0-9_]*)[ \t]*=[ \t]*\[[^\]]*StringContent\][ \t]*::[ \t]*new\([ \t]*(['"])([\s\S]*?)\2[ \t]*\)/g;
	while ((match = partPattern.exec(text)) !== null) {
		variables.set(match[1].toLowerCase(), { kind: 'string', value: match[3] });
	}

	// `$basic = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('u:p'))`
	const basicPattern =
		/\$([A-Za-z_][A-Za-z0-9_]*)[ \t]*=[ \t]*\[\s*Convert\s*\][ \t]*::[ \t]*ToBase64String\([\s\S]*?GetBytes\([ \t]*(['"])([\s\S]*?)\2/g;
	while ((match = basicPattern.exec(text)) !== null) {
		variables.set(match[1].toLowerCase(), { kind: 'string', value: match[3] });
	}

	// Asignaciones: `$nombre = valor`. El valor se lee con el lector de
	// PowerShell (así los hashtables y arrays multilínea se capturan enteros).
	const assignPattern = /^[ \t]*\$([A-Za-z_][A-Za-z0-9_]*)[ \t]*=[ \t]/gm;
	while ((match = assignPattern.exec(text)) !== null) {
		const name = match[1].toLowerCase();
		const existing = variables.get(name);
		if (existing && (existing.kind === 'pairs' || existing.kind === 'string')) continue;

		const value = readPowerShellValue(text, match.index + match[0].length);
		if (value.value == null || value.value === '') continue;

		// Operador de formato: `'{0}:{1}' -f 'user', 'pass'`.
		const formatOperator = /^[ \t]*-[ \t]*f[ \t]+([^\n]*)/.exec(text.slice(value.end));
		if (formatOperator) {
			variables.set(name, { kind: 'raw', value: `${value.raw} -f ${formatOperator[1]}` });
			continue;
		}

		if (value.value && typeof value.value === 'object' && !Array.isArray(value.value)) {
			variables.set(name, { kind: 'hashtable', value: value.value });
			continue;
		}
		if (Array.isArray(value.value)) {
			variables.set(name, { kind: 'raw', value: value.raw });
			continue;
		}
		if (typeof value.value === 'object') {
			variables.set(name, { kind: 'raw', value: value.raw });
			continue;
		}

		const raw = value.raw ?? toText(value.value);
		if (raw.trim().startsWith('[') || raw.includes('(')) {
			variables.set(name, { kind: 'raw', value: raw.trim() });
			continue;
		}
		variables.set(name, { kind: 'string', value: toText(value.value) });
	}

	return variables;
}

/** Divide una lista de argumentos de PowerShell respetando comas y comillas. */
function splitPowerShellArguments(text) {
	const parts = [];
	let current = '';
	let quote = '';
	let depth = 0;

	for (const char of toText(text)) {
		if (quote) {
			current += char;
			if (char === quote) quote = '';
			continue;
		}
		if (char === "'" || char === '"') {
			quote = char;
			current += char;
			continue;
		}
		if (char === '(' || char === '[' || char === '{') depth += 1;
		if (char === ')' || char === ']' || char === '}') depth -= 1;
		if (char === ',' && depth === 0) {
			parts.push(current.trim());
			current = '';
			continue;
		}
		current += char;
	}

	if (current.trim() !== '') parts.push(current.trim());
	return parts.map((part) => (isQuoted(part) ? unquote(part) : part));
}

/**
 * Evalúa las expresiones de PowerShell que aparecen en scripts copiados de
 * tutoriales: el operador de formato `-f` y las conversiones de base64.
 *
 * @param {string} text
 * @param {Map<string, object>} variables
 * @param {number} [depth]
 * @returns {string}
 */
function evaluatePowerShellExpression(text, variables, depth = 0) {
	const source = interpolatePowerShellText(toText(text).trim(), variables, depth + 1);

	const format = /^(['"])([\s\S]*?)\1\s*-f\s+([\s\S]+)$/.exec(source);
	if (format) {
		const args = splitPowerShellArguments(format[3]);
		return format[2].replace(/\{(\d+)\}/g, (whole, index) => args[Number(index)] ?? whole);
	}

	const toBase64 = /ToBase64String\([\s\S]*?GetBytes\(([\s\S]*)\)\s*\)/.exec(source);
	if (toBase64) {
		const plain = toBase64[1].trim().replace(/^['"]|['"]$/g, '');
		return encodeBase64(plain);
	}

	if (/FromBase64String/.test(source)) {
		return decodeBase64(/(['"])([\s\S]*?)\1/.exec(source)?.[2] ?? '') ?? '';
	}

	return source;
}

/**
 * Sustituye `$variable` y `${variable}` dentro de un texto de PowerShell
 * (doble comilla, concatenaciones y valores de hashtable).
 *
 * @param {string} text
 * @param {Map<string, object>} variables
 * @param {number} [depth]
 * @returns {string}
 */
function interpolatePowerShellText(text, variables, depth = 0) {
	const source = toText(text);
	if (!source.includes('$') || depth > 4) return source;

	return source.replace(
		/\$(?:\{([A-Za-z_][A-Za-z0-9_:]*)\}|([A-Za-z_][A-Za-z0-9_:]*))/g,
		(match, braced, plain) => {
			const entry = variables.get((braced ?? plain).toLowerCase());
			if (!entry) return match;
			if (entry.kind === 'string') return entry.value;
			if (entry.kind === 'raw')
				return evaluatePowerShellExpression(entry.value, variables, depth + 1);
			return match;
		}
	);
}

/** Resuelve un valor de PowerShell a texto plano. */
function resolvePowerShellValue(token, variables, depth = 0) {
	if (token == null) return '';
	if (depth > 6) return '';

	const text = toText(token).trim();
	if (text === '') return '';

	if (text.includes('ConvertTo-Json')) {
		// `@{ a = 1 } | ConvertTo-Json -Depth 5`
		const table = readPowerShellHashtable(text.split('|')[0], 0).value;
		return table ? JSON.stringify(table, null, 2) : '';
	}
	if (text.startsWith('@{')) {
		const table = readPowerShellHashtable(text, 0).value;
		return table ? JSON.stringify(table) : '';
	}
	if (isQuoted(text)) return unquote(text);
	if (text.startsWith('(') && text.endsWith(')')) {
		return resolvePowerShellValue(text.slice(1, -1), variables, depth + 1);
	}

	const variable = /^\$([A-Za-z_][A-Za-z0-9_:]*)$/.exec(text);
	if (variable) {
		const entry = variables.get(variable[1].toLowerCase());
		if (!entry) return '';
		if (entry.kind === 'raw') return entry.value;
		if (entry.kind === 'hashtable') return JSON.stringify(entry.value);
		return resolvePowerShellValue(
			`'${toText(entry.value).replace(/'/g, "''")}'`,
			variables,
			depth + 1
		);
	}

	if (text.includes('FromBase64String')) {
		const encoded = /(['"])([\s\S]*?)\1/.exec(text);
		return encoded ? (decodeBase64(encoded[2]) ?? '') : '';
	}

	return text;
}

/** Extrae los parámetros de un cmdlet (`-Uri`, `-Body`, `-Headers`, ...). */
function readPowerShellParameters(command) {
	const parameters = {
		uri: '',
		method: '',
		headers: [],
		body: '',
		form: '',
		contenttype: '',
		infile: ''
	};

	const names = {
		uri: ['-Uri', '-Url', '-ResourceUri', '-BaseUri'],
		method: ['-Method', '-CustomMethod', '-HttpMethod'],
		headers: ['-Headers', '-Header', '-AdditionalHeaders'],
		body: ['-Body', '-Payload'],
		form: ['-Form'],
		contenttype: ['-ContentType', '-MediaType'],
		infile: ['-InFile', '-UploadFile']
	};

	const flat = normalizeNewlines(command);

	for (const [key, aliases] of Object.entries(names)) {
		for (const alias of aliases) {
			const match = new RegExp(`${escapeRegExp(alias)}(?![\\w-])`, 'i').exec(flat);
			if (!match) continue;

			let cursor = match.index + alias.length;
			while (cursor < flat.length && /[ \t]/.test(flat[cursor])) cursor += 1;

			// Varios `-Headers @{...}` seguidos se acumulan.
			if (flat.slice(cursor, cursor + 2) === '@{') {
				const block = readBalanced(flat, cursor + 1, '{', '}', 'powerShell');
				const chunk = flat.slice(cursor, block.end);
				if (key === 'headers') parameters.headers.push(chunk);
				else parameters[key] = chunk;
				continue;
			}

			if (flat[cursor] === '(') {
				const block = readBalanced(flat, cursor, '(', ')', 'powerShell');
				if (key === 'headers') parameters.headers.push(flat.slice(cursor, block.end));
				else parameters[key] = flat.slice(cursor, block.end);
				continue;
			}

			if (flat[cursor] === "'") {
				const block = readSingleQuoted(flat, cursor + 1, 'powerShell');
				if (key === 'headers') parameters.headers.push(flat.slice(cursor, block.end));
				else parameters[key] = flat.slice(cursor, block.end);
				continue;
			}

			if (flat[cursor] === '"') {
				const block = readPowerShellDoubleQuoted(flat, cursor + 1);
				if (key === 'headers') parameters.headers.push(flat.slice(cursor, block.end));
				else parameters[key] = flat.slice(cursor, block.end);
				continue;
			}

			const word = /^[^\s]+/.exec(flat.slice(cursor));
			if (!word) continue;
			if (key === 'headers') parameters.headers.push(word[0]);
			else parameters[key] = word[0];
		}
	}

	return parameters;
}

/** Aplana una entrada de cabecera (texto, hashtable o `$headers`). */
function pushPowerShellHeader(headers, value, variables) {
	if (typeof value === 'string' && value.startsWith('@{')) {
		const table = readPowerShellHashtable(value, 0).value;
		if (table) {
			for (const [key, item] of Object.entries(table)) {
				if (item == null || typeof item === 'object') continue;
				headers.push({ key, value: interpolatePowerShellText(toText(item), variables) });
			}
		}
		return;
	}

	const name = toText(value).replace(/^\$/, '');
	const entry = variables.get(name.toLowerCase());
	if (!entry) return;

	if (entry.kind === 'pairs') {
		for (const item of entry.entries) headers.push({ key: item.key, value: item.value });
	} else if (entry.kind === 'hashtable' && entry.value) {
		for (const [key, item] of Object.entries(entry.value)) {
			if (item == null || typeof item === 'object') continue;
			headers.push({ key, value: interpolatePowerShellText(toText(item), variables) });
		}
	}
}

/**
 * Parsea un script de PowerShell: el generado por RESTTester,
 * `Invoke-RestMethod` e `Invoke-WebRequest`.
 *
 * @param {string} source
 * @param {{fileName?: string}} [options]
 */
export function parsePowerShellRequest(source, { fileName = '' } = {}) {
	const text = normalizeNewlines(source);
	const warnings = [];
	const notices = [];

	const variables = new Map();
	const ranges = readPowerShellHereStrings(text, variables, warnings);
	for (const [key, value] of collectPowerShellVariables(withoutRanges(text, ranges))) {
		variables.set(key, value);
	}
	const vars = variables;

	const read = (name) => vars.get(toText(name).toLowerCase());
	/** Valor de una variable ya resuelto a texto (interpola `$var` anidados). */
	const readText = (name) => {
		const entry = read(name);
		if (!entry) return '';
		if (entry.kind === 'string') return interpolatePowerShellText(entry.value, vars);
		if (entry.kind === 'raw') return evaluatePowerShellExpression(entry.value, vars);
		return '';
	};

	const headers = [];
	let method = '';
	let url = resolvePowerShellValue(
		readText('url') || readText('uri') || readText('endpoint'),
		vars
	);
	let bodyText = '';
	let contentType = '';
	let formFields = null;
	let urlencodedParams = null;
	let explicitBody = false;

	// Cabeceras del script generado por RESTTester y de `$headers = @{...}`.
	for (const [name, entry] of vars) {
		if (entry.kind === 'pairs') {
			for (const item of entry.entries) headers.push({ key: item.key, value: item.value });
		} else if (entry.kind === 'hashtable' && name === 'headers' && entry.value) {
			for (const [key, item] of Object.entries(entry.value)) {
				if (item == null || typeof item === 'object') continue;
				headers.push({ key, value: interpolatePowerShellText(toText(item), vars) });
			}
		}
	}

	method = resolvePowerShellValue(readText('method'), vars).toUpperCase();

	// Media type de `[StringContent]::new($body, [Text.Encoding]::UTF8, 'application/json')`.
	const mediaType =
		/\[(?:[A-Za-z0-9.]*\.)?StringContent\][ \t]*::[ \t]*new\([ \t]*\$[A-Za-z_][A-Za-z0-9_]*[ \t]*,[ \t]*\[[^\]]*\][ \t]*::[ \t]*\w+[ \t]*,[ \t]*(['"])([\s\S]*?)\1/.exec(
			text
		);
	if (mediaType) contentType = mediaType[2];
	if (readText('contenttype')) contentType = resolvePowerShellValue(readText('contenttype'), vars);

	// Cuerpo multipart (exportación de RESTTester).
	if (/\[(?:[A-Za-z0-9.]*\.)?MultipartFormDataContent\][ \t]*::[ \t]*new\([ \t]*\)/.test(text)) {
		const fields = [];
		const addFile =
			/\$content[ \t]*\.[ \t]*Add\([ \t]*\$fileContent[ \t]*,[ \t]*(['"])([\s\S]*?)\1(?:[ \t]*,[ \t]*(['"])([\s\S]*?)\3)?[ \t]*\)/g;
		let match;
		while ((match = addFile.exec(text)) !== null) {
			fields.push({ key: match[2], value: '', file: match[4] ?? 'archivo' });
		}
		const partValue = resolvePowerShellValue(readText('part'), vars);
		const addField =
			/\$content[ \t]*\.[ \t]*Add\([ \t]*\$part[ \t]*,[ \t]*(['"])([\s\S]*?)\1[ \t]*\)/g;
		while ((match = addField.exec(text)) !== null) {
			fields.push({ key: match[2], value: partValue });
		}
		if (fields.length > 0) {
			formFields = fields;
			contentType = MIME_MULTIPART;
		}
	}

	if (!formFields) {
		const bodyVariable = read('bodytext') || read('body') || read('payload');
		if (bodyVariable) {
			bodyText =
				bodyVariable.kind === 'hashtable'
					? JSON.stringify(bodyVariable.value, null, 2)
					: resolvePowerShellValue(
							bodyVariable.kind === 'string'
								? `'${bodyVariable.value.replace(/'/g, "''")}'`
								: bodyVariable.value,
							vars
						);
			explicitBody = bodyText !== '';
		}
	}

	// Cmdlets de red: `Invoke-RestMethod -Uri ... -Method ... -Headers ... -Body ...`
	// Se corta en el primer salto que no continúa con otro parámetro.
	const invokePattern =
		/(?:^|\n)[ \t]*(?:Invoke-RestMethod|Invoke-WebRequest|iwr|irm)\b[\s\S]*?(?=\n(?![ \t]*-)|$)/g;
	let sawInvoke = false;

	for (const match of text.matchAll(invokePattern)) {
		sawInvoke = true;
		const parameters = readPowerShellParameters(match[0]);

		if (parameters.uri && !url) {
			url = resolvePowerShellValue(parameters.uri, vars);
		}
		if (parameters.method && !method) {
			method = resolvePowerShellValue(parameters.method, vars).toUpperCase();
		}
		if (parameters.contenttype && !contentType) {
			contentType = resolvePowerShellValue(parameters.contenttype, vars);
		}
		for (const headerParameter of parameters.headers) {
			pushPowerShellHeader(headers, headerParameter, vars);
		}

		if (parameters.form && !formFields) {
			const table = readPowerShellHashtable(parameters.form, 0).value;
			if (table) {
				formFields = Object.entries(table).map(([key, value]) => {
					if (typeof value === 'string' && /Get-Item|Get-Content/i.test(value)) {
						const file = /(['"])([^'"]+)\1/.exec(value)?.[2] ?? 'archivo';
						return { key, value: '', file: file.split(/[\\/]/).pop() };
					}
					return { key, value: toText(value) };
				});
				contentType = MIME_MULTIPART;
			}
		}

		if (parameters.infile && !formFields) {
			const file = resolvePowerShellValue(parameters.infile, vars);
			formFields = [{ key: 'file', value: '', file: file.split(/[\\/]/).pop() }];
			contentType = MIME_MULTIPART;
		}

		if (parameters.body && !explicitBody) {
			const isVariable = parameters.body.startsWith('$');
			const entry = isVariable ? read(parameters.body.slice(1)) : null;
			bodyText = entry
				? entry.kind === 'hashtable'
					? JSON.stringify(entry.value, null, 2)
					: resolvePowerShellValue(`'${toText(entry.value).replace(/'/g, "''")}'`, vars)
				: resolvePowerShellValue(parameters.body, vars);
			explicitBody = bodyText !== '';
		}
	}

	if (!url) throw new Error('No URL was found in the PowerShell script.');

	// Autenticación: `$AuthValue = 'Bearer ...'`, `-u` o cabecera Authorization.
	const auth = emptyAuth();
	const authValue = resolvePowerShellValue(readText('authvalue'), vars).trim();

	if (/^bearer\s+/i.test(authValue)) {
		auth.selection = AUTH_TYPES.BEARER;
		auth.bearer.token = authValue.replace(/^bearer\s+/i, '').trim();
	} else if (/^basic\s+/i.test(authValue)) {
		const decoded = decodeBase64(authValue.replace(/^basic\s+/i, '').trim());
		const literal = readText('basiccredentials');
		const pair = decoded && decoded.includes(':') ? decoded : literal;
		if (pair && pair.includes(':')) {
			auth.selection = AUTH_TYPES.BASIC;
			const separator = pair.indexOf(':');
			auth.basic.username = pair.slice(0, separator);
			auth.basic.password = pair.slice(separator + 1);
		} else {
			headers.push({ key: 'Authorization', value: authValue });
		}
	} else if (authValue !== '') {
		headers.push({ key: 'Authorization', value: authValue });
	}

	const credentials = readText('username') || readText('user');
	if (credentials) {
		authFromUser(
			`${credentials}:${resolvePowerShellValue(readText('password'), vars)}`,
			auth,
			notices
		);
	}

	const hasAuthHeader = headers.some(
		(header) => toText(header.key).trim().toLowerCase() === 'authorization'
	);
	if (hasAuthHeader && auth.selection === AUTH_TYPES.NONE) {
		const extracted = extractAuth(headers, notices);
		auth.selection = extracted.auth.selection;
		auth.bearer.token = extracted.auth.bearer.token;
		auth.basic.username = extracted.auth.basic.username;
		auth.basic.password = extracted.auth.basic.password;
	}

	if (!method) {
		method = bodyText.trim() !== '' || formFields ? 'POST' : 'GET';
		if (sawInvoke && method === 'POST') {
			notices.push('The script had no -Method; POST was assumed because there is a body.');
		}
	}

	if (!contentType) {
		const headerEntry = headers.find(
			(header) => toText(header.key).toLowerCase() === 'content-type'
		);
		if (headerEntry) contentType = headerEntry.value;
	}
	if (
		contentType &&
		!headers.some((header) => toText(header.key).toLowerCase() === 'content-type')
	) {
		headers.push({ key: 'Content-Type', value: contentType });
	}

	if (
		!formFields &&
		!urlencodedParams &&
		/^application\/x-www-form-urlencoded/i.test(contentType)
	) {
		const parsed = toText(bodyText)
			.split('&')
			.filter((part) => part !== '')
			.map((part) => {
				const separator = part.indexOf('=');
				return {
					key: safeDecode(separator === -1 ? part : part.slice(0, separator)),
					value: safeDecode(separator === -1 ? '' : part.slice(separator + 1))
				};
			});
		if (parsed.length > 0) urlencodedParams = parsed;
	}

	return assemble({
		format: 'powershell',
		method,
		url,
		headers,
		bodyText: formFields ? '' : bodyText,
		formFields,
		urlencodedParams,
		warnings,
		notices,
		name: fileName,
		auth
	});
}

/* -------------------------------------------------------------------------- */
/* Formato JavaScript (fetch / axios)                                          */
/* -------------------------------------------------------------------------- */

/** Localiza una llamada y devuelve sus argumentos de primer nivel. */
function findCallArguments(source, patterns) {
	for (const pattern of patterns) {
		const match = pattern.exec(source);
		if (!match) continue;
		const open = source.indexOf('(', match.index + match[0].length - 1);
		if (open === -1) continue;

		const args = [];
		let index = open + 1;
		const skipSpace = () => {
			while (index < source.length && /\s/.test(source[index])) index += 1;
		};

		skipSpace();
		while (index < source.length && source[index] !== ')') {
			const value = readJsValue(source, index);
			args.push(value.value);
			index = value.end;
			skipSpace();
			if (source[index] === ',') index += 1;
			skipSpace();
		}
		return { args };
	}
	return null;
}

const asPayload = (value) =>
	value != null && typeof value === 'object' ? JSON.stringify(value, null, 2) : toText(value);

/**
 * Parsea un fragmento `fetch(...)` o `axios(...)` (DevTools → "Copy as fetch",
 * ejemplos de Axios, etc.).
 *
 * @param {string} source
 * @param {{fileName?: string}} [options]
 */
export function parseFetchRequest(source, { fileName = '' } = {}) {
	const text = normalizeNewlines(source);
	const warnings = [];
	const notices = [];
	const headers = [];

	const addHeaders = (value) => {
		if (value == null) return;
		if (Array.isArray(value)) {
			for (const pair of value) {
				if (Array.isArray(pair) && pair.length >= 2) {
					headers.push({ key: toText(pair[0]), value: toText(pair[1]) });
				}
			}
			return;
		}
		if (typeof value === 'object') {
			for (const [key, item] of Object.entries(value)) {
				if (item == null || typeof item === 'object') continue;
				headers.push({ key, value: toText(item) });
			}
		}
	};

	let url = '';
	let method = '';
	let bodyText = '';
	let formFields = null;
	let urlencodedParams = null;
	const params = [];

	/** `params: { a: 1 }` de axios (o `query` de otras librerías). */
	const addParams = (value) => {
		if (value == null || typeof value !== 'object' || Array.isArray(value)) return;
		for (const [key, item] of Object.entries(value)) {
			if (item == null || typeof item === 'object') continue;
			params.push({ enabled: true, key, value: toText(item) });
		}
	};

	const fetchCall = findCallArguments(text, [/(^|[^.\w])fetch\s*\(/]);
	if (fetchCall) {
		url = toText(fetchCall.args[0]);
		const options = fetchCall.args[1];
		if (options && typeof options === 'object') {
			method = toText(options.method).toUpperCase();
			addHeaders(options.headers);
			if (options.body != null) bodyText = asPayload(options.body);
		}
	} else {
		const shorthand = /\baxios\.(get|post|put|patch|delete|head|options)\s*\(/.exec(text);
		const axiosCall = findCallArguments(text, [
			/\baxios\s*\(/,
			/\baxios\.request\s*\(/,
			/\baxios\.(get|post|put|patch|delete|head|options)\s*\(/
		]);

		if (!axiosCall) throw new Error('No fetch() or axios() call was found in the file.');

		if (shorthand) {
			method = shorthand[1].toUpperCase();
			url = toText(axiosCall.args[0]);
			const config = axiosCall.args[axiosCall.args.length - 1];
			if (config && typeof config === 'object') {
				addHeaders(config.headers);
				addParams(config.params);
			}
			const payload = axiosCall.args.length > 2 ? axiosCall.args[1] : null;
			if (payload != null) bodyText = asPayload(payload);
		} else {
			const config = axiosCall.args[0];
			if (typeof config === 'string') {
				url = config;
				const extra = axiosCall.args[1];
				if (extra && typeof extra === 'object') {
					addHeaders(extra.headers);
					addParams(extra.params);
				}
			} else if (config && typeof config === 'object') {
				url = toText(config.url);
				method = toText(config.method).toUpperCase();
				addHeaders(config.headers);
				addParams(config.params);
				if (config.data != null) bodyText = asPayload(config.data);
			}
		}
	}

	// `const form = new FormData(); form.append('a', 1); axios({ data: form })`.
	const formData = readJsFormData(text);
	const urlSearch = readJsUrlSearchParams(text);
	if (formData && /^\s*(form|formData|body|data)\w*\s*$/i.test(bodyText)) {
		formFields = formData;
		bodyText = '';
	} else if (urlSearch && /^\s*(form|formData|body|data|params|search)\w*\s*$/i.test(bodyText)) {
		urlencodedParams = urlSearch;
		bodyText = '';
	}

	if (!url) throw new Error('No URL was found in the fetch/axios call.');
	if (!method) method = bodyText.trim() !== '' ? 'POST' : 'GET';

	return assemble({
		format: 'fetch',
		method,
		url,
		headers,
		bodyText,
		formFields,
		urlencodedParams,
		extraQuery: params,
		warnings,
		notices,
		name: fileName
	});
}

/** Lee los `append()` de un `new FormData()` para recuperar los campos del formulario. */
function readJsFormData(source) {
	if (!/new\s+FormData\s*\(/.test(source)) return null;

	const pattern = /\.append\(\s*(['"])([\s\S]*?)\1\s*,\s*([^)]*)\)/g;
	const fields = [];
	let match;
	while ((match = pattern.exec(source)) !== null) {
		const raw = match[3].trim();
		if (/^new\s+File|^\$|^[A-Za-z_$][\w$]*$/.test(raw)) {
			fields.push({ key: match[2], value: '', file: 'archivo' });
			continue;
		}
		fields.push({ key: match[2], value: /^(['"]).*\1$/.test(raw) ? unquote(raw) : raw });
	}

	return fields.length > 0 ? fields : null;
}

/** Lee un `new URLSearchParams('a=1&b=2')` para recuperar los campos del cuerpo. */
function readJsUrlSearchParams(source) {
	const match = /new\s+URLSearchParams\(\s*(['"])([\s\S]*?)\1\s*\)/.exec(source);
	if (!match) return null;

	return parseQueryString(match[2], []);
}

/* -------------------------------------------------------------------------- */
/* API pública                                                                  */
/* -------------------------------------------------------------------------- */

const PARSERS = {
	http: parseHttpRequest,
	curl: parseCurlRequest,
	powershell: parsePowerShellRequest,
	fetch: parseFetchRequest
};

/**
 * Convierte el texto de un archivo en el estado de RESTTester.
 *
 * @param {string} text Contenido completo del archivo.
 * @param {{fileName?: string, format?: 'http'|'curl'|'powershell'|'fetch'}} [options]
 * @returns {{format: string, fileName: string, method: string, url: string, data: object,
 *            name: string, warnings: string[], notices: string[]}}
 */
export function parseRequestFile(text, { fileName = '', format } = {}) {
	const source = normalizeNewlines(text);

	if (source.trim() === '') throw new Error('The file is empty.');

	const detected = format || detectImportFormat(source, fileName);
	if (!detected || !PARSERS[detected]) {
		throw new Error(
			'The format could not be recognised. Supported formats: .http, curl/bash, PowerShell and fetch/axios.'
		);
	}

	return { ...PARSERS[detected](source, { fileName }), format: detected, fileName };
}
