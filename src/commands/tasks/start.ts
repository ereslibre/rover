import colors from 'ansi-colors';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { execSync, spawn } from 'node:child_process';
import yoctoSpinner from 'yocto-spinner';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Update task metadata with execution information
 */
const updateTaskMetadata = (taskId: string, updates: any) => {
    try {
        const endorPath = join(process.cwd(), '.rover');
        const tasksPath = join(endorPath, 'tasks');
        const taskPath = join(tasksPath, taskId);
        const descriptionPath = join(taskPath, 'description.json');
        
        if (existsSync(descriptionPath)) {
            const taskData = JSON.parse(readFileSync(descriptionPath, 'utf8'));
            const updatedData = { ...taskData, ...updates };
            writeFileSync(descriptionPath, JSON.stringify(updatedData, null, 2));
        }
    } catch (error) {
        console.error(colors.red('Error updating task metadata:'), error);
    }
};

/**
 * Start Docker container for task execution with Claude CLI
 */
const startDockerExecution = async (taskId: string, taskData: any, worktreePath: string) => {
    const containerName = `rover-task-${taskId}`;
    
    try {
        // Check if Docker is available
        execSync('docker --version', { stdio: 'pipe' });
    } catch (error) {
        console.log(colors.red('\n✗ Docker is not available'));
        console.log(colors.gray('  Please install Docker to use automated task execution'));
        return;
    }

    // Check if Claude credentials exist
    const claudeFile = join(homedir(), '.claude.json');
    const claudeCreds = join(homedir(), '.claude', '.credentials.json');
    if (!existsSync(claudeFile)) {
        console.log(colors.red('\n✗ Claude credentials not found'));
        console.log(colors.gray('  Please run `claude auth` first to set up credentials'));
        return;
    }

    console.log(colors.bold('\n🐳 Starting Docker container for task execution\n'));
    
    // Clean up any existing container with same name
    try {
        execSync(`docker rm -f ${containerName}`, { stdio: 'pipe' });
    } catch (error) {
        // Container doesn't exist, which is fine
    }

    const spinner = yoctoSpinner({ text: 'Starting container...' }).start();

    try {
        // Get path to setup script and task description
        const setupScriptPath = join(__dirname, '../src/utils/docker-setup.sh');
        const taskDescriptionPath = join(process.cwd(), '.rover', 'tasks', taskId, 'description.json');
        
        // Build Docker run command with mounts
        const dockerArgs = [
            'run',
            '--name', containerName,
            '--rm',
            '-it',
            '-v', `${worktreePath}:/workspace:rw`,
            `-v`, `${claudeFile}:/.claude.json:ro`,
            `-v`, `${claudeCreds}:/.credentials.json:ro`,
            '-v', `${setupScriptPath}:/setup.sh:ro`,
            '-v', `${taskDescriptionPath}:/task/description.json:ro`,
            '-w', '/workspace',
            'node:24-alpine',
            '/bin/sh', '/setup.sh'
        ];

        spinner.success('Container started');
        console.log(colors.cyan('Running automated task execution with Claude...\n'));

        // Start Docker container with streaming output
        const dockerProcess = spawn('docker', dockerArgs, {
            stdio: ['inherit', 'pipe', 'pipe']
        });

        let currentStep = 'Initializing';
        console.log(colors.yellow(`📋 Current step: ${currentStep}`));

        // Handle stdout
        dockerProcess.stdout?.on('data', (data) => {
            const output = data.toString();
            
            // Update current step based on output
            if (output.includes('Installing Claude Code CLI')) {
                if (currentStep !== 'Installing Claude Code CLI') {
                    currentStep = 'Installing Claude Code CLI';
                    console.log(colors.yellow(`📋 Current step: ${currentStep}`));
                }
            } else if (output.includes('Creating claude user')) {
                if (currentStep !== 'Setting up claude user') {
                    currentStep = 'Setting up claude user';
                    console.log(colors.yellow(`📋 Current step: ${currentStep}`));
                }
            } else if (output.includes('Starting Claude Code execution')) {
                if (currentStep !== 'Starting Claude Code execution') {
                    currentStep = 'Starting Claude Code execution';
                    console.log(colors.yellow(`📋 Current step: ${currentStep}`));
                }
            } else if (output.includes('Task execution completed')) {
                if (currentStep !== 'Task execution complete') {
                    currentStep = 'Task execution complete';
                    console.log(colors.yellow(`📋 Current step: ${currentStep}`));
                }
            }

            // Display output with proper formatting
            process.stdout.write(colors.gray(output));
        });

        // Handle stderr
        dockerProcess.stderr?.on('data', (data) => {
            process.stderr.write(colors.gray(data.toString()));
        });

        // Handle process completion
        dockerProcess.on('close', (code) => {
            if (code === 0) {
                console.log(colors.green('\n✓ Task execution completed successfully'));
                // Update task metadata
                updateTaskMetadata(taskId, { 
                    executionStatus: 'completed',
                    completedAt: new Date().toISOString(),
                    exitCode: code 
                });
            } else {
                console.log(colors.red(`\n✗ Task execution failed with code ${code}`));
                // Update task metadata
                updateTaskMetadata(taskId, { 
                    executionStatus: 'failed',
                    failedAt: new Date().toISOString(),
                    exitCode: code 
                });
            }
        });

        dockerProcess.on('error', (error) => {
            console.error(colors.red('\nError running Docker container:'), error);
            // Update task metadata
            updateTaskMetadata(taskId, { 
                executionStatus: 'error',
                error: error.message,
                errorAt: new Date().toISOString()
            });
        });

        // Handle process interruption (Ctrl+C)
        process.on('SIGINT', () => {
            console.log(colors.yellow('\n\n⚠ Stopping task execution...'));
            try {
                execSync(`docker stop ${containerName}`, { stdio: 'pipe' });
                console.log(colors.green('✓ Container stopped'));
            } catch (error) {
                console.log(colors.red('✗ Failed to stop container'));
            }
            process.exit(0);
        });

    } catch (error) {
        spinner.error('Failed to start container');
        console.error(colors.red('Error starting Docker container:'), error);
    }
};

export const startTask = async (taskId: string) => {
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
        
        // Check if task is already completed
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

        // Setup git worktree and branch
        const worktreePath = join(taskPath, 'worktree');
        const branchName = `task-${taskId}`;
        
        let isResuming = false;
        
        // Check if worktree and branch already exist
        if (existsSync(worktreePath)) {
            console.log(colors.cyan('📁 Existing worktree found, continuing iteration...'));
            isResuming = true;
        } else {
            const spinner = yoctoSpinner({ text: 'Creating git worktree...' }).start();
            
            try {
                // Check if branch already exists
                let branchExists = false;
                try {
                    execSync(`git show-ref --verify --quiet refs/heads/${branchName}`, { stdio: 'pipe' });
                    branchExists = true;
                } catch (error) {
                    // Branch doesn't exist, which is fine for new worktree
                }
                
                if (branchExists) {
                    // Create worktree from existing branch
                    execSync(`git worktree add "${worktreePath}" "${branchName}"`, { stdio: 'pipe' });
                    spinner.success('Git worktree created from existing branch');
                    console.log(colors.cyan('🔄 Resuming work on existing branch'));
                    isResuming = true;
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
        }

        // Update task status and metadata
        if (!isResuming) {
            taskData.status = 'IN_PROGRESS';
            taskData.startedAt = new Date().toISOString();
        } else {
            // Update iteration info for resuming
            if (!taskData.iterations) taskData.iterations = 0;
            taskData.iterations++;
            taskData.lastIterationAt = new Date().toISOString();
        }
        
        taskData.worktreePath = worktreePath;
        taskData.branchName = branchName;
        
        // Save updated task data
        writeFileSync(descriptionPath, JSON.stringify(taskData, null, 2));
        
        if (isResuming) {
            console.log(colors.bold('\n🔄 Continuing Task Iteration\n'));
            console.log(colors.gray('ID: ') + colors.cyan(taskId));
            console.log(colors.gray('Title: ') + colors.white(taskData.title));
            console.log(colors.gray('Status: ') + colors.yellow('IN_PROGRESS'));
            console.log(colors.gray('Iteration: ') + colors.cyan(`#${taskData.iterations}`));
            console.log(colors.gray('Worktree: ') + colors.cyan(worktreePath));
            console.log(colors.gray('Branch: ') + colors.cyan(branchName));
            
            console.log(colors.green('\n✓ Continuing iteration on existing worktree'));
        } else {
            console.log(colors.bold('\n🚀 Task Started\n'));
            console.log(colors.gray('ID: ') + colors.cyan(taskId));
            console.log(colors.gray('Title: ') + colors.white(taskData.title));
            console.log(colors.gray('Status: ') + colors.yellow('IN_PROGRESS'));
            console.log(colors.gray('Started: ') + colors.white(new Date().toLocaleString()));
            console.log(colors.gray('Worktree: ') + colors.cyan(worktreePath));
            console.log(colors.gray('Branch: ') + colors.cyan(branchName));
            
            console.log(colors.green('\n✓ Task started with dedicated worktree'));
        }
        
        console.log(colors.gray('  You can now work in: ') + colors.cyan(worktreePath));

        // Start Docker container for task execution
        await startDockerExecution(taskId, taskData, worktreePath);
        
    } catch (error) {
        console.error(colors.red('Error starting task:'), error);
    }
};