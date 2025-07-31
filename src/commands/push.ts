import colors from 'ansi-colors';
import enquirer from 'enquirer';
import yoctoSpinner from 'yocto-spinner';
import { execSync, exec } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { TaskDescription, TaskNotFoundError } from '../lib/description.js';

const execAsync = promisify(exec);
const { prompt } = enquirer;

interface PushOptions {
    message?: string;
    pr?: boolean;
    force?: boolean;
}

// Removed TaskData interface - using TaskDescription class instead

/**
 * Check if a command exists
 */
const commandExists = (cmd: string): boolean => {
    try {
        execSync(`which ${cmd}`, { stdio: 'pipe' });
        return true;
    } catch {
        return false;
    }
};

/**
 * Get GitHub repo info from remote URL
 */
const getGitHubRepoInfo = (remoteUrl: string): { owner: string; repo: string } | null => {
    // Handle various GitHub URL formats
    const patterns = [
        /github\.com[:/]([^/]+)\/([^/.]+)(\.git)?$/,
        /^git@github\.com:([^/]+)\/([^/.]+)(\.git)?$/,
        /^https?:\/\/github\.com\/([^/]+)\/([^/.]+)(\.git)?$/
    ];

    for (const pattern of patterns) {
        const match = remoteUrl.match(pattern);
        if (match) {
            return { owner: match[1], repo: match[2] };
        }
    }

    return null;
};

/**
 * Push command implementation
 */
export const pushCommand = async (taskId: string, options: PushOptions) => {
    // Convert string taskId to number
    const numericTaskId = parseInt(taskId, 10);
    if (isNaN(numericTaskId)) {
        console.log(colors.red(`✗ Invalid task ID '${taskId}' - must be a number`));
        process.exit(1);
    }

    // Check if rover is initialized
    const roverPath = join(process.cwd(), '.rover');
    if (!existsSync(roverPath)) {
        console.log(colors.red('✗ Rover is not initialized in this directory'));
        console.log(colors.gray('  Run ') + colors.cyan('rover init') + colors.gray(' first'));
        process.exit(1);
    }

    try {
        // Load task using TaskDescription
        const task = TaskDescription.load(numericTaskId);

        if (!task.worktreePath || !existsSync(task.worktreePath)) {
            console.log(colors.red(`✗ Task workspace not found`));
            console.log(colors.gray('  The task may need to be reinitialized'));
            process.exit(1);
        }

        console.log(colors.bold(`\n📤 Pushing changes for task ${numericTaskId}\n`));

        // Change to worktree directory
        process.chdir(task.worktreePath);

        // Check for changes
        const statusOutput = execSync('git status --porcelain', { encoding: 'utf8' });
        const hasChanges = statusOutput.trim().length > 0;

        if (!hasChanges) {
            // Check if there are unpushed commits
            try {
                const unpushedCommits = execSync(`git rev-list --count origin/${task.branchName}..${task.branchName} 2>/dev/null`, { 
                    encoding: 'utf8' 
                }).trim();
                
                if (unpushedCommits === '0') {
                    console.log(colors.yellow('⚠ No changes to push'));
                    console.log(colors.gray('  Working directory is clean and up to date with remote'));
                    return;
                }
            } catch {
                // Remote branch doesn't exist yet, continue with push
            }
        }

        // If there are changes, commit them
        if (hasChanges) {
            console.log(colors.cyan('Found uncommitted changes:'));
            
            // Show brief status
            const files = statusOutput.trim().split('\n');
            files.forEach(file => {
                const [status, ...pathParts] = file.trim().split(/\s+/);
                const path = pathParts.join(' ');
                const statusSymbol = status.includes('M') ? '±' : status.includes('A') ? '+' : status.includes('D') ? '-' : '?';
                console.log(colors.gray(`  ${statusSymbol} ${path}`));
            });

            // Get commit message
            let commitMessage = options.message;
            if (!commitMessage) {
                const defaultMessage = `Task ${numericTaskId}: ${task.title}`;
                const { message } = await prompt<{ message: string }>({
                    type: 'input',
                    name: 'message',
                    message: 'Commit message:',
                    initial: defaultMessage
                });
                commitMessage = message;
            }

            // Stage and commit changes
            const commitSpinner = yoctoSpinner({ text: 'Committing changes...' }).start();
            try {
                execSync('git add -A', { stdio: 'pipe' });
                execSync(`git commit -m "${commitMessage}"`, { stdio: 'pipe' });
                commitSpinner.success('Changes committed');
            } catch (error: any) {
                commitSpinner.error('Failed to commit changes');
                console.error(colors.red('Error:'), error.message);
                process.exit(1);
            }
        }

        // Push to remote
        const pushSpinner = yoctoSpinner({ text: `Pushing branch ${task.branchName} to remote...` }).start();
        try {
            const pushCommand = `git push origin ${task.branchName}`;
            
            execSync(pushCommand, { stdio: 'pipe' });
            pushSpinner.success(`Branch pushed successfully`);
            console.log(colors.green(`\n✓ Pushed branch: `) + colors.cyan(task.branchName));
        } catch (error: any) {
            pushSpinner.error('Failed to push branch');
            
            // Check if it's because the remote branch doesn't exist
            if (error.message.includes('has no upstream branch')) {
                console.log(colors.yellow('\n⚠ Setting upstream branch and retrying...'));
                try {
                    execSync(`git push --set-upstream origin ${task.branchName}`, { stdio: 'pipe' });
                    console.log(colors.green(`✓ Branch pushed successfully`));
                } catch (retryError: any) {
                    console.error(colors.red('Error:'), retryError.message);
                    process.exit(1);
                }
            } else {
                console.error(colors.red('Error:'), error.message);
                if (!options.force) {
                    console.log(colors.gray('\n  Tip: Use ') + colors.cyan('--force') + colors.gray(' to force push'));
                }
                process.exit(1);
            }
        }

        // Check if this is a GitHub repo
        if (options.pr !== false) {
            try {
                const remoteUrl = execSync('git remote get-url origin', { encoding: 'utf8' }).trim();
                const repoInfo = getGitHubRepoInfo(remoteUrl);

                if (repoInfo) {
                    console.log(colors.gray(`\n📍 GitHub repository detected: ${repoInfo.owner}/${repoInfo.repo}`));

                    // Check if gh CLI is available
                    if (!commandExists('gh')) {
                        console.log(colors.yellow('\n⚠ GitHub CLI (gh) not found'));
                        console.log(colors.gray('  Install it from: https://cli.github.com'));
                        console.log(colors.gray('  Then you can create a PR with: ') + 
                            colors.cyan(`gh pr create --title "${task.title}" --body "${task.description}"`));
                    } else {
                        // Prompt to create PR
                        const { createPR } = await prompt<{ createPR: boolean }>({
                            type: 'confirm',
                            name: 'createPR',
                            message: 'Would you like to create a GitHub Pull Request?',
                            initial: true
                        });

                        if (createPR) {
                            const prSpinner = yoctoSpinner({ text: 'Creating pull request...' }).start();
                            try {
                                // Create PR with task details
                                const prBody = `## Task ${numericTaskId}\n\n${task.description}\n\n---\n*Created by Rover CLI*`;
                                const { stdout } = await execAsync(
                                    `gh pr create --title "${task.title}" --body "${prBody}" --head "${task.branchName}"`
                                );
                                
                                prSpinner.success('Pull request created');
                                
                                // Extract PR URL from output
                                const prUrl = stdout.trim().split('\n').pop();
                                console.log(colors.green('\n✓ Pull Request created: ') + colors.cyan(prUrl || 'Not available'));
                            } catch (error: any) {
                                prSpinner.error('Failed to create pull request');
                                
                                // Check if PR already exists
                                if (error.message.includes('already exists')) {
                                    console.log(colors.yellow('⚠ A pull request already exists for this branch'));
                                    
                                    // Try to get existing PR URL
                                    try {
                                        const { stdout } = await execAsync(`gh pr view ${task.branchName} --json url -q .url`);
                                        console.log(colors.gray('  Existing PR: ') + colors.cyan(stdout.trim()));
                                    } catch {
                                        // Couldn't get PR URL
                                    }
                                } else {
                                    console.error(colors.red('Error:'), error.message);
                                    console.log(colors.gray('\n  You can manually create a PR at:'));
                                    console.log(colors.cyan(`  https://github.com/${repoInfo.owner}/${repoInfo.repo}/pull/new/${task.branchName}`));
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                // Not a GitHub repo or couldn't determine, skip PR creation
            }
        }

        console.log(colors.green('\n✨ Push completed successfully!'));

    } catch (error: any) {
        if (error instanceof TaskNotFoundError) {
            console.log(colors.red(`✗ ${error.message}`));
            console.log(colors.gray('  Use ') + colors.cyan('rover list') + colors.gray(' to see available tasks'));
            process.exit(1);
        } else {
            console.error(colors.red('\n✗ Unexpected error:'), error.message);
            process.exit(1);
        }
    }
};