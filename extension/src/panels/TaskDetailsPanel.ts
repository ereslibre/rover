import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { RoverCLI } from '../rover/cli';
import { TaskDetails } from '../rover/types';

export class TaskDetailsPanel {
    public static currentPanel: TaskDetailsPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];
    private readonly _cli: RoverCLI;

    public static createOrShow(extensionUri: vscode.Uri, taskId: string, taskTitle: string) {
        const column = vscode.window.activeTextEditor
            ? vscode.ViewColumn.Beside
            : vscode.ViewColumn.One;

        // If we already have a panel, show it
        if (TaskDetailsPanel.currentPanel) {
            TaskDetailsPanel.currentPanel._panel.reveal(column);
            TaskDetailsPanel.currentPanel.loadTaskDetails(taskId);
            return;
        }

        // Otherwise, create a new panel
        const panel = vscode.window.createWebviewPanel(
            'roverTaskDetails',
            `Task: ${taskTitle}`,
            column,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'dist'),
                    vscode.Uri.joinPath(extensionUri, 'src')
                ]
            }
        );

        TaskDetailsPanel.currentPanel = new TaskDetailsPanel(panel, extensionUri, taskId);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, taskId: string) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._cli = new RoverCLI();

        // Set the webview's initial html content
        this._update();

        // Listen for when the panel is disposed
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'ready':
                        this.loadTaskDetails(taskId);
                        return;
                    case 'openFile':
                        this.openFile(message.filePath);
                        return;
                    case 'executeAction':
                        this.executeAction(message.action, message.taskId);
                        return;
                }
            },
            null,
            this._disposables
        );

        // Load initial task details
        this.loadTaskDetails(taskId);
    }

    private async loadTaskDetails(taskId: string) {
        try {
            const taskDetails = await this._cli.inspectTask(taskId);
            const enhancedDetails = await this.enhanceTaskDetailsWithIterations(taskDetails);
            
            this._panel.webview.postMessage({
                command: 'updateTaskData',
                data: enhancedDetails
            });
        } catch (error) {
            this._panel.webview.postMessage({
                command: 'showError',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }

    private async enhanceTaskDetailsWithIterations(taskDetails: TaskDetails): Promise<TaskDetails & { iterations: any[] }> {
        const iterations: any[] = [];
        
        // Get workspace root
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            console.warn('No workspace root available for task iterations');
            return { ...taskDetails, iterations };
        }

        // Validate taskDetails.id
        if (!taskDetails.id) {
            console.warn('Task ID is undefined or empty');
            return { ...taskDetails, iterations };
        }

        // Check for task directory
        const taskDir = path.join(workspaceRoot, '.rover', 'tasks', taskDetails.id);
        if (!fs.existsSync(taskDir)) {
            console.info(`Task directory does not exist: ${taskDir}`);
            return { ...taskDetails, iterations };
        }

        try {
            // Look for iteration directories (typically numbered)
            const entries = fs.readdirSync(taskDir, { withFileTypes: true });
            const iterationDirs = entries
                .filter(entry => entry.isDirectory() && /^\d+$/.test(entry.name))
                .sort((a, b) => parseInt(a.name) - parseInt(b.name));

            for (const iterationDir of iterationDirs) {
                const iterationPath = path.join(taskDir, iterationDir.name);
                const iterationNumber = parseInt(iterationDir.name);
                
                // Check for common files in iteration directory
                const commonFiles = ['summary.md', 'validation.md', 'planning.md'];
                const files = commonFiles.map(fileName => {
                    const filePath = path.join(iterationPath, fileName);
                    return {
                        name: fileName,
                        path: filePath,
                        exists: fs.existsSync(filePath)
                    };
                });

                // Try to get iteration metadata if available
                const metadataPath = path.join(iterationPath, 'metadata.json');
                let iterationMeta: any = {
                    number: iterationNumber,
                    status: 'unknown'
                };

                if (fs.existsSync(metadataPath)) {
                    try {
                        const metadataContent = fs.readFileSync(metadataPath, 'utf8');
                        iterationMeta = { ...iterationMeta, ...JSON.parse(metadataContent) };
                    } catch (error) {
                        // Ignore metadata parsing errors
                    }
                }

                iterations.push({
                    ...iterationMeta,
                    files
                });
            }
        } catch (error) {
            console.warn('Error reading task iterations:', error);
        }

        return { ...taskDetails, iterations };
    }

    private async openFile(filePath: string) {
        try {
            const uri = vscode.Uri.file(filePath);
            await vscode.window.showTextDocument(uri, {
                preview: true,
                viewColumn: vscode.ViewColumn.Beside
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to open file: ${error}`);
        }
    }

    private async executeAction(action: string, taskId: string) {
        if (!taskId) {
            vscode.window.showErrorMessage('Task ID is missing');
            return;
        }

        switch (action) {
            case 'logs':
                vscode.commands.executeCommand('rover.logs', { id: taskId, task: { id: taskId } });
                break;
            case 'shell':
                vscode.commands.executeCommand('rover.shell', { id: taskId, task: { id: taskId } });
                break;
            case 'delete':
                const confirmed = await vscode.window.showWarningMessage(
                    `Are you sure you want to delete task "${taskId}"?`,
                    'Yes',
                    'No'
                );
                if (confirmed === 'Yes') {
                    vscode.commands.executeCommand('rover.deleteTask', { id: taskId, task: { id: taskId } });
                    this.dispose(); // Close the panel after deletion
                }
                break;
            case 'refresh':
                this.loadTaskDetails(taskId);
                break;
            default:
                vscode.window.showWarningMessage(`Unknown action: ${action}`);
        }
    }

    public dispose() {
        TaskDetailsPanel.currentPanel = undefined;

        // Clean up our resources
        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    private _update() {
        this._panel.webview.html = this._getHtmlForWebview();
    }

    private _getHtmlForWebview() {
        // Since we're using esbuild, we'll inline the HTML template
        // This avoids path resolution issues in the built extension
        return this._getInlineHtmlTemplate();
    }

    private _getInlineHtmlTemplate(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Task Details</title>
    <style>
        :root {
            --vscode-font-family: var(--vscode-font-family);
            --container-padding: 20px;
            --section-spacing: 16px;
            --border-radius: 4px;
        }

        body {
            font-family: var(--vscode-font-family);
            padding: var(--container-padding);
            margin: 0;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            line-height: 1.6;
        }

        .header {
            display: flex;
            align-items: center;
            margin-bottom: var(--section-spacing);
            padding-bottom: 12px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .header-icon {
            margin-right: 8px;
            font-size: 18px;
        }

        .header-title {
            font-size: 18px;
            font-weight: 600;
            margin: 0;
        }

        .section {
            margin-bottom: var(--section-spacing);
            background-color: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: var(--border-radius);
            overflow: hidden;
        }

        .section-header {
            padding: 12px 16px;
            background-color: var(--vscode-list-hoverBackground);
            border-bottom: 1px solid var(--vscode-input-border);
            font-weight: 600;
            display: flex;
            align-items: center;
            cursor: pointer;
            user-select: none;
        }

        .section-header:hover {
            background-color: var(--vscode-list-activeSelectionBackground);
        }

        .section-icon {
            margin-right: 8px;
        }

        .section-content {
            padding: 16px;
        }

        .section-content.collapsed {
            display: none;
        }

        .expand-icon {
            margin-left: auto;
            transition: transform 0.2s ease;
        }

        .expand-icon.expanded {
            transform: rotate(90deg);
        }

        .field-row {
            display: flex;
            margin-bottom: 8px;
            align-items: center;
        }

        .field-label {
            font-weight: 500;
            min-width: 80px;
            margin-right: 12px;
            color: var(--vscode-descriptionForeground);
        }

        .field-value {
            flex: 1;
        }

        .status-badge {
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
        }

        .status-completed {
            background-color: var(--vscode-testing-iconPassed);
            color: var(--vscode-editor-background);
        }

        .status-failed {
            background-color: var(--vscode-testing-iconFailed);
            color: var(--vscode-editor-background);
        }

        .status-running {
            background-color: var(--vscode-testing-iconQueued);
            color: var(--vscode-editor-background);
        }

        .status-new {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
        }

        .description {
            background-color: var(--vscode-textBlockQuote-background);
            border-left: 4px solid var(--vscode-textBlockQuote-border);
            padding: 12px 16px;
            margin: 12px 0;
            font-style: italic;
            border-radius: 0 var(--border-radius) var(--border-radius) 0;
        }

        .iteration {
            border: 1px solid var(--vscode-input-border);
            border-radius: var(--border-radius);
            margin-bottom: 12px;
            overflow: hidden;
        }

        .iteration-header {
            padding: 10px 12px;
            background-color: var(--vscode-list-inactiveSelectionBackground);
            border-bottom: 1px solid var(--vscode-input-border);
            display: flex;
            align-items: center;
            cursor: pointer;
            user-select: none;
        }

        .iteration-header:hover {
            background-color: var(--vscode-list-hoverBackground);
        }

        .iteration-title {
            font-weight: 500;
            margin-right: 12px;
        }

        .iteration-content {
            padding: 12px;
        }

        .iteration-content.collapsed {
            display: none;
        }

        .file-buttons {
            display: flex;
            gap: 8px;
            margin-top: 8px;
            flex-wrap: wrap;
        }

        .file-button {
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 12px;
            border-radius: var(--border-radius);
            cursor: pointer;
            font-size: 12px;
            display: flex;
            align-items: center;
            transition: background-color 0.2s ease;
        }

        .file-button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        .file-button:disabled {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            cursor: not-allowed;
            opacity: 0.6;
        }

        .file-button-icon {
            margin-right: 4px;
        }

        .action-buttons {
            display: flex;
            gap: 12px;
            margin-top: 8px;
            flex-wrap: wrap;
        }

        .action-button {
            background-color: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            border: 1px solid var(--vscode-button-border);
            padding: 8px 16px;
            border-radius: var(--border-radius);
            cursor: pointer;
            font-size: 13px;
            display: flex;
            align-items: center;
            transition: all 0.2s ease;
        }

        .action-button:hover {
            background-color: var(--vscode-button-secondaryHoverBackground);
        }

        .action-button-icon {
            margin-right: 6px;
        }

        .loading {
            text-align: center;
            padding: 40px;
            color: var(--vscode-descriptionForeground);
        }

        .error {
            color: var(--vscode-errorForeground);
            background-color: var(--vscode-inputValidation-errorBackground);
            border: 1px solid var(--vscode-inputValidation-errorBorder);
            padding: 12px;
            border-radius: var(--border-radius);
            margin: 12px 0;
        }

        .no-iterations {
            text-align: center;
            padding: 20px;
            color: var(--vscode-descriptionForeground);
            font-style: italic;
        }
    </style>
</head>
<body>
    <div id="loading" class="loading">
        <div>🔄 Loading task details...</div>
    </div>

    <div id="content" style="display: none;">
        <div class="header">
            <span class="header-icon">🔍</span>
            <h1 class="header-title" id="taskTitle">Task Details</h1>
        </div>

        <div class="section">
            <div class="section-header">
                <span class="section-icon">📋</span>
                <span>Overview</span>
            </div>
            <div class="section-content">
                <div class="field-row">
                    <span class="field-label">ID:</span>
                    <span class="field-value" id="taskId">-</span>
                </div>
                <div class="field-row">
                    <span class="field-label">Status:</span>
                    <span class="field-value">
                        <span id="taskStatus" class="status-badge">-</span>
                    </span>
                </div>
                <div class="field-row">
                    <span class="field-label">Created:</span>
                    <span class="field-value" id="taskCreated">-</span>
                </div>
                <div class="field-row" id="taskCompletedRow" style="display: none;">
                    <span class="field-label">Completed:</span>
                    <span class="field-value" id="taskCompleted">-</span>
                </div>
                <div class="field-row" id="taskFailedRow" style="display: none;">
                    <span class="field-label">Failed:</span>
                    <span class="field-value" id="taskFailed">-</span>
                </div>
            </div>
        </div>

        <div class="section">
            <div class="section-header">
                <span class="section-icon">📝</span>
                <span>Description</span>
            </div>
            <div class="section-content">
                <div class="description" id="taskDescription">-</div>
            </div>
        </div>

        <div class="section">
            <div class="section-header" onclick="toggleSection('iterations')">
                <span class="section-icon">🔄</span>
                <span>Iterations</span>
                <span class="expand-icon" id="iterationsExpandIcon">▼</span>
            </div>
            <div class="section-content" id="iterationsContent">
                <div id="iterationsList"></div>
                <div id="noIterations" class="no-iterations" style="display: none;">
                    No iterations found
                </div>
            </div>
        </div>

        <div class="section">
            <div class="section-header">
                <span class="section-icon">🛠️</span>
                <span>Actions</span>
            </div>
            <div class="section-content">
                <div class="action-buttons">
                    <button class="action-button" onclick="executeAction('logs')">
                        <span class="action-button-icon">📄</span>
                        View Logs
                    </button>
                    <button class="action-button" onclick="executeAction('shell')" id="shellButton">
                        <span class="action-button-icon">💻</span>
                        Open Shell
                    </button>
                    <button class="action-button" onclick="executeAction('delete')" style="color: var(--vscode-errorForeground);">
                        <span class="action-button-icon">🗑️</span>
                        Delete Task
                    </button>
                    <button class="action-button" onclick="executeAction('refresh')">
                        <span class="action-button-icon">🔄</span>
                        Refresh
                    </button>
                </div>
            </div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        let currentTaskData = null;

        function toggleSection(sectionId) {
            const content = document.getElementById(sectionId + 'Content');
            const icon = document.getElementById(sectionId + 'ExpandIcon');
            
            if (content.classList.contains('collapsed')) {
                content.classList.remove('collapsed');
                icon.textContent = '▼';
                icon.classList.add('expanded');
            } else {
                content.classList.add('collapsed');
                icon.textContent = '▶';
                icon.classList.remove('expanded');
            }
        }

        function toggleIteration(iterationId) {
            const content = document.getElementById('iteration-content-' + iterationId);
            const icon = document.getElementById('iteration-icon-' + iterationId);
            
            if (content.classList.contains('collapsed')) {
                content.classList.remove('collapsed');
                icon.textContent = '▼';
            } else {
                content.classList.add('collapsed');
                icon.textContent = '▶';
            }
        }

        function openFile(filePath) {
            vscode.postMessage({
                command: 'openFile',
                filePath: filePath
            });
        }

        function executeAction(action) {
            vscode.postMessage({
                command: 'executeAction',
                action: action,
                taskId: currentTaskData?.id
            });
        }

        function getStatusClass(status) {
            switch (status?.toLowerCase()) {
                case 'completed': return 'status-completed';
                case 'failed': return 'status-failed';
                case 'in_progress': case 'running': return 'status-running';
                default: return 'status-new';
            }
        }

        function formatDate(dateString) {
            if (!dateString) return '-';
            return new Date(dateString).toLocaleString();
        }

        function renderIterations(iterations) {
            const container = document.getElementById('iterationsList');
            const noIterations = document.getElementById('noIterations');
            
            if (!iterations || iterations.length === 0) {
                container.innerHTML = '';
                noIterations.style.display = 'block';
                return;
            }

            noIterations.style.display = 'none';
            
            container.innerHTML = iterations.map((iteration, index) => \`
                <div class="iteration">
                    <div class="iteration-header" onclick="toggleIteration(\${index})">
                        <span class="iteration-title">Iteration \${iteration.number || (index + 1)}</span>
                        <span class="status-badge \${getStatusClass(iteration.status)}">\${iteration.status || 'Unknown'}</span>
                        <span class="expand-icon" id="iteration-icon-\${index}">▼</span>
                    </div>
                    <div class="iteration-content" id="iteration-content-\${index}">
                        <div class="field-row">
                            <span class="field-label">Started:</span>
                            <span class="field-value">\${formatDate(iteration.startedAt)}</span>
                        </div>
                        \${iteration.completedAt ? \`
                        <div class="field-row">
                            <span class="field-label">Completed:</span>
                            <span class="field-value">\${formatDate(iteration.completedAt)}</span>
                        </div>
                        \` : ''}
                        <div class="field-row">
                            <span class="field-label">Files:</span>
                            <div class="field-value">
                                <div class="file-buttons">
                                    \${iteration.files?.map(file => \`
                                        <button class="file-button" onclick="openFile('\${file.path}')" \${!file.exists ? 'disabled' : ''}>
                                            <span class="file-button-icon">📄</span>
                                            \${file.name}
                                        </button>
                                    \`).join('') || '<span style="color: var(--vscode-descriptionForeground); font-style: italic;">No files available</span>'}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            \`).join('');
        }

        function updateTaskDetails(taskData) {
            currentTaskData = taskData;
            
            document.getElementById('taskTitle').textContent = \`Task Details: \${taskData.title}\`;
            document.getElementById('taskId').textContent = taskData.id;
            document.getElementById('taskDescription').textContent = taskData.description;
            document.getElementById('taskCreated').textContent = formatDate(taskData.createdAt);
            
            const statusElement = document.getElementById('taskStatus');
            statusElement.textContent = taskData.formattedStatus || taskData.status;
            statusElement.className = 'status-badge ' + getStatusClass(taskData.status);
            
            // Show/hide completed/failed dates
            const completedRow = document.getElementById('taskCompletedRow');
            const failedRow = document.getElementById('taskFailedRow');
            
            if (taskData.completedAt) {
                document.getElementById('taskCompleted').textContent = formatDate(taskData.completedAt);
                completedRow.style.display = 'flex';
                failedRow.style.display = 'none';
            } else if (taskData.failedAt) {
                document.getElementById('taskFailed').textContent = formatDate(taskData.failedAt);
                failedRow.style.display = 'flex';
                completedRow.style.display = 'none';
            } else {
                completedRow.style.display = 'none';
                failedRow.style.display = 'none';
            }
            
            // Update shell button availability
            const shellButton = document.getElementById('shellButton');
            const isRunning = ['running', 'in_progress'].includes(taskData.status?.toLowerCase());
            shellButton.disabled = !isRunning;
            
            renderIterations(taskData.iterations);
            
            // Show content, hide loading
            document.getElementById('loading').style.display = 'none';
            document.getElementById('content').style.display = 'block';
        }

        function showError(message) {
            document.getElementById('loading').innerHTML = \`
                <div class="error">
                    ❌ Error loading task details: \${message}
                </div>
            \`;
        }

        // Listen for messages from the extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'updateTaskData':
                    updateTaskDetails(message.data);
                    break;
                case 'showError':
                    showError(message.message);
                    break;
            }
        });

        // Request initial data load
        vscode.postMessage({ command: 'ready' });
    </script>
</body>
</html>`;
    }
}