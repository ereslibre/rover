export interface RoverTask {
    id: string;
    title: string;
    status: 'initializing' | 'installing' | 'running' | 'completed' | 'failed' | 'unknown';
    progress?: number;
    currentStep: string;
    startedAt: string;
    completedAt?: string;
    error?: string;
}

export interface TaskDetails extends RoverTask {
    description?: string;
    workDirectory?: string;
    branch?: string;
    iterations?: Array<{
        number: number;
        status: string;
        startedAt: string;
        completedAt?: string;
    }>;
}