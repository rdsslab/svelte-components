/**
 * Pruebas de los serializadores de RESTTester y de consumo real contra servicios
 * públicos gratuitos de prueba (postman-echo.com y httpbin.org).
 *
 * Los tests marcados como `integration` ejecutan de verdad los archivos generados
 * con `bash` (curl) y con `pwsh` (System.Net.Http). Si no hay PowerShell en la
 * máquina, las pruebas de ejecución de `.ps1` se omiten, pero su contenido se
 * sigue verificando de forma determinista.
 */
import { expect, test } from '@playwright/test';
import { execFileSync, execFileSync as run } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import https from 'node:https';

import {
	normalizeRequest,
	serializeCurlShell,
	serializeHttp,
	serializePowerShell
} from '../src/lib/RESTTester/request.js';

const ECHO = 'https://postman-echo.com';
const HTTPBIN = 'https://httpbin.org';

const WORK = mkdtempSync(join(tmpdir(), 'resttester-export-'));

test.afterAll(() => {
	rmSync(WORK, { recursive: true, force: true });
});

/* -------------------------------------------------------------------------- */
/* Utilidades                                                                   */
/* -------------------------------------------------------------------------- */

function pwshPath() {
	const candidates = [process.env.PWSH_PATH, 'pwsh', '/tmp/opencode/pwsh/pwsh'].filter(Boolean);
	for (const candidate of candidates) {
		try {
			execFileSync('bash', ['-lc', `command -v ${candidate}`], { stdio: 'ignore' });
			return candidate;
		} catch {
			/* siguiente candidato */
		}
	}
	return null;
}

function hasBinary(binary) {
	try {
		execFileSync('bash', ['-lc', `command -v ${binary}`], { stdio: 'ignore' });
		return true;
	} catch {
		return false;
	}
}

function runSh(name, content, env = {}) {
	const file = join(WORK, `${name}.sh`);
	writeFileSync(file, content, 'utf8');
	return run('bash', [file], { encoding: 'utf8', env: { ...process.env, ...env } });
}

function runPs1(name, content, env = {}) {
	const file = join(WORK, `${name}.ps1`);
	writeFileSync(file, content, 'utf8');
	return run(pwshPath(), ['-NoProfile', '-File', file], {
		encoding: 'utf8',
		env: { ...process.env, ...env }
	});
}

function echoBody(output) {
	return JSON.parse(output.slice(output.indexOf('{')));
}

/** postman-echo devuelve los archivos como data URL en base64. */
function decodeEchoFile(value) {
	const match = /^data:[^;]*;base64,(.*)$/s.exec(String(value ?? ''));
	return match ? Buffer.from(match[1], 'base64').toString('utf8') : String(value ?? '');
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Lector mínimo del formato `.http` que produce el serializador y envío real por
 * HTTPS. Cubre línea de petición, cabeceras, cuerpo plano y multipart con la
 * sintaxis `< ./archivo` de REST Client.
 */
function sendHttpFile(text, baseDir, attempt = 0) {
	// postman-echo.com es público y a veces corta la conexión: reintentamos.
	return sendOnce(text, baseDir).catch(async (error) => {
		if (attempt >= 3) throw error;
		await sleep(2000 * (attempt + 1));
		return sendHttpFile(text, baseDir, attempt + 1);
	});
}

function sendOnce(text, baseDir) {
	return new Promise((resolve, reject) => {
		const lines = text.split('\n');
		const isSkippable = (line) => line.trim() === '' || line.trim().startsWith('#');
		let index = 0;
		while (index < lines.length && isSkippable(lines[index])) index += 1;

		const [method, url] = lines[index++].trim().split(/\s+/);
		const headers = {};
		while (index < lines.length && !isSkippable(lines[index])) {
			const separator = lines[index].indexOf(':');
			if (separator !== -1) {
				headers[lines[index].slice(0, separator).trim().toLowerCase()] = lines[index]
					.slice(separator + 1)
					.trim();
			}
			index += 1;
		}
		index += 1; // línea en blanco antes del cuerpo
		const bodyLines = lines.slice(index).join('\n').replace(/\n+$/, '');

		const boundary = /boundary=(.+)$/.exec(headers['content-type'] || '')?.[1]?.trim();
		let payload = Buffer.from(bodyLines, 'utf8');
		if (boundary) {
			const parts = [];
			for (const block of bodyLines.split(`--${boundary}`)) {
				if (block.trim() === '' || block.trim() === '--') continue;
				const partLines = block
					.replace(/^\r?\n/, '')
					.replace(/\r?\n$/, '')
					.split('\n');
				const head = [];
				let cursor = 0;
				while (
					cursor < partLines.length &&
					partLines[cursor].trim() !== '' &&
					!partLines[cursor].startsWith('< ')
				) {
					head.push(partLines[cursor]);
					cursor += 1;
				}
				let value = '';
				if (cursor < partLines.length && partLines[cursor].trim() === '') {
					cursor += 1;
					value = partLines.slice(cursor).join('\n');
				}
				const filename = /filename="([^"]+)"/.exec(head.join('\n'))?.[1];
				if (filename) value = readFileSync(join(baseDir, filename), 'utf8');
				parts.push(Buffer.from(`--${boundary}\n${head.join('\n')}\n\n${value}\n`, 'utf8'));
			}
			payload = Buffer.concat([...parts, Buffer.from(`--${boundary}--\n`, 'utf8')]);
		}

		const target = new URL(url);
		const request = https.request(
			{
				method,
				hostname: target.hostname,
				path: `${target.pathname}${target.search}`,
				headers: { ...headers, 'Content-Length': payload.length }
			},
			(response) => {
				const chunks = [];
				response.on('data', (chunk) => chunks.push(chunk));
				response.on('end', () => {
					const body = chunks.join('utf8');
					try {
						JSON.parse(body);
					} catch (error) {
						reject(
							new Error(
								`Respuesta no JSON de ${url}: ${error.message}\n` +
									`inicio=${JSON.stringify(body.slice(0, 120))}\n` +
									`final=${JSON.stringify(body.slice(-120))}\n` +
									`bytes=${Buffer.byteLength(body)}`
							)
						);
						return;
					}
					resolve({ url, method, headers, body });
				});
			}
		);
		request.on('error', reject);
		request.end(payload);
	});
}

/* -------------------------------------------------------------------------- */
/* Normalización (determinista, sin red)                                       */
/* -------------------------------------------------------------------------- */

test.describe('normalizeRequest', () => {
	test('conserva claves duplicadas del query y omite las deshabilitadas', () => {
		const model = normalizeRequest({
			url: 'https://ejemplo.test/api?fijo=1#frag',
			method: 'GET',
			data: {
				query: [
					{ enabled: true, key: 'tag', value: 'uno' },
					{ enabled: true, key: 'tag', value: 'dos' },
					{ enabled: false, key: 'off', value: 'ignorado' }
				]
			}
		});

		expect(model.url).toBe('https://ejemplo.test/api?fijo=1&tag=uno&tag=dos#frag');
	});

	test('ignora el body en GET y lo avisa', () => {
		const model = normalizeRequest({
			url: 'https://ejemplo.test',
			method: 'GET',
			data: { body: { selection: 0, json: { code: { a: 1 } } } }
		});

		expect(model.body.hasBody).toBe(false);
		expect(model.warnings.join(' ')).toContain('no admite body');
	});

	test('permite body en DELETE (uFetch lo descartaba)', () => {
		const model = normalizeRequest({
			url: 'https://ejemplo.test',
			method: 'DELETE',
			data: { body: { selection: 0, json: { code: { motivo: 'limpieza' } } } }
		});

		expect(model.body.hasBody).toBe(true);
		expect(model.body.type).toBe('json');
	});

	test('elimina Content-Length y une cabeceras duplicadas sin distinguir mayúsculas', () => {
		const model = normalizeRequest({
			url: 'https://ejemplo.test',
			method: 'POST',
			data: {
				headers: [
					{ enabled: true, key: 'X-Multi', value: 'a' },
					{ enabled: true, key: 'x-multi', value: 'b' },
					{ enabled: true, key: 'Content-Length', value: '999' }
				],
				body: { selection: 0, json: { code: { a: 1 } } }
			}
		});

		expect(model.headers).toEqual([
			{ key: 'X-Multi', value: 'a, b' },
			{ key: 'Content-Type', value: 'application/json' }
		]);
	});

	test('la pestaña de autenticación gana a un header Authorization manual', () => {
		const model = normalizeRequest({
			url: 'https://ejemplo.test',
			method: 'POST',
			data: {
				headers: [{ enabled: true, key: 'Authorization', value: 'Bearer manual' }],
				auth: { selection: 2, bearer: { token: 'ganador' } }
			}
		});

		expect(model.headers.some((h) => h.key.toLowerCase() === 'authorization')).toBe(false);
		expect(model.auth.configured).toBe(true);
	});

	test('Basic exige usuario y contraseña, igual que uFetch', () => {
		const sinPassword = normalizeRequest({
			url: 'https://ejemplo.test',
			method: 'GET',
			data: { auth: { selection: 1, basic: { username: 'ada' } } }
		});
		const completo = normalizeRequest({
			url: 'https://ejemplo.test',
			method: 'GET',
			data: { auth: { selection: 1, basic: { username: 'ada', password: 'x' } } }
		});

		expect(sinPassword.auth.configured).toBe(false);
		expect(completo.auth.configured).toBe(true);
	});

	test('avisa cuando hay campos de archivo en form-data', () => {
		const model = normalizeRequest({
			url: 'https://ejemplo.test',
			method: 'POST',
			data: {
				body: {
					selection: 3,
					form: [
						{ enabled: true, key: 'campo', value: 'texto' },
						{
							enabled: true,
							key: 'archivo',
							value: { length: 1, 0: { name: 'a.txt', size: 3, type: 'text/plain' } }
						}
					]
				}
			}
		});

		expect(model.body.hasFiles).toBe(true);
		expect(model.notices.length).toBe(1);
	});
});

/* -------------------------------------------------------------------------- */
/* URL relativa: el archivo exportado se ejecuta sin base, así que debe         */
/* llevar el host. En el navegador `fetch` la resuelve sola, por eso el fallo   */
/* solo aparecía al exportar.                                                   */
/* -------------------------------------------------------------------------- */

const RELATIVA = '/api/portalclientescorporativos/bbdd/auditoria/colaboradores/prd';
const BASE = 'http://localhost:5174/RestTester';
const vacio = { query: [], body: { selection: 0 }, headers: {}, auth: { selection: 0 } };

test.describe('URL relativa al exportar', () => {
	test('una ruta absoluta se usa tal cual y sin avisos', () => {
		for (const baseUrl of [BASE, '']) {
			const model = normalizeRequest({
				url: 'https://api.ejemplo.test/x',
				method: 'GET',
				data: vacio,
				baseUrl
			});

			expect(model.url).toBe('https://api.ejemplo.test/x');
			expect(model.resolved).toBe(false);
			expect(model.warnings).toEqual([]);
		}
	});

	test('una ruta con barra inicial se resuelve contra el origen de la base', () => {
		const model = normalizeRequest({
			url: RELATIVA,
			method: 'GET',
			data: vacio,
			baseUrl: BASE
		});

		expect(model.url).toBe(`http://localhost:5174${RELATIVA}`);
		expect(model.base).toBe(BASE);
		expect(model.resolved).toBe(true);
		expect(model.warnings).toEqual([]);
	});

	test('sin barra inicial se resuelve como lo haría fetch: el último segmento es un archivo', () => {
		// Igual que `new URL('api/x', 'https://api.ejemplo.test/app/pagina')` en el navegador:
		// `pagina` se trata como archivo y se sustituye, igual que en `document.baseURI`.
		const model = normalizeRequest({
			url: 'api/x',
			method: 'GET',
			data: vacio,
			baseUrl: 'https://api.ejemplo.test/app/pagina'
		});

		expect(model.url).toBe('https://api.ejemplo.test/app/api/x');
	});

	test('el query string se compone sobre la URL ya resuelta', () => {
		const model = normalizeRequest({
			url: RELATIVA,
			method: 'GET',
			data: { ...vacio, query: [{ enabled: true, key: 'page', value: '2' }] },
			baseUrl: BASE
		});

		expect(model.url).toBe(`http://localhost:5174${RELATIVA}?page=2`);
	});

	test('sin base la ruta se queda relativa, con un aviso y sin romper', () => {
		const model = normalizeRequest({ url: RELATIVA, method: 'GET', data: vacio });

		expect(model.url).toBe(RELATIVA);
		expect(model.resolved).toBe(false);
		expect(model.warnings.join(' ')).toContain('relativa');
	});

	test('una base inválida no rompe la exportación', () => {
		const model = normalizeRequest({
			url: RELATIVA,
			method: 'GET',
			data: vacio,
			baseUrl: 'esto-no-es-una-url'
		});

		expect(model.url).toBe(RELATIVA);
		expect(model.warnings.length).toBe(1);
	});

	test('resolver no dispara un notice, para no pedir confirmación al exportar', () => {
		const model = normalizeRequest({
			url: RELATIVA,
			method: 'GET',
			data: vacio,
			baseUrl: BASE
		});

		expect(model.notices).toEqual([]);
	});

	test('el origen queda anotado en el archivo y la URL es absoluta', () => {
		const model = normalizeRequest({
			url: RELATIVA,
			method: 'GET',
			data: vacio,
			baseUrl: BASE
		});
		const absoluta = `http://localhost:5174${RELATIVA}`;

		expect(serializeCurlShell(model)).toContain(`--url '${absoluta}'`);
		expect(serializeCurlShell(model)).toContain(`# URL relativa resuelta contra: ${BASE}`);

		expect(serializeHttp(model)).toContain(`GET ${absoluta}`);
		expect(serializeHttp(model)).toContain(`# URL relativa resuelta contra: ${BASE}`);

		const ps1 = serializePowerShell(model);
		expect(ps1).toContain(`$Url = '${absoluta}'`);
		expect(ps1).toContain('URL relativa resuelta contra: ' + BASE);
	});
});

/* -------------------------------------------------------------------------- */
/* Contenido de los archivos exportados (determinista)                        */
/* -------------------------------------------------------------------------- */

const caso = {
	url: 'https://postman-echo.com/post',
	method: 'POST',
	data: {
		query: [
			{ enabled: true, key: 'tag', value: 'uno' },
			{ enabled: true, key: 'tag', value: 'dos' }
		],
		headers: [{ enabled: true, key: 'X-Odd', value: 'comilla \' y "doble"' }],
		auth: {
			selection: 2,
			basic: { username: 'u', password: 'p' },
			bearer: { token: 'tok-secreto' }
		},
		body: { selection: 0, json: { code: { nombre: "Ada's", lista: [1, 2, 3] } } }
	}
};

test.describe('contenido exportado', () => {
	const model = normalizeRequest(caso);

	test('.http incluye método, URL, cabeceras y cuerpo', () => {
		const text = serializeHttp(model, { secrets: 'variables' });

		expect(text).toContain('POST https://postman-echo.com/post?tag=uno&tag=dos');
		expect(text).toContain('X-Odd: comilla \' y "doble"');
		expect(text).toContain('Content-Type: application/json');
		expect(text).toContain('Authorization: Bearer {{token}}');
		expect(text).toContain('"nombre": "Ada\'s"');
	});

	test('.sh es un script bash válido con curl y heredoc', () => {
		const text = serializeCurlShell(model, { secrets: 'variables' });

		expect(text.startsWith('#!/usr/bin/env bash')).toBe(true);
		expect(text).toContain('set -euo pipefail');
		expect(text).toContain("--url 'https://postman-echo.com/post?tag=uno&tag=dos'");
		expect(text).toContain("'X-Odd: comilla '\"'\"' y \"doble\"'");
		expect(text).toContain('${REST_TOKEN:?');
		expect(text).toMatch(/--data-binary "\$\(cat <<'RESTTESTER_BODY_EOF'\n\{/);
		expect(text.trimEnd().endsWith('RESTTESTER_BODY_EOF\n)"')).toBe(true);
		expect(text).not.toContain('tok-secreto');
	});

	test('.sh usa heredoc directo si el body ya termina en salto de línea', () => {
		const conNewline = normalizeRequest({
			url: 'https://ejemplo.test',
			method: 'POST',
			data: { body: { selection: 2, text: { value: 'linea\n' } } }
		});
		const text = serializeCurlShell(conNewline);

		expect(text).toContain("--data-binary @- <<'RESTTESTER_BODY_EOF'");
		expect(text).not.toContain('$(cat <<');
	});

	test('.ps1 usa System.Net.Http, CRLF y BOM', () => {
		const text = serializePowerShell(model, { secrets: 'variables' });

		expect(text.charCodeAt(0)).toBe(0xfeff);
		expect(text).toContain('[System.Net.Http.HttpRequestMessage]::new');
		expect(text).toContain('[System.Net.Http.HttpMethod]::new($Method)');
		expect(text).toContain('$env:REST_TOKEN');
		expect(text).toContain('\r\n');
		expect(text).not.toContain('tok-secreto');
	});

	test('el modo literal sí incluye las credenciales y lo advierte', () => {
		for (const [name, text] of [
			['http', serializeHttp(model, { secrets: 'literal' })],
			['curl', serializeCurlShell(model, { secrets: 'literal' })],
			['powershell', serializePowerShell(model, { secrets: 'literal' })]
		]) {
			expect(text, name).toContain('tok-secreto');
			expect(text, name).toMatch(/texto plano/);
		}
	});

	test('Basic se codifica en UTF-8 (no con btoa)', () => {
		const basic = normalizeRequest({
			url: 'https://ejemplo.test',
			method: 'GET',
			data: { auth: { selection: 1, basic: { username: 'usuario ñ', password: 'seña' } } }
		});
		const esperado = Buffer.from('usuario ñ:seña', 'utf8').toString('base64');

		expect(serializeHttp(basic, { secrets: 'literal' })).toContain(`Basic ${esperado}`);
		expect(serializeCurlShell(basic, { secrets: 'literal' })).toContain("--user 'usuario ñ:seña'");
		expect(serializePowerShell(basic, { secrets: 'literal' })).toContain('usuario ñ:seña');
	});

	test('sin credenciales no aparece ninguna cabecera Authorization', () => {
		const limpio = normalizeRequest({ url: 'https://ejemplo.test', method: 'GET', data: {} });

		for (const text of [
			serializeHttp(limpio),
			serializeCurlShell(limpio),
			serializePowerShell(limpio)
		]) {
			expect(text).not.toContain('Authorization');
		}
	});

	test('el delimitador del heredoc se adapta al cuerpo', () => {
		const colision = normalizeRequest({
			url: 'https://ejemplo.test',
			method: 'POST',
			data: { body: { selection: 2, text: { value: 'RESTTESTER_BODY_EOF dentro' } } }
		});

		expect(serializeCurlShell(colision)).toContain("<<'RESTTESTER_BODY_EOF1'");
	});
});

/* -------------------------------------------------------------------------- */
/* Consumo real: los scripts generados se ejecutan contra servicios gratuitos   */
/* -------------------------------------------------------------------------- */

test.describe('consumo real (curl contra postman-echo.com)', () => {
	test.skip(!hasBinary('curl'), 'requiere curl');

	test('POST JSON + query duplicado + header con comillas + bearer', async () => {
		const data = {
			query: [
				{ enabled: true, key: 'tag', value: 'uno' },
				{ enabled: true, key: 'tag', value: 'dos' },
				{ enabled: false, key: 'off', value: 'ignorado' }
			],
			headers: [{ enabled: true, key: 'X-Odd', value: 'comilla \' y "doble"' }],
			auth: { selection: 2, bearer: { token: 'token-secreto' } },
			body: {
				selection: 0,
				json: { code: { nombre: "Ada's", nota: 'acentos ñ áéíóú', n: [1, 2, 3] } }
			}
		};
		const model = normalizeRequest({ url: `${ECHO}/post`, method: 'POST', data });

		const json = echoBody(
			runSh('curl_post_json', serializeCurlShell(model, { secrets: 'variables' }), {
				REST_TOKEN: 'token-secreto'
			})
		);

		expect(json.url).toContain(`${ECHO}/post?tag=uno&tag=dos`);
		expect(json.url).not.toContain('ignorado');
		expect(json.headers['x-odd']).toBe(`comilla ' y "doble"`);
		expect(json.headers.authorization).toBe('Bearer token-secreto');
		expect(json.json).toEqual(data.body.json.code);
		expect(json.headers['content-type']).toMatch(/^application\/json/);
	});

	test('GET sin body ni credenciales', async () => {
		const data = {
			query: [{ enabled: true, key: 'q', value: 'buscar & cosas' }],
			headers: [{ enabled: true, key: 'Accept', value: 'application/json' }],
			auth: { selection: 0 },
			body: { selection: 0, json: { code: { no: 'enviar' } } }
		};
		const model = normalizeRequest({ url: `${ECHO}/get`, method: 'GET', data });

		const json = echoBody(runSh('curl_get', serializeCurlShell(model, { secrets: 'variables' })));

		expect(json.url).toContain(`${ECHO}/get?q=buscar+%26+cosas`);
		expect(json.args.q).toBe('buscar & cosas');
		expect(json.data).toBeFalsy();
		expect(json.headers.authorization).toBeUndefined();
	});

	test('POST Basic con credenciales Unicode y cuerpo de texto', async () => {
		const data = {
			headers: [],
			auth: { selection: 1, basic: { username: 'usuario ñ', password: 'p@s:seña' } },
			body: { selection: 2, text: { value: 'texto con ñ y "comillas"' } }
		};
		const model = normalizeRequest({ url: `${ECHO}/post`, method: 'POST', data });

		const json = echoBody(runSh('curl_basic', serializeCurlShell(model, { secrets: 'literal' })));

		expect(json.headers.authorization).toBe(
			`Basic ${Buffer.from('usuario ñ:p@s:seña', 'utf8').toString('base64')}`
		);
		expect(json.data).toBe('texto con ñ y "comillas"');
	});

	test('POST x-www-form-urlencoded sin salto de línea espurio', async () => {
		const data = {
			headers: [],
			auth: { selection: 0 },
			body: {
				selection: 4,
				urlencoded: [
					{ enabled: true, key: 'user', value: 'ada lovelace' },
					{ enabled: true, key: 'role', value: 'admin & ops' },
					{ enabled: false, key: 'skip', value: 'no' }
				]
			}
		};
		const model = normalizeRequest({ url: `${ECHO}/post`, method: 'POST', data });

		const json = echoBody(
			runSh('curl_urlenc', serializeCurlShell(model, { secrets: 'variables' }))
		);

		expect(json.form).toEqual({ user: 'ada lovelace', role: 'admin & ops' });
		expect(json.headers['content-type']).toMatch(/^application\/x-www-form-urlencoded/);
	});

	test('POST multipart con archivo', async () => {
		writeFileSync(join(WORK, 'nota.txt'), 'contenido del archivo\n', 'utf8');
		const data = {
			headers: [],
			auth: { selection: 0 },
			body: {
				selection: 3,
				form: [
					{ enabled: true, key: 'campo', value: 'valor normal' },
					{
						enabled: true,
						key: 'documento',
						value: { length: 1, 0: { name: 'nota.txt', size: 5, type: 'text/plain' } }
					},
					{ enabled: false, key: 'ignorado', value: 'no' }
				]
			}
		};
		const model = normalizeRequest({ url: `${ECHO}/post`, method: 'POST', data });

		const json = echoBody(
			runSh('curl_multipart', serializeCurlShell(model, { secrets: 'variables' }))
		);

		expect(json.form.campo).toBe('valor normal');
		expect(json.form.ignorado).toBeUndefined();
		expect(decodeEchoFile(json.files['nota.txt'])).toContain('contenido del archivo');
		expect(json.headers['content-type']).toMatch(/^multipart\/form-data; boundary=/);
	});

	test('DELETE con body JSON', async () => {
		const data = {
			headers: [],
			auth: { selection: 0 },
			body: { selection: 0, json: { code: { motivo: 'limpieza' } } }
		};
		const model = normalizeRequest({ url: `${ECHO}/delete`, method: 'DELETE', data });

		const json = echoBody(
			runSh('curl_delete', serializeCurlShell(model, { secrets: 'variables' }))
		);

		expect(json.url).toContain('/delete');
		expect(json.json).toEqual({ motivo: 'limpieza' });
	});

	test('PATCH XML con Content-Type manual', async () => {
		const data = {
			headers: [{ enabled: true, key: 'content-type', value: 'application/xml' }],
			auth: { selection: 0 },
			body: { selection: 1, xml: { code: '<root><hi>hola ñ</hi></root>' } }
		};
		const model = normalizeRequest({ url: `${ECHO}/patch`, method: 'PATCH', data });

		const json = echoBody(runSh('curl_patch', serializeCurlShell(model, { secrets: 'variables' })));

		expect(json.url).toContain('/patch');
		expect(json.data).toBe('<root><hi>hola ñ</hi></root>');
		expect(json.headers['content-type']).toMatch(/^application\/xml/);
	});

	test('el script seguro falla si no se define la variable de entorno', () => {
		const model = normalizeRequest({
			url: `${ECHO}/post`,
			method: 'POST',
			data: { auth: { selection: 2, bearer: { token: 'secreto' } } }
		});

		expect(() =>
			runSh('curl_sin_var', serializeCurlShell(model, { secrets: 'variables' }), { REST_TOKEN: '' })
		).toThrow(/REST_TOKEN/);
	});
});

test.describe('consumo real (curl contra httpbin.org)', () => {
	test.skip(!hasBinary('curl'), 'requiere curl');

	test('GET con cabecera propia y Basic', async () => {
		const data = {
			headers: [{ enabled: true, key: 'X-Probe', value: 'svelte-components' }],
			auth: { selection: 1, basic: { username: 'ada', password: 'lovelace' } },
			body: { selection: 0, json: { code: {} } }
		};
		const model = normalizeRequest({ url: `${HTTPBIN}/get`, method: 'GET', data });

		const json = JSON.parse(
			runSh('httpbin_get', serializeCurlShell(model, { secrets: 'literal' }))
		);

		expect(json.url).toBe(`${HTTPBIN}/get`);
		expect(json.headers['X-Probe']).toBe('svelte-components');
		expect(json.headers.Authorization).toBe(
			`Basic ${Buffer.from('ada:lovelace', 'utf8').toString('base64')}`
		);
		expect(json.data).toBeFalsy();
	});
});

/* -------------------------------------------------------------------------- */
/* Consumo real: PowerShell                                                    */
/* -------------------------------------------------------------------------- */

test.describe('consumo real (PowerShell)', () => {
	const PWSH = pwshPath();

	test('POST JSON con bearer leído del entorno (postman-echo)', async () => {
		test.skip(!PWSH, 'requiere PowerShell (pwsh) en el PATH o PWSH_PATH');
		const data = {
			query: [{ enabled: true, key: 'tag', value: 'uno' }],
			headers: [{ enabled: true, key: 'X-Odd', value: 'comilla \' y "doble"' }],
			auth: { selection: 2, bearer: { token: 'token-secreto' } },
			body: { selection: 0, json: { code: { nombre: "Ada's", lista: [1, 2, 3] } } }
		};
		const model = normalizeRequest({ url: `${ECHO}/post`, method: 'POST', data });

		const json = echoBody(
			runPs1('ps1_post_json', serializePowerShell(model, { secrets: 'variables' }), {
				REST_TOKEN: 'token-secreto'
			})
		);

		expect(json.url).toContain(`${ECHO}/post?tag=uno`);
		expect(json.headers['x-odd']).toBe(`comilla ' y "doble"`);
		expect(json.headers.authorization).toBe('Bearer token-secreto');
		expect(json.json).toEqual(data.body.json.code);
	});

	test('POST Basic Unicode y cuerpo de texto (postman-echo)', async () => {
		test.skip(!PWSH, 'requiere PowerShell (pwsh) en el PATH o PWSH_PATH');
		const data = {
			headers: [],
			auth: { selection: 1, basic: { username: 'usuario ñ', password: 'p@s:seña' } },
			body: { selection: 2, text: { value: 'texto con ñ y "comillas"' } }
		};
		const model = normalizeRequest({ url: `${ECHO}/post`, method: 'POST', data });

		const json = echoBody(runPs1('ps1_basic', serializePowerShell(model, { secrets: 'literal' })));

		expect(json.headers.authorization).toBe(
			`Basic ${Buffer.from('usuario ñ:p@s:seña', 'utf8').toString('base64')}`
		);
		expect(json.data).toBe('texto con ñ y "comillas"');
	});

	test('POST urlencoded (postman-echo)', async () => {
		test.skip(!PWSH, 'requiere PowerShell (pwsh) en el PATH o PWSH_PATH');
		const data = {
			headers: [],
			auth: { selection: 0 },
			body: {
				selection: 4,
				urlencoded: [
					{ enabled: true, key: 'user', value: 'ada lovelace' },
					{ enabled: true, key: 'role', value: 'admin & ops' }
				]
			}
		};
		const model = normalizeRequest({ url: `${ECHO}/post`, method: 'POST', data });

		const json = echoBody(
			runPs1('ps1_urlenc', serializePowerShell(model, { secrets: 'variables' }))
		);

		expect(json.form).toEqual({ user: 'ada lovelace', role: 'admin & ops' });
		expect(json.headers['content-type']).toMatch(/^application\/x-www-form-urlencoded/);
	});

	test('POST multipart con archivo (postman-echo)', async () => {
		test.skip(!PWSH, 'requiere PowerShell (pwsh) en el PATH o PWSH_PATH');
		writeFileSync(join(WORK, 'nota.txt'), 'contenido del archivo\n', 'utf8');
		const data = {
			headers: [],
			auth: { selection: 0 },
			body: {
				selection: 3,
				form: [
					{ enabled: true, key: 'campo', value: 'valor normal' },
					{
						enabled: true,
						key: 'documento',
						value: { length: 1, 0: { name: 'nota.txt', size: 5, type: 'text/plain' } }
					}
				]
			}
		};
		const model = normalizeRequest({ url: `${ECHO}/post`, method: 'POST', data });

		const json = echoBody(
			runPs1('ps1_multipart', serializePowerShell(model, { secrets: 'variables' }))
		);

		expect(json.form.campo).toBe('valor normal');
		expect(decodeEchoFile(json.files['nota.txt'])).toContain('contenido del archivo');
	});

	test('DELETE con body y PATCH XML (httpbin.org)', async () => {
		test.skip(!PWSH, 'requiere PowerShell (pwsh) en el PATH o PWSH_PATH');
		const deleteModel = normalizeRequest({
			url: `${HTTPBIN}/delete`,
			method: 'DELETE',
			data: { headers: [], body: { selection: 0, json: { code: { motivo: 'limpieza' } } } }
		});
		const deleteOut = runPs1(
			'ps1_delete',
			serializePowerShell(deleteModel, { secrets: 'variables' })
		);
		const deleteJson = JSON.parse(deleteOut.slice(deleteOut.indexOf('{')));
		expect(deleteJson.url).toBe(`${HTTPBIN}/delete`);
		expect(deleteJson.json).toEqual({ motivo: 'limpieza' });

		const patchModel = normalizeRequest({
			url: `${HTTPBIN}/patch`,
			method: 'PATCH',
			data: {
				headers: [{ enabled: true, key: 'content-type', value: 'application/xml' }],
				body: { selection: 1, xml: { code: '<root><hi>hola ñ</hi></root>' } }
			}
		});
		const patchOut = runPs1('ps1_patch', serializePowerShell(patchModel, { secrets: 'variables' }));
		const patchJson = JSON.parse(patchOut.slice(patchOut.indexOf('{')));
		expect(patchJson.url).toBe(`${HTTPBIN}/patch`);
		expect(patchJson.data).toBe('<root><hi>hola ñ</hi></root>');
	});
});

/* -------------------------------------------------------------------------- */
/* Consumo real: archivo .http enviado por HTTPS                               */
/* -------------------------------------------------------------------------- */

test.describe('consumo real (archivo .http enviado por HTTPS)', () => {
	test('POST JSON con query duplicado y credenciales (postman-echo)', async () => {
		const model = normalizeRequest(caso);
		const text = serializeHttp(model, { secrets: 'literal' });

		const sent = await sendHttpFile(text, WORK);
		const json = JSON.parse(sent.body);

		expect(sent.method).toBe('POST');
		expect(sent.url).toContain(`${ECHO}/post?tag=uno&tag=dos`);
		expect(json.headers['x-odd']).toBe(`comilla ' y "doble"`);
		expect(json.headers.authorization).toBe('Bearer tok-secreto');
		expect(json.json).toEqual(caso.data.body.json.code);
		expect(text).not.toMatch(/^content-length\s*:/im);
	});

	test('multipart con archivo (httpbin.org)', async () => {
		writeFileSync(join(WORK, 'nota.txt'), 'contenido del archivo\n', 'utf8');
		const model = normalizeRequest({
			url: `${HTTPBIN}/post`,
			method: 'POST',
			data: {
				headers: [],
				auth: { selection: 0 },
				body: {
					selection: 3,
					form: [
						{ enabled: true, key: 'campo', value: 'valor normal' },
						{
							enabled: true,
							key: 'documento',
							value: { length: 1, 0: { name: 'nota.txt', size: 5, type: 'text/plain' } }
						}
					]
				}
			}
		});
		const text = serializeHttp(model, { secrets: 'variables' });

		const sent = await sendHttpFile(text, WORK);
		const json = JSON.parse(sent.body);

		expect(json.form.campo).toBe('valor normal');
		expect(String(json.files.documento)).toContain('contenido del archivo');
		expect(String(json.headers['Content-Type'])).toContain('boundary=----RESTTesterFormBoundary2');
	});
});
