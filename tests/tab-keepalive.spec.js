/**
 * Regresión de `Tab.keepAlive`: una pestaña opt-in debe conservar su estado al
 * cambiar de pestaña, mientras que las pestañas normales se siguen desmontando.
 */
import { expect, test } from '@playwright/test';

async function waitHydrated(page) {
	await page.waitForLoadState('networkidle');
	await page.waitForFunction(
		() =>
			[...document.querySelectorAll('[data-testid="keepalive-increment"]')].some((elemento) =>
				Object.getOwnPropertySymbols(elemento).some((s) => s.description === 'events')
			),
		null,
		{ timeout: 30_000 }
	);
}

test.describe('Tab keepAlive', () => {
	test('conserva el estado de la pestaña opt-in y desmonta las demás', async ({ page }) => {
		await page.goto('/Tab');
		await waitHydrated(page);

		const demo = page.getByTestId('tab-keepalive-demo');
		await expect(demo).toBeVisible();

		const increment = page.getByTestId('keepalive-increment');
		await increment.click();
		await increment.click();
		await expect(page.getByTestId('keepalive-counter-value')).toHaveText('2');

		// La pestaña sin keepAlive se monta al activarla.
		await demo.getByRole('tab', { name: 'Otra' }).click();
		await expect(page.getByTestId('keepalive-other-panel')).toBeVisible();

		// La pestaña keepAlive sigue montada, pero oculta.
		await expect(page.getByTestId('keepalive-counter-panel')).toBeAttached();
		await expect(page.getByTestId('keepalive-counter-panel')).toBeHidden();

		// Al volver, el contador conserva su valor.
		await demo.getByRole('tab', { name: 'Contador' }).click();
		await expect(page.getByTestId('keepalive-counter-value')).toHaveText('2');

		// La pestaña normal se desmontó al salir de ella.
		await expect(page.getByTestId('keepalive-other-panel')).toHaveCount(0);
	});
});
