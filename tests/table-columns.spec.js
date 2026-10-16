/**
 * Ocultar/mostrar columnas por parte del usuario y persistencia en el navegador.
 *
 * La demo 1 de /Table declara `storageKey="demo-table-local"`, de modo que la
 * selección de columnas se guarda en `localStorage` bajo
 * `sc:table:demo-table-local:columns:v1`. Estas pruebas comprueban que:
 *  1. el modal lista las columnas configurables y oculta la elegida,
 *  2. la elección sobrevive a una recarga de la página,
 *  3. el botón "Reset" la revierte y limpia el almacenamiento,
 *  4. las columnas ocultas por configuración (p.ej. `internal_hash_row`) no
 *     aparecen en el modal.
 */
import { expect, test } from '@playwright/test';

const STORAGE_KEY = 'sc:table:demo-table-local:columns:v1';

/**
 * En desarrollo SvelteKit sirve el HTML antes de hidratar; sin esperar a los
 * manejadores los clics se pierden. El botón de columnas sirve de señal.
 */
async function waitHydrated(page) {
	await page.waitForLoadState('networkidle');
	await page.waitForFunction(
		() =>
			[...document.querySelectorAll('[data-testid="table-columns-button"]')].some((elemento) =>
				Object.getOwnPropertySymbols(elemento).some((s) => s.description === 'events')
			),
		null,
		{ timeout: 30_000 }
	);
}

test.describe('Table - columnas configurables por el usuario', () => {
	/** @type {import('@playwright/test').Page} */
	let page;

	test.beforeEach(async ({ browser }) => {
		page = await browser.newPage();
		// La demo 2 consulta jsonplaceholder; se bloquea para no depender de la red.
		await page.route('**://jsonplaceholder.typicode.com/**', (route) => route.abort());
		await page.goto('/Table');
		await page.getByTestId('table-columns-button').first().waitFor({ state: 'visible' });
		await waitHydrated(page);
		// Asienta el procesado de los datos locales (debounce de 200 ms).
		await page.locator('table.table thead th').first().waitFor({ state: 'visible' });
	});

	test.afterEach(async () => {
		await page?.close();
	});

	/** Primera tabla (demo de datos locales), que es la que tiene `storageKey`. */
	function firstTable() {
		const box = page.locator('.box').first();
		return {
			button: box.getByTestId('table-columns-button'),
			// `DialogModal` hereda `role="dialog"` del `Modal` base; los modales
			// cerrados quedan `display:none` y fuera del árbol de accesibilidad.
			modal: box.getByRole('dialog')
		};
	}

	/** Encabezado "Salario" (solo existe en la demo 1). */
	function salaryHeader() {
		return page.locator('table.table thead th', { hasText: 'Salario' });
	}

	test('oculta una columna, la persiste tras recargar y la restablece', async () => {
		await expect(salaryHeader()).toHaveCount(1);

		const { button, modal } = firstTable();
		await button.click();
		await expect(modal).toBeVisible();

		await modal.getByLabel('Salario').uncheck();
		await expect(salaryHeader()).toHaveCount(0);

		// La elección queda guardada en el navegador...
		await expect
			.poll(() => page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY))
			.toContain('salary');

		// ...y sobrevive a una recarga.
		await page.reload();
		await page.getByTestId('table-columns-button').first().waitFor({ state: 'visible' });
		await waitHydrated(page);
		await expect(page.locator('table.table thead th').first()).toBeVisible();
		await expect(salaryHeader()).toHaveCount(0);

		// Restablecer vuelve a mostrar la columna y limpia el almacenamiento.
		const afterReload = firstTable();
		await afterReload.button.click();
		await afterReload.modal.getByRole('button', { name: 'Reset' }).click();
		await expect(salaryHeader()).toHaveCount(1);

		await expect
			.poll(() => page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY))
			.toBeNull();
	});

	test('el modal no ofrece columnas ocultas por configuración', async () => {
		const { button, modal } = firstTable();
		await button.click();
		await expect(modal).toBeVisible();

		await expect(modal.getByLabel('Nombre')).toBeVisible();
		await expect(modal.getByLabel('internal_hash_row')).toHaveCount(0);
	});

	test('cerrar con la X solo cierra: no borra la preferencia', async () => {
		const { button, modal } = firstTable();
		await button.click();
		await expect(modal).toBeVisible();

		await modal.getByLabel('Salario').uncheck();
		await expect(salaryHeader()).toHaveCount(0);

		// La X de la cabecera NO debe comportarse como "Reset".
		await modal.getByLabel('close').click();
		await expect(modal).toBeHidden();

		await expect(salaryHeader()).toHaveCount(0);
		await expect
			.poll(() => page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY))
			.toContain('salary');

		// Y sobrevive a una recarga.
		await page.reload();
		await page.getByTestId('table-columns-button').first().waitFor({ state: 'visible' });
		await waitHydrated(page);
		await expect(page.locator('table.table thead th').first()).toBeVisible();
		await expect(salaryHeader()).toHaveCount(0);
	});

	test('cerrar con "Accept" conserva la selección', async () => {
		const { button, modal } = firstTable();
		await button.click();
		await expect(modal).toBeVisible();

		await modal.getByLabel('Salario').uncheck();
		await modal.locator('footer.modal-card-foot button', { hasText: 'Accept' }).click();
		await expect(modal).toBeHidden();

		await expect(salaryHeader()).toHaveCount(0);
		await expect
			.poll(() => page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY))
			.toContain('salary');
	});

	test('"Hide all" oculta todas las columnas configurables y persiste', async () => {
		const { button, modal } = firstTable();
		await button.click();
		await expect(modal).toBeVisible();

		await modal.getByTestId('table-hide-all-columns').click();

		await expect(page.locator('table.table thead th', { hasText: 'Nombre' })).toHaveCount(0);
		await expect(salaryHeader()).toHaveCount(0);

		const stored = await page.evaluate((key) => localStorage.getItem(key), STORAGE_KEY);
		expect(stored).toContain('name');
		expect(stored).toContain('salary');

		// Y sobrevive a una recarga.
		await page.reload();
		await page.getByTestId('table-columns-button').first().waitFor({ state: 'visible' });
		await waitHydrated(page);
		await expect(page.locator('table.table thead th').first()).toBeVisible();
		await expect(page.locator('table.table thead th', { hasText: 'Nombre' })).toHaveCount(0);
	});

	test('sin storageKey la persistencia es automática (demo 3)', async () => {
		const box = page.locator('.box').nth(2);
		const header = box.locator('table.table thead th', { hasText: 'salary' });
		await expect(header).toHaveCount(1);

		await box.getByTestId('table-columns-button').click();
		const modal = box.getByRole('dialog');
		await expect(modal).toBeVisible();

		await modal.getByLabel('salary').uncheck();
		await expect(header).toHaveCount(0);

		// Se guardó bajo una clave automática (no había `storageKey`).
		const autoKeys = await page.evaluate(() =>
			Object.keys(localStorage).filter((key) => key.includes(':auto:'))
		);
		expect(autoKeys.length).toBeGreaterThan(0);

		await page.reload();
		await page.getByTestId('table-columns-button').first().waitFor({ state: 'visible' });
		await waitHydrated(page);
		await page.locator('table.table thead th').first().waitFor({ state: 'visible' });
		await expect(box.locator('table.table thead th', { hasText: 'salary' })).toHaveCount(0);
	});
});
