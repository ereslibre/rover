import * as vscode from 'vscode';
import { TaskItem } from './TaskItem';
import { RoverCLI } from '../rover/cli';
import { RoverTask } from '../rover/types';

export class TaskTreeProvider implements vscode.TreeDataProvider<TaskItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TaskItem | undefined | null | void> = new vscode.EventEmitter<TaskItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TaskItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private cli: RoverCLI;
    private autoRefreshInterval: NodeJS.Timeout | undefined;

    constructor() {
        this.cli = new RoverCLI();
        this.startAutoRefresh();
    }

    /**
     * Refresh the tree view
     */
    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    /**
     * Start auto-refresh timer
     */
    private startAutoRefresh(): void {
        // Auto-refresh every 5 seconds
        const interval = vscode.workspace.getConfiguration('rover').get<number>('autoRefreshInterval', 5000);
        if (interval > 0) {
            this.autoRefreshInterval = setInterval(() => {
                this.refresh();
            }, interval);
        }
    }

    /**
     * Stop auto-refresh timer
     */
    dispose(): void {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
        }
    }

    getTreeItem(element: TaskItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: TaskItem): Promise<TaskItem[]> {
        if (!element) {
            // Root level - return all tasks
            try {
                const tasks = await this.cli.getTasks();
                return tasks.map(task => new TaskItem(task));
            } catch (error) {
                if (error instanceof Error) {
                    vscode.window.showErrorMessage(`Failed to fetch tasks: ${error.message}`);
                }
                return [];
            }
        }
        
        // No children for task items
        return [];
    }

    /**
     * Get parent of an element (not used in this simple tree)
     */
    getParent(element: TaskItem): vscode.ProviderResult<TaskItem> {
        return null;
    }
}