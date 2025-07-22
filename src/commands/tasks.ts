import { Command } from 'commander';
import { newTask } from './tasks/new.js';
import { listTasks } from './tasks/list.js';
import { deleteTask } from './tasks/delete.js';
import { inspectTask } from './tasks/inspect.js';

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

    return tasksCommand;
};

export default createTasksCommand;