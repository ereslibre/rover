import colors from 'ansi-colors';
import { formatTaskStatus } from '../utils/task-status.js';
import { TaskDescription, TaskNotFoundError } from '../lib/description.js';

export const inspectCommand = (taskId: string, options: { json?: boolean } = {}) => {
    // Convert string taskId to number
    const numericTaskId = parseInt(taskId, 10);
    if (isNaN(numericTaskId)) {
        if (options.json) {
            console.log(JSON.stringify({ error: `Invalid task ID '${taskId}' - must be a number` }, null, 2));
        } else {
            console.log(colors.red(`✗ Invalid task ID '${taskId}' - must be a number`));
        }
        return;
    }
    
    try {
        // Load task using TaskDescription
        const task = TaskDescription.load(numericTaskId);
    
        if (options.json) {
            // Output JSON format
            const jsonOutput = {
                id: task.id,
                uuid: task.uuid,
                title: task.title,
                description: task.description,
                status: task.status,
                formattedStatus: formatTaskStatus(task.status),
                createdAt: task.createdAt,
                startedAt: task.startedAt,
                completedAt: task.completedAt,
                failedAt: task.failedAt,
                lastIterationAt: task.lastIterationAt,
                iterations: task.iterations,
                worktreePath: task.worktreePath,
                branchName: task.branchName,
                error: task.error,
                taskDirectory: `.rover/tasks/${numericTaskId}/`,
                statusUpdated: false // TODO: Implement status checking in TaskDescription
            };
            console.log(JSON.stringify(jsonOutput, null, 2));
        } else {
            // Format status with user-friendly names
            const formattedStatus = formatTaskStatus(task.status);
            
            // Status color
            const statusColor = task.status === 'NEW' ? colors.cyan : 
                               task.status === 'IN_PROGRESS' ? colors.yellow :
                               task.status === 'ITERATING' ? colors.magenta :
                               task.status === 'COMPLETED' ? colors.green : 
                               task.status === 'FAILED' ? colors.red : colors.gray;
            
            console.log(colors.bold('\n🔍 Task Details\n'));
            console.log(colors.gray('ID: ') + colors.cyan(task.id.toString()));
            console.log(colors.gray('UUID: ') + colors.gray(task.uuid));
            console.log(colors.gray('Title: ') + colors.white(task.title));
            console.log(colors.gray('Status: ') + statusColor(formattedStatus));
            console.log(colors.gray('Created: ') + colors.white(new Date(task.createdAt).toLocaleString()));
            
            // Show start time if started
            if (task.startedAt) {
                console.log(colors.gray('Started: ') + colors.white(new Date(task.startedAt).toLocaleString()));
            }
            
            // Show completion time if completed
            if (task.completedAt) {
                console.log(colors.gray('Completed: ') + colors.green(new Date(task.completedAt).toLocaleString()));
            } else if (task.failedAt) {
                console.log(colors.gray('Failed: ') + colors.red(new Date(task.failedAt).toLocaleString()));
            }
            
            // Show iterations
            console.log(colors.gray('Iterations: ') + colors.cyan(task.iterations.toString()));
            
            // Show workspace info if available
            if (task.worktreePath) {
                console.log(colors.gray('Workspace: ') + colors.cyan(task.worktreePath));
                console.log(colors.gray('Branch: ') + colors.cyan(task.branchName));
            }
            
            // Show error if failed
            if (task.error) {
                console.log(colors.gray('Error: ') + colors.red(task.error));
            }
            
            console.log(colors.gray('\nDescription:'));
            console.log(colors.white(task.description));
            
            // Show task directory path
            console.log(colors.gray(`\nTask directory: .rover/tasks/${numericTaskId}/`));
        }
        
    } catch (error) {
        if (error instanceof TaskNotFoundError) {
            if (options.json) {
                console.log(JSON.stringify({ error: error.message }, null, 2));
            } else {
                console.log(colors.red(`✗ ${error.message}`));
            }
        } else {
            if (options.json) {
                console.log(JSON.stringify({ error: `Error inspecting task: ${error}` }, null, 2));
            } else {
                console.error(colors.red('Error inspecting task:'), error);
            }
        }
    }
};