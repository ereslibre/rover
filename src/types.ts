export type ProjectType = 'javascript' | 'typescript' | 'php' | 'unknown';
export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'composer' | 'unknown';
export type DevEnvironment = 'devcontainer' | 'docker-compose' | 'dockerfile' | 'none';
export type TaskManager = 'task' | 'just' | 'make' | 'none';

export interface AIAgent {
    name: string;
    installed: boolean;
    initialized: boolean;
    version?: string;
}

export interface ProjectInstructions {
    runDev: string;
    interaction: string;
}

export interface Environment {
    projectType: ProjectType;
    packageManager: PackageManager;
    devEnvironments: DevEnvironment[];
    taskManagers: TaskManager[];
    aiAgents?: AIAgent[];
    instructions?: ProjectInstructions;
}