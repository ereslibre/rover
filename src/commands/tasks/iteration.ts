import colors from 'ansi-colors';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

export const iterationTask = (taskId: string, iterationNumber?: string) => {
    const endorPath = join(process.cwd(), '.rover');
    const tasksPath = join(endorPath, 'tasks');
    const taskPath = join(tasksPath, taskId);
    const descriptionPath = join(taskPath, 'description.json');
    const iterationsPath = join(taskPath, 'iterations');
    
    // Check if task exists
    if (!existsSync(taskPath) || !existsSync(descriptionPath)) {
        console.log(colors.red(`✗ Task '${taskId}' not found`));
        return;
    }
    
    try {
        // Load task data
        const taskData = JSON.parse(readFileSync(descriptionPath, 'utf8'));
        
        // Check if iterations directory exists
        if (!existsSync(iterationsPath)) {
            console.log(colors.yellow(`No iterations found for task '${taskId}'`));
            return;
        }
        
        // If no iteration number specified, list all iterations
        if (!iterationNumber) {
            console.log(colors.bold(`\n📋 Task ${taskId} Iterations\n`));
            console.log(colors.gray('Title: ') + colors.white(taskData.title));
            console.log(colors.gray('Total Iterations: ') + colors.cyan(taskData.iterations || 0));
            
            try {
                const iterations = readdirSync(iterationsPath, { withFileTypes: true })
                    .filter(dirent => dirent.isDirectory())
                    .map(dirent => parseInt(dirent.name, 10))
                    .filter(num => !isNaN(num))
                    .sort((a, b) => a - b);
                
                if (iterations.length === 0) {
                    console.log(colors.yellow('\nNo iteration directories found'));
                    return;
                }
                
                console.log(colors.bold('\n📂 Available Iterations:\n'));
                
                iterations.forEach(iter => {
                    const iterPath = join(iterationsPath, iter.toString());
                    const files = readdirSync(iterPath);
                    
                    console.log(colors.cyan(`  #${iter}`));
                    console.log(colors.gray(`    Directory: .rover/tasks/${taskId}/iterations/${iter}/`));
                    console.log(colors.gray(`    Files: ${files.length > 0 ? files.join(', ') : 'empty'}`));
                    console.log();
                });
                
                console.log(colors.gray('Use ') + colors.cyan(`rover tasks iteration ${taskId} <number>`) + colors.gray(' to inspect a specific iteration'));
                
            } catch (error) {
                console.error(colors.red('Error reading iterations directory:'), error);
            }
            
            return;
        }
        
        // Inspect specific iteration
        const iterNum = parseInt(iterationNumber, 10);
        if (isNaN(iterNum)) {
            console.log(colors.red('Invalid iteration number. Please provide a valid number.'));
            return;
        }
        
        const iterationPath = join(iterationsPath, iterNum.toString());
        
        if (!existsSync(iterationPath)) {
            console.log(colors.red(`✗ Iteration ${iterNum} not found for task '${taskId}'`));
            return;
        }
        
        console.log(colors.bold(`\n🔍 Task ${taskId} - Iteration #${iterNum}\n`));
        console.log(colors.gray('Title: ') + colors.white(taskData.title));
        console.log(colors.gray('Iteration Path: ') + colors.cyan(`/rover/tasks/${taskId}/iterations/${iterNum}/`));
        
        try {
            const files = readdirSync(iterationPath);
            
            if (files.length === 0) {
                console.log(colors.yellow('\nNo files found in this iteration'));
                return;
            }
            
            console.log(colors.bold('\n📄 Files in this iteration:\n'));
            
            files.forEach(file => {
                const filePath = join(iterationPath, file);
                const stats = require('fs').statSync(filePath);
                
                console.log(colors.cyan(`📄 ${file}`));
                console.log(colors.gray(`   Size: ${stats.size} bytes`));
                console.log(colors.gray(`   Modified: ${stats.mtime.toLocaleString()}`));
                
                // Show content preview for specific files
                if (file.endsWith('.md') || file.endsWith('.txt')) {
                    try {
                        const content = readFileSync(filePath, 'utf8');
                        const preview = content.length > 200 
                            ? content.substring(0, 200) + '...'
                            : content;
                        
                        console.log(colors.gray('   Preview:'));
                        console.log(colors.white('   ' + preview.split('\n').join('\n   ')));
                    } catch (error) {
                        console.log(colors.gray('   (Could not read file)'));
                    }
                }
                console.log();
            });
            
            // Check for standard iteration files and show their content
            const standardFiles = ['plan.md', 'summary.md', 'prompt.txt'];
            
            standardFiles.forEach(fileName => {
                const filePath = join(iterationPath, fileName);
                if (existsSync(filePath)) {
                    try {
                        const content = readFileSync(filePath, 'utf8');
                        console.log(colors.bold(`\n📖 ${fileName.toUpperCase()}:\n`));
                        console.log(colors.white(content));
                        console.log();
                    } catch (error) {
                        console.log(colors.red(`Error reading ${fileName}:`, error));
                    }
                }
            });
            
        } catch (error) {
            console.error(colors.red('Error reading iteration files:'), error);
        }
        
    } catch (error) {
        console.error(colors.red('Error inspecting iteration:'), error);
    }
};