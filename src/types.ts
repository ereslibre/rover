export type ProjectType = 'javascript' | 'typescript' | 'php' | 'unknown';
export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'composer' | 'unknown';
export type DevEnvironment = 'devcontainer' | 'docker-compose' | 'dockerfile' | 'local';
export type TaskManager = 'task' | 'just' | 'make' | 'none';

export interface ProjectInstructions {
    runDev: string;
    interaction: string;
}

export interface Task {
    id: string;
    title: string;
    description: string;
    createdAt: string;
    status: 'pending' | 'in_progress' | 'completed';
    containerId?: string;
    lastStatusUpdate?: string;
}

export interface TaskStatus {
    taskId: string;
    status: 'initializing' | 'installing' | 'running' | 'completed' | 'failed';
    currentStep: string;
    progress?: number;
    startedAt: string;
    updatedAt: string;
    completedAt?: string;
    error?: string;
}

export interface TaskExpansion {
    title: string;
    description: string;
}

export interface Environment {
    projectType: ProjectType;
    packageManager: PackageManager;
    devEnvironments: DevEnvironment[];
    taskManagers: TaskManager[];
    aiAgents?: string[];
    instructions?: ProjectInstructions;
}