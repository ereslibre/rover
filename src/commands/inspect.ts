import colors from 'ansi-colors';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkAndUpdateTaskStatus, formatTaskStatus } from '../utils/task-status.js';

export const inspectCommand = (taskId: string) => {
    const endorPath = join(process.cwd(), '.rover');
    const tasksPath = join(endorPath, 'tasks');
    const taskPath = join(tasksPath, taskId);
    const descriptionPath = join(taskPath, 'description.json');
    
    // Check if task exists
    if (!existsSync(taskPath) || !existsSync(descriptionPath)) {
        console.log(colors.red(`✗ Task '${taskId}' not found`));
        return;
    }
    
    try {
        // Check and update task status before displaying
        const statusUpdated = checkAndUpdateTaskStatus(taskId);
        if (statusUpdated) {
            console.log(colors.gray('Task status updated based on latest execution'));
        }
        
        // Load task data (potentially updated)
        const taskData = JSON.parse(readFileSync(descriptionPath, 'utf8'));
        
        // Format status with user-friendly names
        const formattedStatus = formatTaskStatus(taskData.status);
        
        // Status color
        const statusColor = taskData.status === 'NEW' ? colors.cyan : 
                           taskData.status === 'IN_PROGRESS' ? colors.yellow :
                           taskData.status === 'COMPLETED' ? colors.green : 
                           taskData.status === 'FAILED' ? colors.red : colors.gray;
        
        console.log(colors.bold('\n🔍 Task Details\n'));
        console.log(colors.gray('ID: ') + colors.cyan(taskData.id));
        console.log(colors.gray('Title: ') + colors.white(taskData.title));
        console.log(colors.gray('Status: ') + statusColor(formattedStatus));
        console.log(colors.gray('Created: ') + colors.white(new Date(taskData.createdAt).toLocaleString()));
        
        // Show completion time if completed
        if (taskData.completedAt) {
            console.log(colors.gray('Completed: ') + colors.green(new Date(taskData.completedAt).toLocaleString()));
        } else if (taskData.failedAt) {
            console.log(colors.gray('Failed: ') + colors.red(new Date(taskData.failedAt).toLocaleString()));
        }
        
        // Show iterations if any
        if (taskData.iterations) {
            console.log(colors.gray('Iterations: ') + colors.cyan(taskData.iterations));
        }
        
        console.log(colors.gray('Description:'));
        console.log(colors.white(taskData.description));
        
        // Show task directory path
        console.log(colors.gray(`\nTask directory: .rover/tasks/${taskId}/`));
        
    } catch (error) {
        console.error(colors.red('Error inspecting task:'), error);
    }
};