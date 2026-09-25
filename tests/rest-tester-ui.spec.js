/**
 * Pruebas de interfaz de RESTTester: menú de exportación, descargas y envío real
 * de la solicitud contra un servicio público gratuito (postman-echo.com).
 */
import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const ECHO = 'https://postman-echo.com';

async function prepare(page, { url, method = 'GET' } = {}) {
	await page.goto('/RestTester');
	await page.getByTestId('export-toggle').waitFor({ state: 'visible' });

	if (url) {
		await page.getByPlaceholder('URL').fill(url);
	}
	if (method) {
		await page.locator('select').first().selectOption(method);
	}
}

async function download(page, testId) {
	await page.getByTestId('export-toggle').click();
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

test.describe('menú de exportación', () => {
	test('abre y cierra el desplegable', async ({ page }) => {
		await prepare(page);
		const toggle = page.getByTestId('export-toggle');
		const menu = page.locator('.dropdown.is-active');

		await expect(menu).toHaveCount(0);
		await toggle.click();
		await expect(menu).toHaveCount(1);
		await expect(page.getByTestId('export-http-safe')).toBeVisible();
		await expect(page.getByTestId('export-curl-safe')).toBeVisible();
		await expect(page.getByTestId('export-powershell-safe')).toBeVisible();
		await expect(page.getByTestId('export-http-literal')).toBeVisible();

		// Clic fuera del menú.
		await page
			.locator('h1, body')
			.first()
			.click({ position: { x: 5, y: 5 } });
		await expect(menu).toHaveCount(0);
	});

	test('avisa si la URL está vacía y no descarga', async ({ page }) => {
		await prepare(page, { url: '' });
		await page.getByTestId('export-toggle').click();
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
});

test.describe('envío real desde el navegador', () => {
	test('POST JSON muestra la respuesta eco de postman-echo', async ({ page }) => {
		await prepare(page, { url: `${ECHO}/post`, method: 'POST' });
		await page.getByTestId('resttester-execute').click();

		const respuesta = page.locator('pre', { hasText: 'postman-echo.com' }).first();
		await expect(respuesta).toBeVisible({ timeout: 30_000 });
		await expect(respuesta).toContainText('/post');
	});

	test('GET con cabecera propia llega al servidor', async ({ page }) => {
		await prepare(page, { url: `${ECHO}/get?origen=uitest` });
		await page.getByTestId('resttester-execute').click();

		const respuesta = page.locator('pre', { hasText: 'origen' }).first();
		await expect(respuesta).toBeVisible({ timeout: 30_000 });
		await expect(respuesta).toContainText('uitest');
	});
});
