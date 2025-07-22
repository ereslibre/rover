import colors from 'ansi-colors';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import yoctoSpinner from 'yocto-spinner';

export const startTask = (taskId: string) => {
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
        // Load task data
        const taskData = JSON.parse(readFileSync(descriptionPath, 'utf8'));
        
        // Check if task is already in progress or completed
        if (taskData.status === 'IN_PROGRESS') {
            console.log(colors.yellow(`⚠ Task '${taskId}' is already in progress`));
            return;
        }
        
        if (taskData.status === 'COMPLETED') {
            console.log(colors.yellow(`⚠ Task '${taskId}' is already completed`));
            return;
        }
        
        // Check if we're in a git repository
        try {
            execSync('git rev-parse --is-inside-work-tree', { stdio: 'pipe' });
        } catch (error) {
            console.log(colors.red('✗ Not in a git repository'));
            console.log(colors.gray('  Git worktree requires the project to be in a git repository'));
            return;
        }

        // Create git worktree
        const worktreePath = join(taskPath, 'worktree');
        const branchName = `task-${taskId}`;
        
        const spinner = yoctoSpinner({ text: 'Creating git worktree...' }).start();
        
        try {
            // Check if worktree already exists
            if (existsSync(worktreePath)) {
                spinner.error('Worktree already exists');
                console.log(colors.yellow(`⚠ Worktree already exists at: ${worktreePath}`));
            } else {
                // Create new worktree with a new branch
                execSync(`git worktree add "${worktreePath}" -b "${branchName}"`, { stdio: 'pipe' });
                spinner.success('Git worktree created');
            }
        } catch (error) {
            spinner.error('Failed to create worktree');
            console.error(colors.red('Error creating git worktree:'), error);
            return;
        }

        // Update task status to IN_PROGRESS
        taskData.status = 'IN_PROGRESS';
        taskData.startedAt = new Date().toISOString();
        taskData.worktreePath = worktreePath;
        taskData.branchName = branchName;
        
        // Save updated task data
        writeFileSync(descriptionPath, JSON.stringify(taskData, null, 2));
        
        console.log(colors.bold('\n🚀 Task Started\n'));
        console.log(colors.gray('ID: ') + colors.cyan(taskId));
        console.log(colors.gray('Title: ') + colors.white(taskData.title));
        console.log(colors.gray('Status: ') + colors.yellow('IN_PROGRESS'));
        console.log(colors.gray('Started: ') + colors.white(new Date().toLocaleString()));
        console.log(colors.gray('Worktree: ') + colors.cyan(worktreePath));
        console.log(colors.gray('Branch: ') + colors.cyan(branchName));
        
        console.log(colors.green('\n✓ Task started with dedicated worktree'));
        console.log(colors.gray('  You can now work in: ') + colors.cyan(worktreePath));
        
    } catch (error) {
        console.error(colors.red('Error starting task:'), error);
    }
};