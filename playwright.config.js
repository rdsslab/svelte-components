import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 5174);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
	testDir: 'tests',
	// Las pruebas de integración contra servicios públicos necesitan margen.
	timeout: 90_000,
	expect: { timeout: 15_000 },
	fullyParallel: false,
	workers: 1,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
	use: {
		baseURL,
		trace: 'retain-on-failure',
		acceptDownloads: true
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		command: `npm run dev -- --port ${PORT} --strictPort --host 127.0.0.1`,
		url: `${baseURL}/RestTester`,
		reuseExistingServer: !process.env.CI,
		timeout: 120_000
	}
});
