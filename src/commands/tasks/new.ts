import enquirer from 'enquirer';
import colors from 'ansi-colors';
import yoctoSpinner from 'yocto-spinner';
import { GeminiAI } from '../../utils/gemini.js';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { TaskExpansion } from '../../types.js';
import { getNextTaskId } from '../../utils/task-id.js';

const { prompt } = enquirer;

export const newTask = async () => {
    // Check if rover is initialized
    const roverPath = join(process.cwd(), '.rover');
    if (!existsSync(roverPath)) {
        console.log(colors.red('✗ Rover is not initialized in this directory'));
        console.log(colors.gray('  Run ') + colors.cyan('rover init') + colors.gray(' first'));
        process.exit(1);
    }

    console.log(colors.bold('\n📝 Create a new task\n'));

    // Get initial task description
    const { description } = await prompt<{ description: string }>({
        type: 'input',
        name: 'description',
        message: 'Briefly describe the task you want to accomplish:',
        validate: (value) => value.trim().length > 0 || 'Please provide a description'
    });

    let taskData: TaskExpansion | null = null;
    let satisfied = false;

    while (!satisfied) {
        // Expand task with Claude
        const spinner = yoctoSpinner({ text: 'Expanding task with AI...' }).start();
        
        try {
            const expanded = await GeminiAI.expandTask(
                taskData ? `${taskData.title}: ${taskData.description}` : description,
                process.cwd()
            );
            
            if (expanded) {
                spinner.success('Task expanded!');
                taskData = expanded;
                
                // Display the expanded task
                console.log('\n' + colors.bold('Task Details:'));
                console.log(colors.gray('Title: ') + colors.cyan(taskData.title));
                console.log(colors.gray('Description: ') + colors.white(taskData.description));
                
                // Ask for confirmation
                const { confirm } = await prompt<{ confirm: string }>({
                    type: 'select',
                    name: 'confirm',
                    message: '\nAre you satisfied with this task?',
                    choices: [
                        { name: 'yes', message: 'Yes, looks good!' },
                        { name: 'refine', message: 'No, I want to add more details' },
                        { name: 'cancel', message: 'Cancel task creation' }
                    ]
                });

                if (confirm === 'yes') {
                    satisfied = true;
                } else if (confirm === 'refine') {
                    // Get additional details
                    const { additionalInfo } = await prompt<{ additionalInfo: string }>({
                        type: 'input',
                        name: 'additionalInfo',
                        message: 'Provide additional information or corrections:',
                        validate: (value) => value.trim().length > 0 || 'Please provide additional information'
                    });
                    
                    // Update the description for next iteration
                    taskData.description = `${taskData.description} Additional context: ${additionalInfo}`;
                } else {
                    // Cancel
                    console.log(colors.yellow('\n⚠ Task creation cancelled'));
                    return;
                }
            } else {
                spinner.error('Failed to expand task');
                console.log(colors.yellow('\n⚠ Claude AI is not available. Creating task with original description.'));
                taskData = {
                    title: description.split(' ').slice(0, 5).join(' '),
                    description: description
                };
                satisfied = true;
            }
        } catch (error) {
            spinner.error('Failed to expand task');
            console.error(colors.red('Error:'), error);
            
            // Fallback to manual task creation
            taskData = {
                title: description.split(' ').slice(0, 5).join(' '),
                description: description
            };
            satisfied = true;
        }
    }

    if (taskData) {
        // Generate auto-increment ID for the task
        const taskId = getNextTaskId();
        
        // Create .endor/tasks directory structure
        const endorPath = join(process.cwd(), '.endor');
        const tasksPath = join(endorPath, 'tasks');
        const taskPath = join(tasksPath, taskId.toString());
        
        // Ensure directories exist
        if (!existsSync(endorPath)) {
            mkdirSync(endorPath, { recursive: true });
        }
        if (!existsSync(tasksPath)) {
            mkdirSync(tasksPath, { recursive: true });
        }
        mkdirSync(taskPath, { recursive: true });
        
        // Create description.json with task metadata and status
        const taskMetadata = {
            id: taskId,
            title: taskData.title,
            description: taskData.description,
            status: 'NEW',
            createdAt: new Date().toISOString()
        };
        
        const descriptionPath = join(taskPath, 'description.json');
        writeFileSync(descriptionPath, JSON.stringify(taskMetadata, null, 2));
        
        console.log(colors.green('\n✓ Task created successfully!'));
        console.log(colors.gray(`  Task ID: ${taskId}`));
        console.log(colors.gray(`  Saved to: .endor/tasks/${taskId}/description.json`));
    }
};