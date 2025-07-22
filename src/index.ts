#!/usr/bin/env node
import { Command } from 'commander';
import init from './commands/init.js';

const program = new Command();


program
	.name('rover')
	.description('Endor, spin up services instantly for you and your AI agents')
	.version('0.1.0');

program
	.command('init')
	.description('Init your project!')
	.argument('[path]', 'Project path', '.')
	.action((path: string) => {
		init(path);
	});

program.parse(process.argv);

// If no command is provided, show help
if (!process.argv.slice(2).length) {
	program.outputHelp();
}
