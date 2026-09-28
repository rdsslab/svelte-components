import { test, expect } from '@playwright/test';

/**
 * El editor no puede persistir un valor que solo obtuvo convirtiendo.
 *
 * `updateFromEditor`, `initializeEditor` y el bloque reactivo hacian
 * `String(code ?? '')` para cualquier lang que no fuera `json` ni `number`. Para un
 * valor que no es texto eso no era una pantalla fea, era una perdida de datos: el
 * padre recibia "[object Object]" y el objeto desaparecia del valor guardado.
 *
 * Reproducido en el navegador contra la pagina de demo, con el codigo anterior:
 *   - al montar, el editor ya mostraba "[object Object]" con el padre intacto;
 *   - teclear UN caracter dejaba el padre en "[object Object]x" (string);
 *   - el boton de reset lo dejaba en "[object Object]" (string).
 *
 * Ahora un valor que no es texto se serializa a JSON, y el texto que el editor
 * fabrica no se reenvia al padre mientras el usuario no haya escrito nada.
 *
 * Se prueba en un navegador real porque el componente depende de CodeMirror y de
 * `matchMedia`: no se puede ejercitar en un DOM sin navegador.
 *
 * Los selectores son `data-testid` y no texto a proposito: el valor mostrado es
 * justamente lo que cambia, asi que un selector por contenido dejaria de encontrar
 * el elemento justo cuando la prueba tiene algo que decir.
 *
 * Comprobado que muerden: revirtiendo el arreglo (y dejando `containerTestId`, que no
 * es parte del defecto) fallan 1, 2, 3, 4 y 6.
 */

/** Margen para el bloque reactivo de Svelte y el debounce del editor (350 ms). */
const settle = (page, ms = 1200) => page.waitForTimeout(ms);

const editor = (page, testId) =>
	page.locator(`[data-testid="${testId}"] .cm-content`).locator('visible=true');

const parentText = (page, testId) => page.locator(`[data-testid="${testId}"]`).innerText();

/**
 * El tipo que recibe el padre: el parrafo de la demo imprime `(typeof valor)`.
 *
 * Es la comprobacion que importa en el caso `boolean`. Buscar la palabra "false" en
 * el texto no distingue un boolean de la cadena "false", y esa cadena es *truthy* en
 * JavaScript: es exactamente el defecto que hay que cazar.
 */
const parentType = (page, testId) => page.locator(`[data-testid="${testId}"]`).innerText();

/**
 * Pulsa un boton de la barra de herramientas (Reset, Format...).
 *
 * El scroll explicto no es cosmetico. La seccion 9 esta a ~1850px de vertical en una
 * ventana de 720, y el auto-scroll interno de Playwright no la resuelve: el elemento
 * entra en pantalla, pero Playwright no llega a darlo por accionable y agota el timeout
 * sin haber pulsado nada. Con `scrollIntoViewIfNeeded` antes, el mismo click entra sin
 * problema.
 *
 * La barra se renderiza en el snippet `r01` del propio EditorCode, inyectado en `Level`
 * como `right`: queda FUERA del div `data-testid` del contenedor, asi que el selector
 * tiene que subir a la seccion de la pagina, que envuelve editor y barra.
 */
const clickToolbarButton = async (page, sectionId, label) => {
	const button = page.locator(`[data-testid="${sectionId}"] button:has-text("${label}")`).first();
	await button.scrollIntoViewIfNeeded();
	await button.click();
};

/** Escribe replacing todo el contenido del editor indicado. */
const retype = async (page, testId, text) => {
	await editor(page, testId).click();
	await page.keyboard.press('Control+a');
	await page.keyboard.type(text);
	await settle(page);
};

test.beforeEach(async ({ page }) => {
	await page.goto('/EditorCode');
	await page.locator('.cm-content').locator('visible=true').first().waitFor({ state: 'visible' });
	await settle(page, 2500);
});

test.describe('EditorCode: fidelidad del valor', () => {
	test('un lang desconocido NO muestra [object Object]', async ({ page }) => {
		const shown = await editor(page, 'editor-unknown-lang').innerText();
		expect(shown, `el editor degrudo el objeto a [object Object]: ${shown}`).not.toContain(
			'[object Object]'
		);
		expect(shown, `el editor no enseno el valor: ${shown}`).toContain('"a"');
	});

	test('teclear un caracter NO convierte el objeto en texto', async ({ page }) => {
		// El caso que se perdia de verdad: con el codigo anterior el padre acababa en
		// "[object Object]x" y el objeto dejaba de existir.
		await editor(page, 'editor-unknown-lang').click();
		await page.keyboard.press('End');
		await page.keyboard.type('x');
		await settle(page);

		const parent = await parentText(page, 'parent-unknown-lang');
		const shown = await editor(page, 'editor-unknown-lang').innerText();

		expect(parent, `la escritura lo degrudo: ${parent}`).not.toContain('[object Object]');
		expect(shown, `la escritura lo degrudo: ${shown}`).not.toContain('[object Object]');
		// Y el valor sigue siendo recuperable: puede haber cambiado de tipo, pero no ha
		// perdido contenido. Se comprueba en el EDITOR y no en el padre a proposito: al
		// escribir, el padre pasa a ser un string y su `JSON.stringify` escapa las
		// comillas, asi que la clave solo aparece literal en el texto del editor.
		expect(shown, `la escritura perdio el valor: ${shown}`).toContain('"a"');
	});

	test('el boton de reset NO convierte el objeto en [object Object]', async ({ page }) => {
		await clickToolbarButton(page, 'section-unknown-lang', 'Reset');
		await settle(page);

		// El reset reinserta el texto que el propio editor fabrico al montar, asi que el
		// padre recibe un string. Eso es correcto: reset significa "devuelveme el texto
		// que me enseñaste". Lo que no puede pasar es que ese texto pierda el valor,
		// que es justo lo que hacia antes.
		const parent = await parentText(page, 'parent-unknown-lang');
		expect(parent, `reset lo degrudo: ${parent}`).not.toContain('[object Object]');
		expect(parent, `reset perdio el valor: ${parent}`).toContain('"a"');
	});

	test('escribir false NO deja el flag como el texto truthy "false"', async ({ page }) => {
		// El backend siembra dos AppVars de tipo `boolean` que gobiernan la recuperacion
		// de contrasena. Si el editor entrega la cadena "false", cualquier
		// `if ($_VAR_RESET_EMAIL_ENABLED)` la ve como encendida.
		await retype(page, 'editor-boolean', 'false');

		const parent = await parentText(page, 'parent-boolean');
		const type = await parentType(page, 'type-boolean');

		expect(parent, `el flag no cogio la pulsacion: ${parent}`).toContain('false');
		expect(type, `el boolean volvio como texto, que es truthy: ${type}`).toContain('boolean');
		expect(type, `el boolean volvio como texto: ${type}`).not.toContain('string');
	});

	test('escribir 1 devuelve true, no el texto "1"', async ({ page }) => {
		// El otro camino del vocabulario. Con el arreglo ausente, el texto caia en el
		// `else` y el padre recibia el string "1".
		await retype(page, 'editor-boolean', '1');

		const parent = await parentText(page, 'parent-boolean');
		const type = await parentType(page, 'type-boolean');

		expect(type, `el "1" volvio como texto: ${type}`).toContain('boolean');
		expect(type, `el "1" volvio como texto: ${type}`).not.toContain('string');
		expect(parent, `el valor no se leyo: ${parent}`).toContain('true');
	});

	test('boolean ofrece su propia opcion en el desplegable', async ({ page }) => {
		// El desplegable no tenia `boolean` y el backend siembra dos AppVars de ese
		// tipo: se dibujaban con la seleccion en blanco.
		const values = await page.evaluate(() =>
			[...document.querySelectorAll('select')].flatMap((s) => [...s.options].map((o) => o.value))
		);
		expect(values).toContain('boolean');
	});

	test('el lang desconocido se conserva, no se sustituye', async ({ page }) => {
		// Guarda contra un arreglo distinto al actual: el desplegable no deberia
		// reescribir un lang que el backend todavia no conoce.
		const lang = await page.locator('[data-testid="lang-unknown-lang"]').innerText();
		expect(lang).toContain('inventado');
	});
});
