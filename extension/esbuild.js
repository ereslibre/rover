const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
	name: 'esbuild-problem-matcher',

	setup(build) {
		build.onStart(() => {
			console.log('[watch] build started');
		});
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`);
				console.error(`    ${location.file}:${location.line}:${location.column}:`);
			});
			console.log('[watch] build finished');
		});
	},
};

/**
 * @type {import('esbuild').Plugin}
 */
const copyHtmlTemplatePlugin = {
	name: 'copy-html-template',

	setup(build) {
		build.onEnd(() => {
			// Copy HTML templates to the dist directory
			const templates = [
				{ src: 'taskDetailsTemplate.html', name: 'Task details template' }
			];
			
			const distPath = path.join(__dirname, 'dist', 'panels');

			try {
				// Ensure the dist/panels directory exists
				if (!fs.existsSync(distPath)) {
					fs.mkdirSync(distPath, { recursive: true });
				}

				// Copy each template file
				for (const template of templates) {
					const srcPath = path.join(__dirname, 'src', 'panels', template.src);
					const destPath = path.join(distPath, template.src);
					
					if (fs.existsSync(srcPath)) {
						fs.copyFileSync(srcPath, destPath);
						console.log(`[copy-html-template] ${template.name} copied to dist/panels/`);
					}
				}
			} catch (error) {
				console.error('[copy-html-template] Error copying templates:', error);
			}
		});
	},
};

async function main() {
	const ctx = await esbuild.context({
		entryPoints: [
			'src/extension.ts'
		],
		bundle: true,
		format: 'cjs',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'node',
		outfile: 'dist/extension.js',
		external: ['vscode'],
		logLevel: 'silent',
		plugins: [
			copyHtmlTemplatePlugin,
			/* add to the end of plugins array */
			esbuildProblemMatcherPlugin,
		],
	});
	if (watch) {
		await ctx.watch();
	} else {
		await ctx.rebuild();
		await ctx.dispose();
	}
}

main().catch(e => {
	console.error(e);
	process.exit(1);
});
