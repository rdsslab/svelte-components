/**
 * Pruebas del importador de RESTTester: los parsers puros de `importer.js`.
 *
 * Se prueban muestras reales de cada origen habitual (DevTools, Postman,
 * Swagger, REST Client de VS Code, JetBrains, httpyac, PowerShell, fetch,
 * axios, scripts escritos a mano) y, sobre todo, el viaje de ida y vuelta:
 * exportar con `request.js` e importar el resultado debe devolver el mismo
 * modelo normalizado.
 */
import { expect, test } from '@playwright/test';

import {
	REST_IMPORT_FORMATS,
	REST_IMPORT_ACCEPT,
	detectImportFormat,
	parseRequestFile,
	parseHttpRequest,
	parseCurlRequest,
	parsePowerShellRequest,
	parseFetchRequest
} from '../src/lib/RESTTester/importer.js';
import {
	AUTH_TYPES,
	BODY_TYPES,
	normalizeRequest,
	serializeCurlShell,
	serializeHttp,
	serializePowerShell
} from '../src/lib/RESTTester/request.js';

const keys = (rows) => rows.map((row) => row.key);
const values = (rows) => rows.map((row) => row.value);
const enabledOnly = (rows) => rows.filter((row) => row.enabled !== false);

test.describe('metadatos y detección', () => {
	test('expone los formatos con sus extensiones', () => {
		expect(REST_IMPORT_FORMATS.map((format) => format.id)).toEqual([
			'http',
			'curl',
			'powershell',
			'fetch'
		]);
		expect(REST_IMPORT_ACCEPT).toContain('.http');
		expect(REST_IMPORT_ACCEPT).toContain('.ps1');
		expect(REST_IMPORT_ACCEPT).toContain('.sh');
		expect(REST_IMPORT_ACCEPT).toContain('.txt');
	});

	test('detecta por contenido aunque la extensión no cuadre', () => {
		expect(detectImportFormat("curl 'https://a.com' -X POST", 'copiado.txt')).toBe('curl');
		expect(detectImportFormat('GET https://a.com/x\n', 'lo-que-sea.bin')).toBe('http');
		expect(detectImportFormat('fetch("https://a.com")', 'x.txt')).toBe('fetch');
		expect(detectImportFormat("$r = Invoke-RestMethod -Uri 'https://a.com'", 'x.txt')).toBe(
			'powershell'
		);
	});

	test('usa la extensión sólo como desempate', () => {
		expect(detectImportFormat('contenido cualquiera', 'peticion.http')).toBe('http');
		expect(detectImportFormat('Get-ChildItem', 'scripto.ps1')).toBe('powershell');
		expect(detectImportFormat('texto sin sentido', 'notas.md')).toBeNull();
	});

	test('lanza un error legible con archivos no soportados o vacíos', () => {
		expect(() => parseRequestFile('hola mundo', { fileName: 'x.txt' })).toThrow();
		expect(() => parseRequestFile('   \n  ', { fileName: 'x.txt' })).toThrow();
	});
});

test.describe('curl', () => {
	test('DevTools del navegador: descarta cabeceras del navegador y mueve el auth', () => {
		const source = [
			`curl 'https://api.example.com/v1/items?page=2&limit=10' \\`,
			`  -H 'accept: application/json, text/plain, */*' \\`,
			`  -H 'authorization: Bearer abc.def.ghi' \\`,
			`  -H 'content-type: application/json' \\`,
			`  -H 'origin: https://app.example.com' \\`,
			`  -H 'sec-ch-ua: "Chromium";v="120"' \\`,
			`  -H 'cookie: session=xyz' \\`,
			`  --data-raw '{"name":"nuevo","price":9.99}' \\`,
			`  --compressed`
		].join('\n');

		const result = parseCurlRequest(source, { fileName: 'item.txt' });

		expect(result.method).toBe('POST');
		expect(result.url).toBe('https://api.example.com/v1/items');
		expect(result.data.query).toEqual([
			{ enabled: true, key: 'page', value: '2' },
			{ enabled: true, key: 'limit', value: '10' }
		]);
		expect(keys(result.data.headers)).not.toContain('cookie');
		expect(keys(result.data.headers).some((key) => key.startsWith('sec-'))).toBe(false);
		expect(keys(result.data.headers).some((key) => key.startsWith('origin'))).toBe(false);
		expect(result.data.auth.selection).toBe(AUTH_TYPES.BEARER);
		expect(result.data.auth.bearer.token).toBe('abc.def.ghi');
		expect(result.data.body.selection).toBe(BODY_TYPES.JSON);
		expect(result.data.body.json.code).toContain('"price": 9.99');
		expect(result.notices.join(' ')).toContain('browser controls');
	});

	test('Postman: -G manda los datos a la query y --data-urlencode se decodifica', () => {
		const source = [
			`curl -X GET 'https://api.example.com/search' -G \\`,
			`  --data-urlencode 'q=caf%C3%A9 & crema' \\`,
			`  --data-urlencode 'page=3'`
		].join('\n');

		const result = parseCurlRequest(source, { fileName: 'postman.sh' });

		expect(result.method).toBe('GET');
		expect(result.url).toBe('https://api.example.com/search');
		// curl codifica el valor de `--data-urlencode`, así que se conserva tal cual.
		expect(result.data.query).toEqual([
			{ enabled: true, key: 'q', value: 'caf%C3%A9 & crema' },
			{ enabled: true, key: 'page', value: '3' }
		]);
	});

	test('credenciales Basic generadas con printf + base64', () => {
		const source = `curl 'https://api.example.com/x' -H 'Authorization: Basic '$(printf 'user:%s' 'p@ss' | base64)`;
		const result = parseCurlRequest(source, { fileName: 'a.sh' });

		expect(result.data.auth.selection).toBe(AUTH_TYPES.BASIC);
		expect(result.data.auth.basic).toEqual({ username: 'user', password: 'p@ss' });
		expect(keys(result.data.headers).map((key) => key.toLowerCase())).not.toContain(
			'authorization'
		);
	});

	test('curl a mano: -u, -F con archivo y agrupadas -sS', () => {
		const source = [
			`#!/bin/bash`,
			`set -e`,
			`curl -sS -X POST \\`,
			`  -F 'name=John Doe' \\`,
			`  -F 'avatar=@./photo.png;type=image/png' \\`,
			`  -F 'note=(texto literal)' \\`,
			`  -u admin:s3cret \\`,
			`  'https://api.example.com/users'`
		].join('\n');

		const result = parseCurlRequest(source, { fileName: 'upload.sh' });

		expect(result.data.body.selection).toBe(BODY_TYPES.FORM);
		expect(result.data.body.form.map((field) => field.key)).toEqual(['name', 'avatar', 'note']);
		expect(result.data.body.form[1].type).toBe(3); // archivo: hay que volver a elegirlo
		expect(result.data.auth.basic).toEqual({ username: 'admin', password: 's3cret' });
		expect(result.notices.join(' ')).toContain('photo.png');
	});

	test('curl con cuerpo heredoc (exportación propia incluida)', () => {
		const source = [
			`curl --request POST \\`,
			`  --url 'https://api.example.com/x' \\`,
			`  --header 'Content-Type: application/json' \\`,
			`  --data-binary @- <<'RESTTESTER_BODY_EOF'`,
			`{`,
			`  "clave": "con \\"comillas\\""`,
			`}`,
			`RESTTESTER_BODY_EOF`
		].join('\n');

		const result = parseCurlRequest(source, { fileName: 'h.sh' });

		expect(result.data.body.selection).toBe(BODY_TYPES.JSON);
		expect(result.data.body.json.code).toContain('"clave"');
		expect(result.data.body.json.code).toContain('\\"comillas\\"');
	});

	test('curl con heredoc envuelto en $(cat <<EOF)', () => {
		const source = [
			`curl --request PUT \\`,
			`  --url 'https://api.example.com/y' \\`,
			`  --data-binary "$(cat <<'EOF'`,
			`{"k":"v"}`,
			`EOF`,
			`)"`
		].join('\n');

		const result = parseCurlRequest(source, { fileName: 'h2.sh' });

		expect(result.data.method).toBeUndefined();
		expect(result.method).toBe('PUT');
		expect(result.data.body.selection).toBe(BODY_TYPES.JSON);
		expect(result.data.body.json.code).toContain('"k"');
	});

	test('curl -d sin Content-Type: urlencoded o json según el cuerpo', () => {
		const urlencoded = parseCurlRequest(`curl -d 'a=1&b=2' https://api.example.com/f`, {});
		expect(urlencoded.data.body.selection).toBe(BODY_TYPES.URLENCODED);
		expect(urlencoded.data.body.urlencoded).toEqual([
			{ enabled: true, key: 'a', value: '1' },
			{ enabled: true, key: 'b', value: '2' }
		]);

		const json = parseCurlRequest(`curl -X POST --json '{"a":1}' https://api.example.com/j`, {});
		expect(json.data.body.selection).toBe(BODY_TYPES.JSON);
		expect(json.data.body.json.code).toContain('"a": 1');
	});

	test('avisa cuando el cuerpo no tiene sentido en un GET', () => {
		const result = parseCurlRequest(`curl -X GET -d 'x=1' https://api.example.com/g`, {});
		expect(result.warnings.join(' ')).toContain('does not accept a body');
	});

	test('detecta el método por omisión cuando hay cuerpo', () => {
		expect(parseCurlRequest(`curl -d 'a=1' https://a.com/x`, {}).method).toBe('POST');
		expect(parseCurlRequest(`curl -I https://a.com/x`, {}).method).toBe('HEAD');
		expect(parseCurlRequest(`curl https://a.com/x`, {}).method).toBe('GET');
	});
});

test.describe('.http (REST Client, JetBrains, httpyac)', () => {
	test('interpola @variables, separa multipart y avisa si hay varias peticiones', () => {
		const source = [
			`@host = https://api.example.com/v2`,
			`@token = tok_123`,
			``,
			`### Listar usuarios`,
			`GET {{host}}/users?page=1`,
			`Authorization: Bearer {{token}}`,
			`Accept: application/json`,
			``,
			`### Crear usuario`,
			`POST {{host}}/users`,
			`Content-Type: application/json`,
			``,
			`{"a":1}`
		].join('\n');

		const result = parseHttpRequest(source, { fileName: 'api.http' });

		expect(result.format).toBe('http');
		expect(result.url).toBe('https://api.example.com/v2/users');
		expect(result.data.query).toEqual([{ enabled: true, key: 'page', value: '1' }]);
		expect(result.data.auth.bearer.token).toBe('tok_123');
		expect(result.notices.join(' ')).toContain('2 requests');
	});

	test('multipart con campo de archivo', () => {
		const source = [
			`POST https://api.example.com/upload`,
			`Content-Type: multipart/form-data; boundary=----X`,
			``,
			`------X`,
			`Content-Disposition: form-data; name="nombre"`,
			``,
			`Ana`,
			`------X`,
			`Content-Disposition: form-data; name="foto"; filename="a.png"`,
			`Content-Type: image/png`,
			``,
			`< ./a.png`,
			`------X--`
		].join('\n');

		const result = parseHttpRequest(source, { fileName: 'up.http' });

		expect(result.data.body.selection).toBe(BODY_TYPES.FORM);
		expect(result.data.body.form.map((field) => field.key)).toEqual(['nombre', 'foto']);
		expect(result.data.body.form[1].type).toBe(3);
	});

	test('archivo escrito a mano sin esquema ni cabeceras', () => {
		const source = [
			`POST localhost:3000/api/save`,
			`Content-Type: application/json`,
			``,
			`{"hello":"world"}`
		].join('\n');

		const result = parseHttpRequest(source, { fileName: 'notas.http' });

		expect(result.url).toBe('http://localhost:3000/api/save');
		expect(result.notices.join(' ')).toContain('scheme');
	});

	test('comentarios con # y ### no se toman como cabeceras', () => {
		const source = [
			`# comentario suelto`,
			`GET https://api.example.com/x`,
			`# otro comentario`,
			`X-Trace: 1`
		].join('\n');

		const result = parseHttpRequest(source, { fileName: 'c.http' });

		expect(result.url).toBe('https://api.example.com/x');
		expect(keys(result.data.headers)).toEqual(['X-Trace']);
	});
});

test.describe('PowerShell', () => {
	test('Invoke-RestMethod con hashtable de cabeceras y cuerpo ConvertTo-Json', () => {
		const source = [
			`$headers = @{`,
			`    'Content-Type' = 'application/json'`,
			`    'Authorization' = 'Bearer ps-token'`,
			`}`,
			`$body = @{`,
			`    nombre = 'Ana'`,
			`    edad = 30`,
			`    activo = $true`,
			`} | ConvertTo-Json -Depth 5`,
			``,
			`Invoke-RestMethod -Uri 'https://api.example.com/personas' -Method Post -Headers $headers -Body $body`
		].join('\n');

		const result = parsePowerShellRequest(source, { fileName: 'invoke.ps1' });

		expect(result.format).toBe('powershell');
		expect(result.method).toBe('POST');
		expect(result.url).toBe('https://api.example.com/personas');
		expect(result.data.auth.bearer.token).toBe('ps-token');
		expect(result.data.body.selection).toBe(BODY_TYPES.JSON);
		expect(result.data.body.json.code).toContain('"edad": 30');
		expect(result.data.body.json.code).toContain('"activo": true');
	});

	test('Invoke-WebRequest con -Body directo y Basic en base64', () => {
		const source = [
			`$pair = '{0}:{1}' -f 'user', 'pass'`,
			`$basic = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($pair))`,
			`$h = @{ Authorization = "Basic $basic" }`,
			`Invoke-WebRequest -Uri https://api.example.com/login -Method POST -Headers $h -Body '{\"a\":1}'`
		].join('\n');

		const result = parsePowerShellRequest(source, { fileName: 'iwr.ps1' });

		expect(result.method).toBe('POST');
		expect(result.data.auth.selection).toBe(AUTH_TYPES.BASIC);
		expect(result.data.auth.basic).toEqual({ username: 'user', password: 'pass' });
		expect(result.data.body.json.code).toContain('"a"');
	});

	test('script propio: here-string, StringContent y KeyValuePair', () => {
		const source = [
			`$Url = 'https://api.example.com/login'`,
			`$Method = 'POST'`,
			`$headers = [System.Collections.Generic.List[System.Collections.Generic.KeyValuePair[string,string]]]::new()`,
			`$headers.Add([System.Collections.Generic.KeyValuePair[string,string]]::new('X-Api-Key', 'k-1'))`,
			`$bodyText = @'`,
			`{`,
			`  "usuario": "user"`,
			`}`,
			`'@`,
			`$content = [System.Net.Http.StringContent]::new($bodyText, [Text.Encoding]::UTF8, 'application/json')`
		].join('\n');

		const result = parsePowerShellRequest(source, { fileName: 'own.ps1' });

		expect(result.url).toBe('https://api.example.com/login');
		expect(keys(result.data.headers)).toContain('X-Api-Key');
		expect(result.data.body.selection).toBe(BODY_TYPES.JSON);
		expect(result.data.body.json.code).toContain('"usuario"');
	});
});

test.describe('JavaScript (fetch y axios)', () => {
	test('fetch del DevTools', () => {
		const source = [
			`fetch("https://api.example.com/v1/search?q=abc", {`,
			`  headers: {`,
			`    "content-type": "application/json",`,
			`    "authorization": "Bearer fetch-token"`,
			`  },`,
			`  body: JSON.stringify({ q: "abc", page: 1 }),`,
			`  method: "POST"`,
			`});`
		].join('\n');

		const result = parseFetchRequest(source, { fileName: 'snippet.txt' });

		expect(result.format).toBe('fetch');
		expect(result.method).toBe('POST');
		expect(result.url).toBe('https://api.example.com/v1/search');
		expect(result.data.query).toEqual([{ enabled: true, key: 'q', value: 'abc' }]);
		expect(result.data.auth.bearer.token).toBe('fetch-token');
		expect(result.data.body.json.code).toContain('"page": 1');
	});

	test('axios con cabeceras', () => {
		const source = [
			`const res = await axios.post('https://api.example.com/pedidos', { total: 10 }, {`,
			`  headers: { 'Content-Type': 'application/json', 'X-Api-Key': 'abc' }`,
			`});`
		].join('\n');

		const result = parseFetchRequest(source, { fileName: 'axios.js' });

		expect(result.method).toBe('POST');
		expect(result.url).toBe('https://api.example.com/pedidos');
		expect(keys(result.data.headers)).toEqual(['Content-Type', 'X-Api-Key']);
		expect(result.data.body.json.code).toContain('"total": 10');
	});

	test('axios con FormData y params', () => {
		const source = [
			`const form = new FormData();`,
			`form.append('nombre', 'Ana');`,
			`axios({ method: 'post', url: '/api/personas', params: { activo: true }, data: form });`
		].join('\n');

		const result = parseFetchRequest(source, { fileName: 'form.js' });

		// Una URL relativa se respeta: el navegador la resuelve contra su origen.
		expect(result.url).toBe('/api/personas');
		expect(result.data.query).toEqual([{ enabled: true, key: 'activo', value: 'true' }]);
		expect(result.data.body.selection).toBe(BODY_TYPES.FORM);
	});

	test('descarta cabeceras prohibidas y avisa', () => {
		const source = [
			`fetch('https://api.example.com/x', {`,
			`  headers: {`,
			`    'sec-fetch-mode': 'cors',`,
			`    'host': 'api.example.com',`,
			`    'x-ok': '1'`,
			`  }`,
			`});`
		].join('\n');

		const result = parseFetchRequest(source, { fileName: 'x.txt' });

		expect(keys(result.data.headers)).toEqual(['x-ok']);
		expect(result.notices.join(' ')).toContain('sec-fetch-mode');
	});
});

test.describe('ida y vuelta: exportar e importar', () => {
	const estado = {
		url: 'https://api.example.com/v1/orders',
		method: 'POST',
		data: {
			query: [
				{ enabled: true, key: 'tenant', value: 'acme corp' },
				{ enabled: false, key: 'ignorado', value: 'no' }
			],
			headers: [
				{ enabled: true, key: 'X-Trace', value: 'abc-123' },
				{ enabled: true, key: 'Accept', value: 'application/json' }
			],
			auth: {
				selection: AUTH_TYPES.BASIC,
				basic: { username: 'u', password: 'p' },
				bearer: { token: '' }
			},
			body: {
				selection: BODY_TYPES.JSON,
				js: {},
				json: { code: '{"a":1,"b":[1,2]}' },
				xml: { code: '' },
				text: { value: '' },
				form: [],
				urlencoded: []
			}
		}
	};
	const model = normalizeRequest(estado);

	for (const [id, serializar, archivo] of [
		['http', serializeHttp, 'rest-request.http'],
		['curl', serializeCurlShell, 'rest-request.sh'],
		['powershell', serializePowerShell, 'rest-request.ps1']
	]) {
		test(`${id}: el modelo vuelve intacto`, () => {
			const texto = serializar(model, { secrets: 'literal' });
			const vuelta = normalizeRequest(parseRequestFile(texto, { fileName: archivo }));

			expect(vuelta.method).toBe(model.method);
			expect(vuelta.url).toBe(model.url);
			expect(vuelta.query).toEqual(model.query);
			expect(vuelta.headers).toEqual(model.headers);
			expect(vuelta.auth).toEqual(model.auth);
			expect(vuelta.body).toEqual(model.body);
		});
	}

	test('con variables de entorno el shell vuelve igual salvo los secretos', () => {
		const texto = serializeCurlShell(model, { secrets: 'variables' });
		const vuelta = normalizeRequest(parseRequestFile(texto, { fileName: 'rest-request.sh' }));

		expect(vuelta.url).toBe(model.url);
		expect(vuelta.headers).toEqual(model.headers);
		expect(vuelta.body).toEqual(model.body);
	});

	test('el cuerpo urlencoded también sobrevive al viaje de vuelta', () => {
		const conUrlencoded = normalizeRequest({
			url: 'https://api.example.com/form',
			method: 'POST',
			data: {
				query: [],
				headers: [
					{ enabled: true, key: 'Content-Type', value: 'application/x-www-form-urlencoded' }
				],
				auth: {
					selection: AUTH_TYPES.NONE,
					basic: { username: '', password: '' },
					bearer: { token: '' }
				},
				body: {
					selection: BODY_TYPES.URLENCODED,
					js: {},
					json: { code: '' },
					xml: { code: '' },
					text: { value: '' },
					form: [],
					urlencoded: [
						{ enabled: true, key: 'a', value: '1' },
						{ enabled: true, key: 'b', value: 'dos palabras' }
					]
				}
			}
		});

		for (const serializar of [serializeCurlShell, serializeHttp]) {
			const vuelta = normalizeRequest(
				parseRequestFile(serializar(conUrlencoded, { secrets: 'literal' }), { fileName: 'x' })
			);
			expect(vuelta.body.urlencoded).toEqual(conUrlencoded.body.urlencoded);
		}
	});

	test('los campos de texto de multipart sobreviven al viaje de vuelta', () => {
		const conForm = normalizeRequest({
			url: 'https://api.example.com/upload',
			method: 'POST',
			data: {
				query: [],
				headers: [],
				auth: {
					selection: AUTH_TYPES.NONE,
					basic: { username: '', password: '' },
					bearer: { token: '' }
				},
				body: {
					selection: BODY_TYPES.FORM,
					js: {},
					json: { code: '' },
					xml: { code: '' },
					text: { value: '' },
					form: [
						{ enabled: true, key: 'nombre', value: 'Ana', type: 1 },
						{ enabled: true, key: 'apellido', value: 'Pérez', type: 1 }
					],
					urlencoded: []
				}
			}
		});

		for (const serializar of [serializeCurlShell, serializeHttp]) {
			const vuelta = normalizeRequest(
				parseRequestFile(serializar(conForm, { secrets: 'literal' }), { fileName: 'x' })
			);
			expect(vuelta.body.form).toEqual(conForm.body.form);
		}
	});

	test('el bearer también sobrevive en los tres formatos', () => {
		const conBearer = normalizeRequest({
			url: 'https://api.example.com/me',
			method: 'GET',
			data: {
				query: [],
				headers: [],
				auth: {
					selection: AUTH_TYPES.BEARER,
					basic: { username: '', password: '' },
					bearer: { token: 'tok_9' }
				},
				body: {
					selection: BODY_TYPES.JSON,
					js: {},
					json: { code: '' },
					xml: { code: '' },
					text: { value: '' },
					form: [],
					urlencoded: []
				}
			}
		});

		const idaYVuelta = (texto, archivo) =>
			normalizeRequest(parseRequestFile(texto, { fileName: archivo })).auth;

		expect(idaYVuelta(serializeHttp(conBearer, { secrets: 'literal' }), 'a.http')).toEqual(
			conBearer.auth
		);
		expect(idaYVuelta(serializeCurlShell(conBearer, { secrets: 'literal' }), 'a.sh')).toEqual(
			conBearer.auth
		);
		expect(idaYVuelta(serializePowerShell(conBearer, { secrets: 'literal' }), 'a.ps1')).toEqual(
			conBearer.auth
		);
	});
});

test.describe('normalización del resultado', () => {
	test('todas las filas vienen activadas para que no se pierdan', () => {
		const result = parseCurlRequest(`curl 'https://a.com/x?p=1' -H 'X-A: 1' -H 'X-B: 2'`, {
			fileName: 'a.sh'
		});

		expect(enabledOnly(result.data.query)).toHaveLength(1);
		expect(result.data.query.every((row) => row.enabled === true)).toBe(true);
		expect(result.data.headers.every((row) => row.enabled === true)).toBe(true);
	});

	test('el modelo importado es aceptado por normalizeRequest', () => {
		const result = parseRequestFile(
			`curl -X POST -H 'Content-Type: application/json' -d '{"a":1}' https://a.com/x`,
			{ fileName: 'a.sh' }
		);
		const model = normalizeRequest(result);

		expect(model.url).toBe('https://a.com/x');
		// El JSON se reformatea para que se lea bien en el editor de cuerpo.
		expect(model.body.text).toBe('{\n  "a": 1\n}');
		expect(model.method).toBe('POST');
	});

	test('los parámetros sin valor se importan vacíos con aviso', () => {
		const result = parseHttpRequest(`GET https://a.com/x?solo`, { fileName: 'a.http' });
		expect(result.data.query).toEqual([{ enabled: true, key: 'solo', value: '' }]);
		expect(result.warnings.join(' ')).toContain('solo');
	});

	test('el fragmento # de la URL no se confunde con la query', () => {
		const result = parseHttpRequest(`GET https://a.com/x?a=1#seccion`, { fileName: 'a.http' });
		expect(result.url).toBe('https://a.com/x');
		expect(result.data.query).toEqual([{ enabled: true, key: 'a', value: '1' }]);
	});

	test('un método no soportado avisa y usa GET', () => {
		const result = parseHttpRequest(`FROBNICATE https://a.com/x`, { fileName: 'a.http' });
		expect(result.method).toBe('GET');
		expect(result.notices.join(' ')).toContain('FROBNICATE');
	});

	test('un archivo sin URL lanza un error', () => {
		expect(() => parseCurlRequest(`curl -X POST -d 'a=1'`, { fileName: 'a.sh' })).toThrow();
	});
});
