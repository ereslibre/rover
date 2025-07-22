import { Command } from 'commander';
import { newTask } from './tasks/new.js';
import { listTasks } from './tasks/list.js';
import { deleteTask } from './tasks/delete.js';
import { inspectTask } from './tasks/inspect.js';
import { startTask } from './tasks/start.js';
import { resetTask } from './tasks/reset.js';
import { iterationTask } from './tasks/iteration.js';

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

    return tasksCommand;
};

export default createTasksCommand;