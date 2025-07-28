#!/usr/bin/env node
import { Command } from 'commander';
import init from './commands/init.js';
import createTasksCommand from './commands/tasks.js';
import { psCommand } from './commands/ps.js';
import { getVersion } from './utils/version.js';
import { taskCommand } from './commands/task.js';

const program = new Command();


program
	.name('rover')
	.description('An AI orchestrator')
	.version(getVersion());

program
	.command('init')
	.description('Init your project!')
	.argument('[path]', 'Project path', '.')
	.action((path: string) => {
		init(path);
	});

// Add the tasks command with its subcommands
program.addCommand(createTasksCommand());

// Add a new task
program
	.command('task')
	.description('Start a new task for an AI Agent. It will spawn a new environment to complete it.')
	.option('--from', 'Locate an existing issue / task and use it. You can provide a GitHub / Gitlab URL or ID')
	.option('-f, --follow', 'Follow execution logs in real-time')
	.argument('[description]', 'The task description, or provide it later. Mandatory in non-interactive envs')
	.action(taskCommand);

// Add the ps command for monitoring tasks
program
	.command('ps')
	.description('Show active task status')
	.option('-v, --verbose', 'Show detailed information including errors')
	.option('-w, --watch', 'Watch for changes and refresh every 5 seconds')
	.action(psCommand);

program.parse(process.argv);

// If no command is provided, show help
if (!process.argv.slice(2).length) {
	program.outputHelp();
}