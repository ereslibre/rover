import { Command } from 'commander';
import { newTask } from './tasks/new.js';
import { listTasks } from './tasks/list.js';
import { deleteTask } from './tasks/delete.js';
import { inspectTask } from './tasks/inspect.js';
import { startTask } from './tasks/start.js';
import { resetTask } from './tasks/reset.js';
import { iterationTask } from './tasks/iteration.js';
import { iterateTask } from './tasks/iterate.js';
import { logsTask } from './tasks/logs.js';
import { mergeTask } from './tasks/merge.js';
import { shellTask } from './tasks/shell.js';

/**
 * Create the tasks command with subcommands
 */
export const createTasksCommand = () => {
    const tasksCommand = new Command('tasks')
        .description('Manage tasks');

    tasksCommand
        .command('new')
        .description('Create a new task')
        .action(newTask);

    tasksCommand
        .command('list')
        .description('List all tasks')
        .action(listTasks);

    tasksCommand
        .command('delete')
        .description('Delete a task')
        .argument('<taskId>', 'Task ID to delete')
        .action(deleteTask);

    tasksCommand
        .command('inspect')
        .description('Inspect a task')
        .argument('<taskId>', 'Task ID to inspect')
        .action(inspectTask);

    tasksCommand
        .command('start')
        .description('Start a task (set status to IN_PROGRESS)')
        .argument('<taskId>', 'Task ID to start')
        .option('-f, --follow', 'Follow execution logs in real-time')
        .action(startTask);

    tasksCommand
        .command('reset')
        .description('Reset a task to original state and remove worktree/branch')
        .argument('<taskId>', 'Task ID to reset')
        .option('-f, --force', 'Force reset without confirmation')
        .action(resetTask);

    tasksCommand
        .command('iteration')
        .description('Inspect task iteration data')
        .argument('<taskId>', 'Task ID to inspect iterations for')
        .argument('[iterationNumber]', 'Specific iteration number to inspect')
        .action(iterationTask);

    tasksCommand
        .command('iterate')
        .description('Add refinements to a task and start new iteration')
        .argument('<taskId>', 'Task ID to iterate on')
        .argument('<refinements>', 'New requirements or refinements to apply')
        .option('-f, --follow', 'Follow execution logs in real-time')
        .action(iterateTask);

    tasksCommand
        .command('logs')
        .description('Show Docker execution logs for a task iteration')
        .argument('<taskId>', 'Task ID to show logs for')
        .argument('[iterationNumber]', 'Specific iteration number (defaults to latest)')
        .option('-f, --follow', 'Follow log output in real-time')
        .action(logsTask);

    tasksCommand
        .command('merge')
        .description('Commit and merge task changes with AI-generated commit message')
        .argument('<taskId>', 'Task ID to merge')
        .option('-f, --force', 'Skip confirmation prompts')
        .action(mergeTask);

    tasksCommand
        .command('shell')
        .description('Open interactive Docker shell for testing task changes')
        .argument('<taskId>', 'Task ID to open shell for')
        .action(shellTask);

    return tasksCommand;
};

export default createTasksCommand;