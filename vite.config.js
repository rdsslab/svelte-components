import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit({ adapter: adapter({ strict: false }) })],
	resolve: {
		alias: {
			'$lib': 'src/lib'
		}
	},
    build: {
		sourcemap: true // Facilita la depuración
	},
	optimizeDeps: {
        exclude: [],
    },
});
