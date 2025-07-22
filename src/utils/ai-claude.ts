import { execa } from 'execa';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Environment, ProjectInstructions } from '../types.js';

export class ClaudeAI {
    private static async invoke(prompt: string, json: boolean = false): Promise<string> {
        const claudeArgs = ['-p'];

        if (json) {
            claudeArgs.push('--output-format');
            claudeArgs.push('json');
        }

        try {
            const { stdout } = await execa('claude', claudeArgs, {
                input: prompt,
                env: {
                    ...process.env,
                    // Ensure non-interactive mode
                    CLAUDE_NON_INTERACTIVE: 'true'
                },
            });
            return stdout.trim();
        } catch (error) {
            throw new Error(`Failed to invoke Claude: ${error}`);
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

            // Extract JSON from response (Claude might add extra text)
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }
            
            const { result } = JSON.parse(jsonMatch[0]);
            const instructions = JSON.parse(result.replace('```json', '').replace('```', ''));
            return instructions;
        } catch (error) {
            console.error('Failed to analyze project with Claude:', error);
            return null;
        }
    }
}