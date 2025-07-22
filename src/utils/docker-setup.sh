#!/bin/sh

# Docker container setup script for Rover task execution
# Task description is mounted at /task/description.json

# Check if task description file exists
if [ ! -f "/task/description.json" ]; then
    echo "❌ Task description file not found at /task/description.json"
    exit 1
fi

# Install jq for JSON parsing if not available
if ! command -v jq >/dev/null 2>&1; then
    echo "📦 Installing jq for JSON parsing..."
    apk add --no-cache jq
fi

# Read task data from mounted JSON file
TASK_ID=$(jq -r '.id' /task/description.json)
TASK_TITLE=$(jq -r '.title' /task/description.json)
TASK_DESCRIPTION=$(jq -r '.description' /task/description.json)

echo "====================================="
echo "🚀 Rover Task Execution Setup"
echo "====================================="
echo "Task ID: $TASK_ID"
echo "Task Title: $TASK_TITLE"
echo "====================================="

# Install Claude Code CLI
echo "📦 Installing Claude Code CLI..."
npm install -g @anthropic-ai/claude-code

if [ $? -eq 0 ]; then
    echo "✅ Claude Code CLI installed successfully"
else
    echo "❌ Failed to install Claude Code CLI"
    exit 1
fi

# Create claude user
echo "👤 Creating claude user..."
adduser -D -s /bin/sh claude

if [ $? -eq 0 ]; then
    echo "✅ User 'claude' created successfully"
else
    echo "❌ Failed to create user 'claude'"
    exit 1
fi

# Create claude home directory and copy credentials
echo "🏠 Setting up claude user environment..."
mkdir -p /home/claude/.claude
chown -R claude:claude /home/claude
chown -R claude:claude /workspace

# Process and copy Claude credentials
if [ -f "/.claude.json" ]; then
    echo "📝 Processing Claude credentials..."
    # Copy .claude.json but clear the projects object
    jq '.projects = {}' /.claude.json > /home/claude/.claude.json
    mkdir -p /home/claude/.claude
    cp /.credentials.json /home/claude/.claude/
    chown -R claude:claude /home/claude/.claude
    echo "✅ Claude credentials processed and copied to claude user"
else
    echo "⚠️  No Claude credentials found at /.claude.json, continuing without credentials"
fi

echo "====================================="
echo "🔄 Switching to claude user and starting task execution..."
echo "====================================="

# Switch to claude user and execute task
# Export variables so they're available in the su session
export TASK_ID TASK_TITLE TASK_DESCRIPTION

su claude << 'EOF'
# Change to workspace directory
cd /workspace

# Show current directory and user
echo "Current user: $(whoami)"
echo "Current directory: $(pwd)"
echo "Files in workspace:"
ls -la

# Start Claude Code with the task
echo "Starting Claude Code execution..."
echo "Task: $TASK_TITLE"
echo "Description: $TASK_DESCRIPTION"

# Use the exported environment variables
echo $TASK_DESCRIPTION | claude --dangerously-skip-permissions -p --debug
EOF

echo "====================================="
echo "✅ Task execution completed"
echo "====================================="
