import colors from 'ansi-colors';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const inspectTask = (taskId: string) => {
    const endorPath = join(process.cwd(), '.endor');
    const tasksPath = join(endorPath, 'tasks');
    const taskPath = join(tasksPath, taskId);
    const descriptionPath = join(taskPath, 'description.json');
    
    // Check if task exists
    if (!existsSync(taskPath) || !existsSync(descriptionPath)) {
        console.log(colors.red(`✗ Task '${taskId}' not found`));
        return;
    }
    
    try {
        // Load task data
        const taskData = JSON.parse(readFileSync(descriptionPath, 'utf8'));
        
        console.log(colors.bold('\n🔍 Task Details\n'));
        console.log(colors.gray('ID: ') + colors.cyan(taskData.id));
        console.log(colors.gray('Title: ') + colors.white(taskData.title));
        console.log(colors.gray('Status: ') + colors.yellow(taskData.status));
        console.log(colors.gray('Created: ') + colors.white(new Date(taskData.createdAt).toLocaleString()));
        console.log(colors.gray('Description:'));
        console.log(colors.white(taskData.description));
        
        // Show task directory path
        console.log(colors.gray(`\nTask directory: .endor/tasks/${taskId}/`));
        
    } catch (error) {
        console.error(colors.red('Error inspecting task:'), error);
    }
};