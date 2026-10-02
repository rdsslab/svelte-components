/**
 * Tema claro/oscuro del encabezado de la tabla.
 *
 * El encabezado se pintaba con la clase estática de Bulma
 * `has-background-link-dark`, que resuelve a `--bulma-link-10-l` (8 % de
 * luminosidad) y NO rota con el tema: en modo claro quedaba un azul casi negro
 * sobre una caja blanca, y en modo oscuro quedaba ese mismo azul casi negro
 * sobre una superficie también oscura (contraste 1.16:1 medido), de modo que la
 * banda del encabezado dejaba de leerse. Ahora el color sale de variables
 * `--table-head-*` que sí cambian de valor con `prefers-color-scheme` y con
 * `[data-theme]`.
 *
 * Estas pruebas miden los colores calculados reales y fijan los objetivos de
 * contraste: texto >= 4.5:1 (WCAG 1.4.3) y banda del encabezado >= 3:1 frente a
 * la superficie (WCAG 1.4.11).
 */
import { expect, test } from '@playwright/test';

/** Luminancia relativa WCAG a partir de un color `rgb()` o `rgba()`. */
function luminance(color) {
	const [r, g, b] = color
		.match(/[\d.]+/g)
		.slice(0, 3)
		.map(Number);
	const channel = (c) => {
		c /= 255;
		return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
	};
	return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Ratio de contraste entre dos colores `rgb()`. */
function contrast(a, b) {
	const la = luminance(a);
	const lb = luminance(b);
	const [hi, lo] = la > lb ? [la, lb] : [lb, la];
	return +((hi + 0.05) / (lo + 0.05)).toFixed(2);
}

/** Color de fondo efectivo del encabezado, subiendo desde el `th` al `tr`. */
async function headerColors(page) {
	return page.evaluate(() => {
		const th = document.querySelector('table.table thead th');
		const opaqueBackground = (el) => {
			let node = el;
			while (node) {
				const bg = getComputedStyle(node).backgroundColor;
				if (bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg)) return bg;
				node = node.parentElement;
			}
			return getComputedStyle(document.body).backgroundColor;
		};
		const box = document.querySelector('.box');
		return {
			text: getComputedStyle(th).color,
			background: opaqueBackground(th),
			surface: box
				? getComputedStyle(box).backgroundColor
				: getComputedStyle(document.body).backgroundColor,
			headerTag: getComputedStyle(document.querySelector('table.table thead tr')).backgroundColor
		};
	});
}

for (const scheme of ['light', 'dark']) {
	test.describe(`Table - encabezado en modo ${scheme}`, () => {
		/** @type {import('@playwright/test').Page} */
		let page;

		test.beforeEach(async ({ browser }) => {
			page = await browser.newPage();
			// La demo 2 consulta jsonplaceholder; se bloquea para no depender de la red.
			await page.route('**://jsonplaceholder.typicode.com/**', (route) => route.abort());
			await page.emulateMedia({ colorScheme: scheme });
			await page.goto('/Table');
			await page.locator('table.table thead th').first().waitFor({ state: 'visible' });
			await page.waitForTimeout(500); // asienta el render de los datos locales
		});

		test.afterEach(async () => {
			await page?.close();
		});

		test('el texto del encabezado cumple contraste AA', async () => {
			const { text, background } = await headerColors(page);
			const ratio = contrast(text, background);
			console.log(`[${scheme}] texto ${text} sobre fondo ${background} -> ${ratio}:1`);
			expect(ratio).toBeGreaterThanOrEqual(4.5);
		});

		test('la banda del encabezado se distingue de la superficie (WCAG 1.4.11)', async () => {
			const { background, surface } = await headerColors(page);
			const ratio = contrast(background, surface);
			console.log(`[${scheme}] encabezado ${background} sobre superficie ${surface} -> ${ratio}:1`);
			expect(ratio).toBeGreaterThanOrEqual(3);
		});
	});
}
