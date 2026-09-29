/**
 * Pruebas de interfaz de RESTTester: menú de exportación, importaciones desde
 * archivo, descargas y envío real de la solicitud contra un servicio público
 * gratuito.
 */
import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Origen para el texto de exportación y para rellenar el campo URL: aquí solo
 * se compara una cadena, nunca se envía nada, así que da igual que el servicio
 * no conteste.
 */
const ECHO = 'https://postman-echo.com';

/**
 * Destino del envío real. No puede ser postman-echo.com: ahora responde por
 * detrás de Cloudflare sin ninguna cabecera `Access-Control-Allow-Origin`, ni
 * en el `OPTIONS` de preflight, así que el navegador rechaza el `fetch`
 * cross-origin con "Failed to fetch" y no hay forma de distinguirlo de un
 * fallo de red desde el propio error. El servicio está vivo (responde 200 por
 * curl y por navegación directa, que no lleva CORS). httpbin.org sí envía
 * `Access-Control-Allow-Origin`, y `GET`/`POST` llegan comprobados con 200.
 */
const ECHO_SEND = 'https://httpbin.org';

const WORK = mkdtempSync(join(tmpdir(), 'resttester-import-'));

/** Escribe un archivo temporal y devuelve la ruta para `setInputFiles`. */
function sampleFile(name, content) {
	const path = join(WORK, name);
	writeFileSync(path, content, 'utf8');
	return path;
}

/**
 * En desarrollo SvelteKit entrega primero el HTML del servidor y después
 * descarga el grafo de módulos del cliente: sin esperar a la hidratación los
 * clics y los cambios de archivo se pierden, porque todavía no hay manejadores.
 * El botón Execute siempre vive en la barra, así que sirve de señal.
 */
async function waitHydrated(page) {
	await page.waitForLoadState('networkidle');
	await page.waitForFunction(
		() =>
			[...document.querySelectorAll('[data-testid="resttester-execute"]')].some((elemento) =>
				Object.getOwnPropertySymbols(elemento).some((s) => s.description === 'events')
			),
		null,
		{ timeout: 30_000 }
	);
}

async function prepare(page, { url, method = 'GET' } = {}) {
	await page.goto('/RestTester');
	await page.getByTestId('resttester-execute').waitFor({ state: 'visible' });
	await waitHydrated(page);

	if (url) {
		await page.getByPlaceholder('URL').fill(url);
	}
	if (method) {
		await page.locator('select').first().selectOption(method);
	}
}

/** Abre la pestaña que aloja los botones de importación y exportación. */
async function openImportExportTab(page) {
	const tab = page.getByRole('tab', { name: 'Import/Export' });
	if ((await tab.getAttribute('aria-selected')) !== 'true') {
		await tab.click();
	}
	await expect(page.getByTestId('resttester-import')).toBeVisible();
}

async function download(page, testId) {
	await openImportExportTab(page);
	const [downloadEvent] = await Promise.all([
		page.waitForEvent('download'),
		page.getByTestId(testId).click()
	]);
	const file = await downloadEvent.path();
	return { name: downloadEvent.suggestedFilename(), content: await readFile(file, 'utf8') };
}

test.beforeEach(async ({ page }) => {
	// Los `confirm()` de seguridad deben aceptarse para poder exportar.
	page.on('dialog', (dialog) => dialog.accept());
});

test.describe('pestaña Import/Export', () => {
	test('está antes que Result y explica los formatos de cada lado', async ({ page }) => {
		await prepare(page);

		const etiquetas = await page.getByRole('tab').allInnerTexts();
		const io = etiquetas.indexOf('Import/Export');
		expect(io).toBeGreaterThan(-1);
		expect(etiquetas.indexOf('Result')).toBeGreaterThan(io);

		await openImportExportTab(page);
		await expect(page.getByText('HTTP client file (.http)')).toBeVisible();
		await expect(page.getByText('curl/bash script (.sh)')).toBeVisible();
		await expect(page.getByText('PowerShell script (.ps1)')).toBeVisible();
		await expect(page.getByText('REST Client, JetBrains, httpyac')).toBeVisible();
		await expect(page.getByText('fetch/axios')).toBeVisible();

		// Los dos grupos de exportación, con sus seis botones.
		await expect(page.getByText('With environment variables')).toBeVisible();
		await expect(page.getByText('With plain text credentials')).toBeVisible();
		for (const formato of ['http', 'curl', 'powershell']) {
			await expect(page.getByTestId(`export-${formato}-safe`)).toBeVisible();
			await expect(page.getByTestId(`export-${formato}-literal`)).toBeVisible();
		}
	});

	test('avisa si la URL está vacía y no descarga', async ({ page }) => {
		await prepare(page, { url: '' });
		await openImportExportTab(page);
		await page.getByTestId('export-http-safe').click();

		await expect(page.getByText('Add a valid URL before exporting.')).toBeVisible();
	});

	test('exporta los tres formatos con variables de entorno', async ({ page }) => {
		await prepare(page, { url: `${ECHO}/post`, method: 'POST' });

		const http = await download(page, 'export-http-safe');
		expect(http.name).toBe('rest-request.http');
		expect(http.content).toContain(`POST ${ECHO}/post`);

		const sh = await download(page, 'export-curl-safe');
		expect(sh.name).toBe('rest-request.sh');
		expect(sh.content).toContain('--request POST');
		expect(sh.content).toContain(`--url '${ECHO}/post'`);

		const ps1 = await download(page, 'export-powershell-safe');
		expect(ps1.name).toBe('rest-request.ps1');
		expect(ps1.content).toContain('[System.Net.Http.HttpRequestMessage]::new');
	});

	test('pide confirmación antes de exportar credenciales en claro', async ({ page }) => {
		await prepare(page, { url: `${ECHO}/get` });

		// Sin credenciales no debe aparecer el diálogo de seguridad.
		let dialogos = 0;
		const contar = () => (dialogos += 1);
		page.on('dialog', contar);

		await download(page, 'export-http-literal');
		expect(dialogos).toBe(0);
	});

	test('una URL relativa se exporta absoluta, contra el origen de la página', async ({
		page,
		baseURL
	}) => {
		const relativa = '/api/portalclientescorporativos/bbdd/auditoria/colaboradores/prd';
		await prepare(page, { url: relativa });
		// La vista previa vive en la pestaña, así que primero hay que abrirla.
		await openImportExportTab(page);

		// Solo aparece cuando la URL es relativa, y dice a qué se resolvió.
		const preview = page.getByTestId('export-url-preview');
		await expect(preview).toBeVisible();
		await expect(preview).toContainText(`${baseURL}${relativa}`);

		const sh = await download(page, 'export-curl-safe');
		expect(sh.content).toContain(`--url '${baseURL}${relativa}'`);
		expect(sh.content).toContain(`# URL relativa resuelta contra: ${baseURL}/RestTester`);

		const http = await download(page, 'export-http-safe');
		expect(http.content).toContain(`GET ${baseURL}${relativa}`);

		const ps1 = await download(page, 'export-powershell-safe');
		expect(ps1.content).toContain(`$Url = '${baseURL}${relativa}'`);
	});

	test('una URL absoluta no muestra la vista previa de resolución', async ({ page, baseURL }) => {
		await prepare(page, { url: `${ECHO}/get` });
		await openImportExportTab(page);

		await expect(page.getByTestId('export-url-preview')).toHaveCount(0);

		const sh = await download(page, 'export-curl-safe');
		expect(sh.content).toContain(`--url '${ECHO}/get'`);
		expect(sh.content).not.toContain('URL relativa resuelta contra');
		expect(sh.content).not.toContain(baseURL);
	});
});

test.describe('importación desde archivo', () => {
	test('el input acepta los formatos del importador', async ({ page }) => {
		await prepare(page);
		await openImportExportTab(page);
		const accept = await page.getByTestId('resttester-import').getAttribute('accept');
		for (const extension of ['.http', '.sh', '.ps1', '.js', '.txt']) {
			expect(accept).toContain(extension);
		}
	});

	// Bulma impide que la barra se encoja o se reparta en varias filas, así que el
	// botón Execute se salía del área visible en cuanto la fila se llenaba.
	test('el botón Execute sigue dentro de la pantalla al achicar la ventana', async ({ page }) => {
		await prepare(page);
		const execute = page.getByTestId('resttester-execute');
		await expect(execute).toBeVisible();
		await expect(execute).toContainText('Execute');

		for (const width of [1600, 1280, 1024, 900]) {
			await page.setViewportSize({ width, height: 900 });
			await expect(execute).toBeInViewport();
		}
	});

	test('importa un curl del DevTools y llena url, método, query, headers y auth', async ({
		page
	}) => {
		await prepare(page);
		await openImportExportTab(page);
		await page
			.getByTestId('resttester-import')
			.setInputFiles(
				sampleFile(
					'item.txt',
					[
						`curl 'https://api.example.com/v1/items?page=2' \\`,
						`  -H 'authorization: Bearer abc.def' \\`,
						`  -H 'content-type: application/json' \\`,
						`  -H 'sec-ch-ua: "Chromium";v="120"' \\`,
						`  --data-raw '{"name":"nuevo"}'`
					].join('\n')
				)
			);

		// El aviso de importación vive en la pestaña Import/Export, que es la
		// que queda activa tras cargar el archivo.
		await expect(page.getByTestId('import-notice-text')).toContainText(
			'POST https://api.example.com/v1/items was imported'
		);
		// Los avisos del importador se listan en la misma notificación.
		await expect(page.getByTestId('import-notice-list')).toContainText('sec-ch-ua');

		await expect(page.getByPlaceholder('URL')).toHaveValue('https://api.example.com/v1/items');
		await expect(page.locator('select').first()).toHaveValue('POST');

		// La query de la URL queda en su propia pestaña.
		await page.getByRole('tab', { name: 'Query Parameters' }).click();
		await expect(page.getByPlaceholder('Param name').first()).toHaveValue('page');
		await expect(page.getByPlaceholder('Value').first()).toHaveValue('2');

		// El Authorization va a la pestaña Auth como bearer.
		await page.getByRole('tab', { name: 'Auth' }).click();
		await expect(page.getByRole('tab', { name: 'Bearer' })).toHaveAttribute(
			'aria-selected',
			'true'
		);
		await expect(page.getByPlaceholder('Token')).toHaveValue('abc.def');

		// El cuerpo queda en la pestaña Body con el editor JSON.
		await page.getByRole('tab', { name: 'Body' }).click();
		await expect(page.locator('.cm-content').first()).toContainText('"name": "nuevo"');
	});

	test('importa un archivo .http con variables', async ({ page }) => {
		await prepare(page);
		await openImportExportTab(page);
		await page
			.getByTestId('resttester-import')
			.setInputFiles(
				sampleFile(
					'api.http',
					[
						`@host = https://api.example.com/v2`,
						``,
						`GET {{host}}/usuarios?page=1`,
						`Accept: application/json`
					].join('\n')
				)
			);

		await expect(page.getByPlaceholder('URL')).toHaveValue('https://api.example.com/v2/usuarios');
		await expect(page.locator('select').first()).toHaveValue('GET');

		// La query se separa en su propia pestaña.
		await page.getByRole('tab', { name: 'Query Parameters' }).click();
		await expect(page.getByPlaceholder('Param name').first()).toHaveValue('page');
		await expect(page.getByPlaceholder('Value').first()).toHaveValue('1');
	});

	test('un archivo no soportado se avisa sin romper el estado', async ({ page }) => {
		await prepare(page, { url: `${ECHO}/get` });
		await openImportExportTab(page);
		await page
			.getByTestId('resttester-import')
			.setInputFiles(sampleFile('notas.md', 'esto no es una petición HTTP\n'));

		await expect(page.getByTestId('import-notice-text')).toContainText('could not be imported');
		await expect(page.getByPlaceholder('URL')).toHaveValue(`${ECHO}/get`);
	});

	test('el mismo archivo puede importarse dos veces seguidas', async ({ page }) => {
		await prepare(page);
		await openImportExportTab(page);
		const archivo = sampleFile('doble.http', 'GET https://api.example.com/uno\n');
		const input = page.getByTestId('resttester-import');

		await input.setInputFiles(archivo);
		await expect(page.getByPlaceholder('URL')).toHaveValue('https://api.example.com/uno');

		writeFileSync(archivo, 'GET https://api.example.com/dos\n', 'utf8');
		await input.setInputFiles(archivo);
		await expect(page.getByPlaceholder('URL')).toHaveValue('https://api.example.com/dos');
	});
});

test.describe('envío real desde el navegador', () => {
	test('POST JSON muestra la respuesta eco', async ({ page }) => {
		await prepare(page, { url: `${ECHO_SEND}/post`, method: 'POST' });
		await page.getByTestId('resttester-execute').click();
		// La respuesta sólo se pinta en la pestaña Result.
		await page.getByRole('tab', { name: 'Result' }).click();

		const respuesta = page.locator('pre', { hasText: 'httpbin.org' }).first();
		await expect(respuesta).toBeVisible({ timeout: 30_000 });
		await expect(respuesta).toContainText('/post');
	});

	test('GET con cabecera propia llega al servidor', async ({ page }) => {
		await prepare(page, { url: `${ECHO_SEND}/get?origen=uitest` });
		await page.getByTestId('resttester-execute').click();
		await page.getByRole('tab', { name: 'Result' }).click();

		const respuesta = page.locator('pre', { hasText: 'origen' }).first();
		await expect(respuesta).toBeVisible({ timeout: 30_000 });
		await expect(respuesta).toContainText('uitest');
	});
});
