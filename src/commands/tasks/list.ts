import colors from 'ansi-colors';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkAndUpdateAllTaskStatuses, formatTaskStatus } from '../../utils/task-status.js';

export const listTasks = () => {
    const endorPath = join(process.cwd(), '.rover');
    const tasksPath = join(endorPath, 'tasks');
    
    // Check if tasks directory exists
    if (!existsSync(tasksPath)) {
        console.log(colors.yellow('No tasks found. Create your first task with:'));
        console.log(colors.cyan('  rover tasks new'));
        return;
    }
    
    try {
        // Read all task directories
        const taskDirs = readdirSync(tasksPath, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);
        
        if (taskDirs.length === 0) {
            console.log(colors.yellow('No tasks found. Create your first task with:'));
            console.log(colors.cyan('  rover tasks new'));
            return;
        }
        
        // Check and update task statuses before displaying
        const updatedTasks = checkAndUpdateAllTaskStatuses();
        if (updatedTasks.length > 0) {
            console.log(colors.gray(`Updated ${updatedTasks.length} task(s) based on latest execution status`));
        }
        
        console.log(colors.bold('\n📋 Tasks\n'));
        
        // Table headers
        const headers = ['ID', 'Title', 'Status', 'Created'];
        const columnWidths = [5, 50, 12, 20];
        
        // Print header
        let headerRow = '';
        headers.forEach((header, i) => {
            headerRow += colors.bold(header.padEnd(columnWidths[i]));
        });
        console.log(headerRow);
        console.log(colors.gray('─'.repeat(columnWidths.reduce((a, b) => a + b, 0))));
        
        // Load and display each task
        taskDirs.forEach(taskId => {
            try {
                const descriptionPath = join(tasksPath, taskId, 'description.json');
                if (existsSync(descriptionPath)) {
                    const taskData = JSON.parse(readFileSync(descriptionPath, 'utf8'));
                    
                    // Truncate title if too long
                    const displayTitle = taskData.title.length > 45
                        ? taskData.title.substring(0, 45) + '...' 
                        : taskData.title;
                    
                    // Format created date
                    const createdDate = new Date(taskData.createdAt).toLocaleDateString();
                    
                    // Format status with user-friendly names
                    const formattedStatus = formatTaskStatus(taskData.status);
                    
                    // Status color
                    const statusColor = taskData.status === 'NEW' ? colors.cyan : 
                                       taskData.status === 'IN_PROGRESS' ? colors.yellow :
                                       taskData.status === 'COMPLETED' ? colors.green : 
                                       taskData.status === 'FAILED' ? colors.red : colors.gray;
                    
                    // Print row
                    let row = '';
                    row += colors.cyan(taskId.padEnd(columnWidths[0]));
                    row += colors.white(displayTitle.padEnd(columnWidths[1]));
                    row += statusColor(formattedStatus.padEnd(columnWidths[2]));
                    row += colors.gray(createdDate.padEnd(columnWidths[3]));
                    console.log(row);
                }
            } catch (error) {
                console.log(colors.red(`Error reading task ${taskId}: ${error}`));
            }
        });
        
        console.log(colors.gray(`\nTotal: ${taskDirs.length} tasks`));
        
    } catch (error) {
        console.error(colors.red('Error listing tasks:'), error);
    }
};