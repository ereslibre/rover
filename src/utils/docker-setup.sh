#!/bin/sh

# Docker container setup script for Rover task execution
# Task description is mounted at /task/description.json

# Function to write status updates
write_status() {
    local status="$1"
    local step="$2"
    local progress="$3"
    local error="$4"
    
    cat > /output/status.json << EOF
{
  "taskId": "$TASK_ID",
  "status": "$status",
  "currentStep": "$step",
  "progress": $progress,
  "startedAt": "$START_TIME",
  "updatedAt": "$(date -u +%Y-%m-%dT%H:%M:%S)"$(if [ -n "$error" ]; then echo ",
  \"error\": \"$error\""; fi)$(if [ "$status" = "completed" ] || [ "$status" = "failed" ]; then echo ",
  \"completedAt\": \"$(date -u +%Y-%m-%dT%H:%M:%S)\""; fi)
}
EOF
}

# Set start time
START_TIME=$(date -u +%Y-%m-%dT%H:%M:%S)

# Check if task description file exists
if [ ! -f "/task/description.json" ]; then
    echo "❌ Task description file not found at /task/description.json"
    write_status "failed" "Task description file not found" 0 "Task description file not found at /task/description.json"
    exit 1
fi

# Initialize status
write_status "initializing" "Starting task execution" 5

# Install jq for JSON parsing if not available
if ! command -v jq >/dev/null 2>&1; then
    echo "📦 Installing jq for JSON parsing..."
    write_status "initializing" "Installing jq for JSON parsing" 10
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

write_status "initializing" "Task metadata loaded" 15

# Install Claude Code CLI
echo "📦 Installing Claude Code CLI..."
write_status "installing" "Installing Claude Code CLI" 20
npm install -g @anthropic-ai/claude-code

if [ $? -eq 0 ]; then
    echo "✅ Claude Code CLI installed successfully"
    write_status "installing" "Claude Code CLI installed successfully" 40
else
    echo "❌ Failed to install Claude Code CLI"
    write_status "failed" "Failed to install Claude Code CLI" 20 "npm install failed"
    exit 1
fi

# Create claude user
echo "👤 Creating claude user..."
write_status "installing" "Creating claude user" 50
adduser -D -s /bin/sh claude

if [ $? -eq 0 ]; then
    echo "✅ User 'claude' created successfully"
    write_status "installing" "User 'claude' created successfully" 60
else
    echo "❌ Failed to create user 'claude'"
    write_status "failed" "Failed to create user 'claude'" 50 "adduser command failed"
    exit 1
fi

# Create claude home directory and copy credentials
echo "🏠 Setting up claude user environment..."
write_status "installing" "Setting up claude user environment" 70
mkdir -p /home/claude/.claude
chown -R claude:claude /home/claude
chown -R claude:claude /workspace
chown -R claude:claude /output

# Process and copy Claude credentials
if [ -f "/.claude.json" ]; then
    echo "📝 Processing Claude credentials..."
    write_status "installing" "Processing Claude credentials" 80
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
write_status "running" "Starting Claude Code execution" 90

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

# Set the initial prompt!
touch /output/prompt.txt
echo "As an expert engineer, I want you to complete the following task and complete these steps: " >> /output/prompt.txt
echo "" >> /output/prompt.txt
echo "1. Write a detailed plan about how you plan to complete the task and store it on /output/plan.md" >> /output/prompt.txt
echo "2. Apply the plan and implement all required changes" >> /output/prompt.txt
echo "3. Write a summary that contains a brief paragraph, list of changed files and the purpose. Write it to /output/summary.md" >> /output/prompt.txt
echo "" >> /output/prompt.txt
echo "Remember to complete ALL these steps and ensure all required files are present in /output." >> /output/prompt.txt
echo "" >> /output/prompt.txt
echo "TASK:" >> /output/prompt.txt
echo "" >> /output/prompt.txt
echo "--------------------------------------" >> /output/prompt.txt
echo $TASK_DESCRIPTION >> /output/prompt.txt
echo "--------------------------------------" >> /output/prompt.txt
echo "" >> /output/prompt.txt

# Use the exported environment variables
if cat /output/prompt.txt | claude --dangerously-skip-permissions -p --debug; then
    exit 0
else
    exit 1
fi
EOF

RESULT=$?

echo "====================================="
echo "✅ Setting permissions"
echo "====================================="

# This works in a rootless docker installation
chown -R root:root /workspace
chown -R root:root /output

# Check if Claude execution was successful
if [ $RESULT -eq 0 ]; then
    write_status "completed" "Task execution completed successfully" 100
    echo "====================================="
    echo "✅ Task execution completed"
    echo "====================================="
else
    write_status "failed" "Task execution failed during Claude Code execution" 100 "Claude Code execution returned non-zero exit code"
    echo "====================================="
    echo "❌ Task execution failed"
    echo "====================================="
    exit 1
fi
