import colors from 'ansi-colors';
import enquirer from 'enquirer';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const { prompt } = enquirer;

export const deleteTask = async (taskId: string) => {
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
        // Load task data for confirmation
        const taskData = JSON.parse(readFileSync(descriptionPath, 'utf8'));
        
        console.log(colors.bold('\n🗑️  Delete Task\n'));
        console.log(colors.gray('ID: ') + colors.cyan(taskId));
        console.log(colors.gray('Title: ') + colors.white(taskData.title));
        console.log(colors.gray('Status: ') + colors.yellow(taskData.status));
        
        // Confirm deletion
        const { confirm } = await prompt<{ confirm: boolean }>({
            type: 'confirm',
            name: 'confirm',
            message: 'Are you sure you want to delete this task?',
            initial: false
        });
        
        if (confirm) {
            rmSync(taskPath, { recursive: true, force: true });
            console.log(colors.green('\n✓ Task deleted successfully!'));
        } else {
            console.log(colors.yellow('\n⚠ Task deletion cancelled'));
        }
        
    } catch (error) {
        console.error(colors.red('Error deleting task:'), error);
    }
};