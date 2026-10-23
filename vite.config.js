import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
	plugins: [sveltekit({ adapter: adapter({ strict: false }) })],
	resolve: {
		alias: {
			// Vite 8 exige rutas absolutas: un alias relativo se resuelve contra el
			// importador y rompe `$lib/...` (500 en dev).
			'$lib': fileURLToPath(new URL('./src/lib', import.meta.url))
		}
	},
    build: {
		sourcemap: true // Facilita la depuración
	},
	optimizeDeps: {
        exclude: [],
    },
});
