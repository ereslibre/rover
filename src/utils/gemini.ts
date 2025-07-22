import { execa } from 'execa';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Environment, ProjectInstructions, TaskExpansion } from '../types.js';

export class GeminiAI {
    private static async invoke(prompt: string, json: boolean = false): Promise<string> {
        const geminiArgs = ['-p'];

        try {
            const { stdout } = await execa('gemini', geminiArgs, {
                input: prompt,
                env: {
                    ...process.env,
                },
            });
            return stdout.trim();
        } catch (error) {
            throw new Error(`Failed to invoke Gemini: ${error}`);
        }
    }

    static async analyzeProject(projectPath: string, environment: Environment): Promise<ProjectInstructions | null> {
        // Gather project context
        const contextFiles = [];
        
        // Read package.json if it exists
        const packageJsonPath = join(projectPath, 'package.json');
        if (existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
            contextFiles.push(`package.json scripts: ${JSON.stringify(packageJson.scripts || {}, null, 2)}`);
        }
        
        // Read README if it exists
        const readmePath = join(projectPath, 'README.md');
        if (existsSync(readmePath)) {
            const readme = readFileSync(readmePath, 'utf-8');
            contextFiles.push(`README.md (first 500 chars): ${readme.substring(0, 500)}...`);
        }
        
        // Read Makefile if it exists
        const makefilePath = join(projectPath, 'Makefile');
        if (existsSync(makefilePath)) {
            const makefile = readFileSync(makefilePath, 'utf-8');
            contextFiles.push(`Makefile (first 300 chars): ${makefile.substring(0, 300)}...`);
        }

        const prompt = `Analyze this project and provide ONLY a JSON response with run instructions:

Project Type: ${environment.projectType}
Package Manager: ${environment.packageManager}
Dev Environments: ${environment.devEnvironments.join(', ')}
Task Managers: ${environment.taskManagers.join(', ')}

Project Files:
${contextFiles.join('\n\n')}

Respond ONLY with valid JSON in this exact format:
{
  "runDev": "command to run the project in development mode",
  "interaction": "brief description of how to interact with the running project"
}

Examples:
- For a web app: {"runDev": "npm run dev", "interaction": "Open http://localhost:3000 in your browser"}
- For a CLI tool: {"runDev": "npm run dev", "interaction": "Run 'npm start' to execute the CLI"}
- For an API: {"runDev": "npm run dev", "interaction": "API available at http://localhost:8080/api"}`;

        try {
            const response = await this.invoke(prompt, true);

            const instructions = JSON.parse(response.replace('```json', '').replace('```', ''));
            return instructions;
        } catch (error) {
            console.error('Failed to analyze project with Claude:', error);
            return null;
        }
    }

    static async expandTask(briefDescription: string, projectPath: string): Promise<TaskExpansion | null> {
        // Load project context
        let projectContext = '';
        
        // Try to load rover project.json
        const roverConfigPath = join(projectPath, '.rover', 'project.json');
        if (existsSync(roverConfigPath)) {
            const config = JSON.parse(readFileSync(roverConfigPath, 'utf-8'));
            projectContext += `Project Type: ${config.environment.projectType}\n`;
            projectContext += `Package Manager: ${config.environment.packageManager}\n`;
            if (config.environment.instructions) {
                projectContext += `Dev Command: ${config.environment.instructions.runDev}\n`;
            }
        }

        // Load package.json if exists
        const packageJsonPath = join(projectPath, 'package.json');
        if (existsSync(packageJsonPath)) {
            const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
            projectContext += `Project Name: ${packageJson.name || 'unknown'}\n`;
            projectContext += `Description: ${packageJson.description || 'none'}\n`;
        }

        const prompt = `Given this brief task description and project context, create a clear, actionable task title and expanded description.

Brief Description: ${briefDescription}

Project Context:
${projectContext}

Respond ONLY with valid JSON in this exact format:
{
  "title": "Concise, action-oriented title (max 10 words)",
  "description": "Detailed description explaining what needs to be done, why, and any relevant context. Include specific steps if applicable. (2-4 sentences)"
}

Examples:
- Brief: "add dark mode"
  Response: {"title": "Implement dark mode toggle", "description": "Add a dark mode toggle to the application's settings page. This should include creating a theme context provider, updating all components to use theme-aware styling, and persisting the user's preference in local storage. Consider accessibility requirements and ensure proper color contrast ratios."}

- Brief: "fix login bug"
  Response: {"title": "Fix authentication error on login", "description": "Investigate and resolve the bug causing users to receive authentication errors during login. Check the JWT token validation, ensure proper error handling in the auth middleware, and verify the connection to the authentication service. Test with multiple user accounts to ensure the fix works universally."}`;

        try {
            const response = await this.invoke(prompt, true);
            const expansion = JSON.parse(response.replace('```json', '').replace('```', ''));
            return expansion as TaskExpansion;
        } catch (error) {
            console.error('Failed to expand task with Claude:', error);
            return null;
        }
    }
}