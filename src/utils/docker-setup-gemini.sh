#!/bin/sh

# Docker container setup script for Rover task execution with Gemini
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
echo "🚀 Rover Task Execution Setup (Gemini)"
echo "====================================="
echo "Task ID: $TASK_ID"
echo "Task Title: $TASK_TITLE"
echo "====================================="

write_status "initializing" "Load metadata" 5

# Install Gemini CLI
echo "📦 Installing Gemini CLI..."
write_status "installing" "Install Gemini CLI" 5

# Install Python for Gemini (assuming Gemini CLI is Python-based)
npm install -g @google/gemini-cli

if [ $? -eq 0 ]; then
    echo "✅ Gemini dependencies installed successfully"
    write_status "installing" "Gemini dependencies installed" 10
else
    echo "❌ Failed to install Gemini dependencies"
    write_status "failed" "Failed to install Gemini dependencies" 100 "pip install failed"
    exit 1
fi

# Create gemini user
echo "👤 Creating gemini user..."
write_status "installing" "Creating gemini user" 10
adduser -D -s /bin/sh gemini

if [ $? -eq 0 ]; then
    echo "✅ User 'gemini' created successfully"
    write_status "installing" "Create user 'gemini'" 15
else
    echo "❌ Failed to create user 'gemini'"
    write_status "failed" "Failed to create user 'gemini'" 100 "adduser command failed"
    exit 1
fi

# Create gemini home directory and set permissions
echo "🏠 Setting up gemini user environment..."
write_status "installing" "Setting up gemini user environment" 15
mkdir -p /home/gemini
chown -R gemini:gemini /home/gemini
chown -R gemini:gemini /workspace
chown -R gemini:gemini /output

# Configure the CLI
# Process and copy Gemini credentials
if [ -d "/.gemini" ]; then
    echo "📝 Processing Gemini credentials..."
    write_status "installing" "Process Gemini credentials" 20
    
    mkdir -p /home/gemini/.gemini
    cp /.gemini/oauth_creds.json /home/gemini/.gemini/
    cp /.gemini/settings.json /home/gemini/.gemini/
    cp /.gemini/user_id /home/gemini/.gemini/
    chown -R gemini:gemini /home/gemini/.gemini
    echo "✅ Gemini credentials processed and copied to gemini user"
else
    echo "❌  No Gemini configuration found at /.gemini"
    write_status "failed" "Missing gemini credentials" 100 "Gemini must be configured first"
    exit 1
fi

echo "====================================="
echo "🔄 Switching to gemini user and starting task execution..."
echo "====================================="
write_status "running" "Plan phase" 20

# Switch to gemini user and execute task
# Export variables so they're available in the su session
export TASK_ID TASK_TITLE TASK_DESCRIPTION

success=0

# Planning step
su gemini << EOF
# Change to workspace directory
cd /workspace

cat >> /output/prompt.txt << END
You are an expert software architect tasked with creating a detailed implementation plan for changes to a codebase. Your output will be a planning document that serves as a comprehensive guide for implementing the requested changes.

## User request

The user provided this description you must create the plan for:

=================
Title: $TASK_TITLE

$TASK_DESCRIPTION
=================

## Planning

Analyze the requested change and create an implementation plan.

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

Your planning document should be:
- Written in clear, actionable language
- Concise language
- Include code snippets where helpful
- Use markdown formatting for readability
- Include mermaid diagrams for complex flows when required

Remember: The goal is to create a concise plan that another developer could implement the changes without additional context. Be specific, thorough, and anticipate edge cases.

This plan MUST be saved to the planning.md. You are in charge of creating that file.
END

if cat /output/prompt.txt | gemini --yolo -p --debug; then
    exit 0
else
    exit 1
fi
EOF

# Check planning result
if [ $? -eq 0 ]; then
    write_status "running" "Implementation phase" 40
else
    write_status "failed" "Planning phase failed" 100 "Gemini planning failed"
    exit 1
fi

# Cleanup
rm /output/prompt.txt

# Implementation phase
su gemini << EOF
# Change to workspace directory
cd /workspace

# Create implementation prompt
cat >> /output/prompt.txt << END
Based on the planning document, implement all the changes described in the plan.

Planning document content: planning.md.

Follow these guidelines:
1. Execute each phase as outlined in the plan
2. Make all necessary file modifications
3. Create any new files required
4. Follow the exact implementation strategy from the planning document
5. Ensure all changes are functional and complete
END

# Execute implementation based on the plan
if cat /output/prompt.txt | gemini --yolo -p --debug; then
    exit 0
else
    exit 1
fi
EOF

# Check implementation result
if [ $? -eq 0 ]; then
    write_status "running" "Validation phase" 60
else
    write_status "failed" "Implementation phase failed" 100 "Gemini implementation failed"
    exit 1
fi

# Cleanup
rm /output/prompt.txt

# Validation phase
su gemini << EOF
# Change to workspace directory
cd /workspace

# Create validation prompt
cat >> /output/prompt.txt << END
Validate the implementation in planning.md by:

1. Running any existing tests mentioned in the planning document
2. Verifying that all changes from the plan have been applied
3. Checking for any syntax errors or type issues
4. Ensuring the code follows the project's conventions

Only add or run tests if the project already includes a testing suite.

Write a validation report to validation.md that includes:
- Test results (if applicable)
- Verification of each planned change
- Any issues found and how they were resolved
- Confirmation that the implementation matches the plan

A validation summary MUST be saved to the validation.md file. You are in charge of creating that file.

If you cannot complete the task, make sure you write the validation.md file explaining what you require to complete it.
END

# Execute validation
if cat /output/prompt.txt | gemini --yolo -p --debug; then
    exit 0
else
    exit 1
fi
EOF

# Check validation result
if [ $? -eq 0 ]; then
    write_status "running" "Summary phase" 80
else
    write_status "failed" "Validation phase failed" 100 "Gemini validation failed"
    exit 1
fi

# Cleanup
rm /output/prompt.txt

# Summary phase
su gemini << EOF
# Change to workspace directory
cd /workspace

# Create summary prompt
cat >> /output/prompt.txt << END
Create a comprehensive summary of the completed task and save it to summary.md.

You must read the content from the validation.md and planning.md files.

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

A global summary MUST be saved to the summary.md file. You are in charge of creating that file.

If you cannot complete the task, make sure you write the summary.md file explaining what you require to complete it.
END

# Execute summary creation
if cat /output/prompt.txt | gemini --yolo -p --debug; then
    exit 0
else
    exit 1
fi
EOF

# Cleanup
rm /output/prompt.txt

# Copy files
mv ./summary.md ./planning.md ./validation.md /output

# Check summary result
if [ $? -eq 0 ]; then
    write_status "running" "Cleanup" 90
else
    write_status "failed" "Summary phase failed" 100 "Gemini summary generation failed"
    exit 1
fi

RESULT=$?

echo "====================================="
echo "✅ Setting permissions"
echo "====================================="

# This works in a rootless docker installation
chown -R root:root /workspace
chown -R root:root /output

# Check if Gemini execution was successful
if [ $RESULT -eq 0 ]; then
    write_status "completed" "Task completed" 100
    echo "====================================="
    echo "✅ Task execution completed"
    echo "====================================="
else
    write_status "failed" "Task execution failed during Gemini execution" 100 "Gemini execution returned non-zero exit code"
    echo "====================================="
    echo "❌ Task execution failed"
    echo "====================================="
    exit 1
fi