import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, type Plugin } from 'vite';
import { resolve } from 'node:path';
// plain .mjs helper shared with scripts/link-skein.mjs
import { buildPredictionIndex } from './scripts/skein-index.mjs';

// GitHub Pages serves a project site from /<repo-name>; the deploy workflow sets BASE_PATH.
const base = process.env.BASE_PATH ?? '';

// skein checkout (see scripts/link-skein.mjs); dev serves its prediction index live so new
// runs show up on refresh without restarting the server
const skeinDir = resolve(process.env.SKEIN_DIR ?? '../skein');
const skeinIndex = (): Plugin => ({
	name: 'skein-prediction-index',
	configureServer(server) {
		server.middlewares.use((req, res, next) => {
			if (!req.url?.split('?')[0].endsWith('/skein/predictions-index.json')) return next();
			res.setHeader('Content-Type', 'application/json');
			res.setHeader('Cache-Control', 'no-store');
			res.end(JSON.stringify(buildPredictionIndex(resolve(skeinDir, 'reports'))));
		});

	}
});

export default defineConfig({
	server: {
		allowedHosts:['foresight.nuvobio.com']
	},
	preview: {
		allowedHosts:['foresight.nuvobio.com']
	},
	plugins: [
		skeinIndex(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter({ fallback: '404.html' }),
			paths: { base: base as '' | `/${string}` }
		})
	]
});
