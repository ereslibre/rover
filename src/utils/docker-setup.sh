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
write_status "initializing" "Starting task" 5

# Install jq for JSON parsing if not available
if ! command -v jq >/dev/null 2>&1; then
    echo "📦 Installing jq for JSON parsing..."
    write_status "initializing" "Installing jq for JSON parsing" 5
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

write_status "initializing" "Load metadata" 5

# Install Claude Code CLI
echo "📦 Installing Claude Code CLI..."
write_status "installing" "Install Claude Code" 5
npm install -g @anthropic-ai/claude-code

if [ $? -eq 0 ]; then
    echo "✅ Claude Code CLI installed successfully"
    write_status "installing" "Claude Code installed" 10
else
    echo "❌ Failed to install Claude Code CLI"
    write_status "failed" "Failed to install Claude Code" 100 "npm install failed"
    exit 1
fi

# Create claude user
echo "👤 Creating claude user..."
write_status "installing" "Creating claude user" 10
adduser -D -s /bin/sh claude

if [ $? -eq 0 ]; then
    echo "✅ User 'claude' created successfully"
    write_status "installing" "Create user 'claude'" 15
else
    echo "❌ Failed to create user 'claude'"
    write_status "failed" "Failed to create user 'claude'" 100 "adduser command failed"
    exit 1
fi

# Create claude home directory and copy credentials
echo "🏠 Setting up claude user environment..."
write_status "installing" "Setting up claude user environment" 15
mkdir -p /home/claude/.claude
chown -R claude:claude /home/claude
chown -R claude:claude /workspace
chown -R claude:claude /output

# Claude folder
mkdir -p /home/claude/.claude

# Process and copy Claude credentials
if [ -f "/.claude.json" ]; then
    echo "📝 Processing Claude configuration..."
    write_status "installing" "Claude configuration" 20
    # Copy .claude.json but clear the projects object
    jq '.projects = {}' /.claude.json > /home/claude/.claude.json
    echo "✅ Claude configuration processed and copied to claude user"
else
    echo "⚠️  No Claude config found at /.claude.json, continuing..."
fi

if [ -f "/.credentials.json" ]; then
    echo "📝 Processing Claude credentials..."
    write_status "installing" "Claude credentials" 20
    cp /.credentials.json /home/claude/.claude/
    echo "✅ Claude credentials processed and copied to claude user"
else
    echo "⚠️  No Claude credentials found, continuing..."
fi

# Update permissions
chown -R claude:claude /home/claude/.claude

echo "====================================="
echo "🔄 Switching to claude user and starting task execution..."
echo "====================================="
write_status "running" "Plan phase" 20

# Switch to claude user and execute task
# Export variables so they're available in the su session
export TASK_ID TASK_TITLE TASK_DESCRIPTION

success=0

# Planning step
su claude << EOF
# Change to workspace directory
cd /workspace

cat >> /output/prompt.txt << END
You are an expert software architect tasked with creating a detailed implementation plan for changes to a codebase. Your output will be a \`/output/planning.md\` file that serves as a comprehensive document for implementing the requested changes. Remember to write this file after you conclude the planning.

## User request

The user provided this description you must create the plan for:

=================
Title: $TASK_TITLE

$TASK_DESCRIPTION
=================

## Planning

Analyze the requested change and create an implementation plan that includes:

### 1. Change Overview
- **Objective**: Clear statement of what needs to be accomplished
- **Scope**: Boundaries of the change (what's included/excluded). Minimize the changes and stay focused on the user task.

### 2. Implementation Strategy
Break down the implementation into logical steps. Just provide a list with the different steps to complete this task. Keep it short, concise and simple.

### 3. Implementation Checklist
Create a sequential checklist that can be followed:
- [ ] Pre-implementation setup
- [ ] Core implementation tasks (numbered and ordered)
- [ ] Testing and validation
- [ ] Documentation updates

## Output Format

Your planning.md should be:
- Written in clear, actionable language
- Concise language
- Include code snippets where helpful
- Use markdown formatting for readability
- Include mermaid diagrams for complex flows when required

Remember: The goal is to create a concise and detailed plan that another developer could implement the changes without additional context. Be specific, thorough, and anticipate edge cases. Finally, save the plan into the /output/planning.md file located at the system root.
END

if cat /output/prompt.txt | claude --dangerously-skip-permissions -p --debug; then
    exit 0
else
    exit 1
fi

EOF

# Check implementation result
if [ $? -eq 0 ]; then
    write_status "running" "Implementation phase" 40
else
    write_status "failed" "Implementation phase failed" 100 "Claude Code implementation failed"
    exit 1
fi

# Cleanup
rm /output/prompt.txt

# Implementation phase
su claude << EOF
# Change to workspace directory
cd /workspace

# Create implementation prompt
cat >> /output/prompt.txt << END
Based on the planning document at /output/planning.md, implement all the changes described in the plan.

Follow these guidelines:
1. Execute each phase as outlined in the plan
2. Make all necessary file modifications
3. Create any new files required
4. Follow the exact implementation strategy from the planning document
5. Ensure all changes are functional and complete

After implmenting all the changes, write a /output/implementation.md document that summarizes the applied changes and provides a list with the changed files.
END

# Execute implementation based on the plan
if cat /output/prompt.txt | claude --dangerously-skip-permissions -p --debug; then
    exit 0
else
    exit 1
fi
EOF

# Check implementation result
if [ $? -eq 0 ]; then
    write_status "running" "Validation phase" 60
else
    write_status "failed" "Implementation phase failed" 100 "Claude Code implementation failed"
    exit 1
fi

# Cleanup
rm /output/prompt.txt

# Validation phase
su claude << EOF
# Change to workspace directory
cd /workspace

# Create validation prompt
cat >> /output/prompt.txt << END
Validate the implementation in /output/planning.md by:

1. Running any existing tests mentioned in the planning document
2. Verifying that all changes from the plan have been applied
3. Checking for any syntax errors or type issues
4. Ensuring the code follows the project's conventions

Only add or run tests if the project already includes a testing suite.

Write a validation report to /output/validation.md that includes:
- Test results (if applicable)
- Verification of each planned change
- Any issues found and how they were resolved
- Confirmation that the implementation matches the plan
END

# Execute validation
if cat /output/prompt.txt | claude --dangerously-skip-permissions -p --debug; then
    exit 0
else
    exit 1
fi
EOF

# Check validation result
if [ $? -eq 0 ]; then
    write_status "running" "Summary phase" 80
else
    write_status "failed" "Validation phase failed" 100 "Claude Code validation failed"
    exit 1
fi

# Cleanup
rm /output/prompt.txt

# Summary phase
su claude << EOF
# Change to workspace directory
cd /workspace

# Create summary prompt
cat >> /output/prompt.txt << END
Create a comprehensive summary of the completed task and save it to /output/summary.md.

The summary should include:

1. **Executive Summary** (1-2 paragraphs)
   - Brief description of what was accomplished
   - Key outcomes and improvements

2. **Files Modified**
   List each file that was changed with a brief description of the changes:
   - 'path/to/file.ext': Description of changes

3. **Files Added**
   List any new files created:
   - 'path/to/newfile.ext': Purpose of the file

4. **Implementation Details**
   - Key technical decisions made
   - Any deviations from the original plan and why

5. **Testing Results**
   - Summary of tests run and results
   - Any validation performed
END

# Execute summary creation
if cat /output/prompt.txt | claude --dangerously-skip-permissions -p --debug; then
    exit 0
else
    exit 1
fi
EOF

# Cleanup
rm /output/prompt.txt

# Check summary result
if [ $? -eq 0 ]; then
    write_status "running" "Cleanup" 90
else
    write_status "failed" "Summary phase failed" 100 "Claude Code summary generation failed"
    exit 1
fi

RESULT=$?

echo "====================================="
echo "✅ Setting permissions"
echo "====================================="

# This works in a rootless docker installation
chown -R root:root /workspace
chown -R root:root /output

# Check if Claude execution was successful
if [ $RESULT -eq 0 ]; then
    write_status "completed" "Task completed" 100
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
