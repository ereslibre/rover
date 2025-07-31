import * as vscode from 'vscode';
import { RoverTask } from '../rover/types';

export class TaskItem extends vscode.TreeItem {
    constructor(
        public readonly task: RoverTask,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None
    ) {
        super(task.title, collapsibleState);
        
        this.id = task.id;
        this.description = task.status.toUpperCase();
        this.tooltip = this.getTooltip();
        this.iconPath = this.getIcon();
        this.contextValue = this.getContextValue();
    }

    private getTooltip(): string {
        let tooltip = `Task: ${this.task.title}\n`;
        tooltip += `Status: ${this.task.status}\n`;
        tooltip += `Started: ${new Date(this.task.startedAt).toLocaleString()}\n`;
        
        if (this.task.completedAt) {
            tooltip += `Completed: ${new Date(this.task.completedAt).toLocaleString()}\n`;
        }
        
        if (this.task.progress !== undefined) {
            tooltip += `Progress: ${this.task.progress}%\n`;
        }
        
        if (this.task.currentStep) {
            tooltip += `Current Step: ${this.task.currentStep}\n`;
        }
        
        if (this.task.error) {
            tooltip += `Error: ${this.task.error}`;
        }
        
        return tooltip;
    }

    private getIcon(): vscode.ThemeIcon {
        switch (this.task.status) {
            case 'initializing':
                return new vscode.ThemeIcon('loading~spin');
            case 'installing':
                return new vscode.ThemeIcon('cloud-download');
            case 'running':
                return new vscode.ThemeIcon('play-circle');
            case 'completed':
                return new vscode.ThemeIcon('check-all', new vscode.ThemeColor('terminal.ansiGreen'));
            case 'failed':
                return new vscode.ThemeIcon('error', new vscode.ThemeColor('terminal.ansiRed'));
            default:
                return new vscode.ThemeIcon('circle-outline');
        }
    }

    private getContextValue(): string {
        // Context value determines which commands are shown in the context menu
        switch (this.task.status) {
            case 'running':
            case 'initializing':
            case 'installing':
                return 'task-running';
            case 'completed':
                return 'task-completed';
            case 'failed':
                return 'task-failed';
            default:
                return 'task-unknown';
        }
    }
}