import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Environment } from '../types.js';

export function saveRoverConfig(projectPath: string, environment: Environment): void {
    // Create .rover directory
    const roverPath = join(projectPath, '.rover');
    mkdirSync(roverPath, { recursive: true });
    
    // Create tasks folder
    const tasksPath = join(roverPath, 'tasks');
    mkdirSync(tasksPath, { recursive: true });
    
    // Save environment to project.json
    const projectJsonPath = join(roverPath, 'project.json');
    const projectData = {
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        environment: {
            projectType: environment.projectType,
            packageManager: environment.packageManager,
            devEnvironments: environment.devEnvironments,
            taskManagers: environment.taskManagers,
            aiAgents: environment.aiAgents || [],
            instructions: environment.instructions || null
        }
    };
    
    writeFileSync(projectJsonPath, JSON.stringify(projectData, null, 2), 'utf-8');
}