import * as vscode from 'vscode';
import { TaskTreeProvider } from './providers/TaskTreeProvider';
import { RoverCLI } from './rover/cli';
import { TaskItem } from './providers/TaskItem';

let taskTreeProvider: TaskTreeProvider;

export function activate(context: vscode.ExtensionContext) {
    console.log('Rover extension is now active!');

    // Initialize the CLI wrapper
    const cli = new RoverCLI();

    // Create and register the Task Tree Provider
    taskTreeProvider = new TaskTreeProvider();
    const treeView = vscode.window.createTreeView('roverTasks', {
        treeDataProvider: taskTreeProvider,
        showCollapseAll: true
    });
    context.subscriptions.push(treeView);

    // Register the refresh command
    const refreshCommand = vscode.commands.registerCommand('rover.refresh', () => {
        taskTreeProvider.refresh();
    });
    context.subscriptions.push(refreshCommand);

    // Register the create task command
    const createTaskCommand = vscode.commands.registerCommand('rover.createTask', async () => {
        const description = await vscode.window.showInputBox({
            prompt: 'Enter task description',
            placeHolder: 'e.g., Fix the login bug in authentication module',
            ignoreFocusOut: true
        });

        if (description) {
            try {
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: 'Creating Rover task...',
                    cancellable: false
                }, async () => {
                    await cli.createTask(description);
                });
                
                vscode.window.showInformationMessage('Task created successfully!');
                taskTreeProvider.refresh();
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to create task: ${error}`);
            }
        }
    });
    context.subscriptions.push(createTaskCommand);

    // Register the inspect task command
    const inspectTaskCommand = vscode.commands.registerCommand('rover.inspectTask', async (item: TaskItem) => {
        try {
            const taskDetails = await cli.inspectTask(item.task.id);
            
            // Create a virtual document with the task details
            const content = JSON.stringify(taskDetails, null, 2);
            const doc = await vscode.workspace.openTextDocument({
                content: content,
                language: 'json'
            });
            
            await vscode.window.showTextDocument(doc, {
                preview: true,
                viewColumn: vscode.ViewColumn.Beside
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to inspect task: ${error}`);
        }
    });
    context.subscriptions.push(inspectTaskCommand);

    // Register the delete task command
    const deleteTaskCommand = vscode.commands.registerCommand('rover.deleteTask', async (item: TaskItem) => {
        const answer = await vscode.window.showWarningMessage(
            `Are you sure you want to delete task "${item.task.title}"?`,
            'Yes',
            'No'
        );

        if (answer === 'Yes') {
            try {
                await cli.deleteTask(item.task.id);
                vscode.window.showInformationMessage('Task deleted successfully!');
                taskTreeProvider.refresh();
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to delete task: ${error}`);
            }
        }
    });
    context.subscriptions.push(deleteTaskCommand);

    // Register the shell command
    const shellCommand = vscode.commands.registerCommand('rover.shell', (item: TaskItem) => {
        cli.startShell(item.task.id);
    });
    context.subscriptions.push(shellCommand);

    // Register the logs command
    const logsCommand = vscode.commands.registerCommand('rover.logs', async (item: TaskItem) => {
        try {
            await cli.showLogs(item.task.id, true);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to show logs: ${error}`);
        }
    });
    context.subscriptions.push(logsCommand);

    // Clean up the tree provider when extension is deactivated
    context.subscriptions.push({
        dispose: () => {
            taskTreeProvider.dispose();
        }
    });
}

export function deactivate() {
    if (taskTreeProvider) {
        taskTreeProvider.dispose();
    }
}