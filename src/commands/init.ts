import { existsSync } from 'node:fs';
import { join } from 'node:path';
import colors from 'ansi-colors';
import yoctoSpinner from 'yocto-spinner';
import { detectEnvironment } from '../utils/detect-environment.js';
import { detectAIAgents } from '../utils/detect-ai-agents.js';
import { ClaudeAI } from '../utils/ai-claude.js';
import { saveRoverConfig } from '../utils/save-config.js';
import type { Environment, ProjectType, AIAgent } from '../types.js';
import { GeminiAI } from '../utils/gemini.js';

// Helper function to get color for project type
const getProjectTypeColor = (type: ProjectType): string => {
    switch (type) {
        case 'javascript':
            return colors.yellow(type); // JavaScript yellow
        case 'typescript':
            return colors.blue(type); // TypeScript blue
        case 'php':
            return colors.magenta(type); // PHP purple/magenta
        default:
            return colors.gray(type);
    }
};

// Helper to add delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Init the project
 */
export const init = async (path: string = '.') => {
    const roverPath = join(path, '.rover');
    
    if (existsSync(roverPath)) {
        console.log(colors.cyan('✓ Rover is already initialized in this directory'));
        return;
    }
    
    // Detect environment
    const spinner = yoctoSpinner({ text: 'Detecting project environment...' }).start();
    
    try {
        const environment: Environment = await detectEnvironment(path);
        
        // Add a small delay so users can see the spinner
        await delay(800);
        
        spinner.success('Environment detected!');
        
        // Display detected information
        console.log('\n' + colors.bold('Project Details:'));
        console.log(`  ${colors.gray('Type:')} ${getProjectTypeColor(environment.projectType)}`);
        console.log(`  ${colors.gray('Package Manager:')} ${colors.cyan(environment.packageManager)}`);
        console.log(`  ${colors.gray('Dev Environments:')} ${colors.white(environment.devEnvironments.join(', '))}`);
        console.log(`  ${colors.gray('Task Managers:')} ${colors.white(environment.taskManagers.join(', '))}`);
        
        // Detect AI agents
        console.log('');
        const aiSpinner = yoctoSpinner({ text: 'Checking for AI agents...' }).start();
        
        try {
            const aiAgents = await detectAIAgents();
            
            // Add delay for spinner visibility
            await delay(600);
            
            aiSpinner.success('AI agents checked!');
            
            // Display AI agent information
            console.log('\n' + colors.bold('AI Agents:'));
            if (aiAgents.length === 0) {
                console.log(`  ${colors.gray('No AI agents detected')}`);
            } else {
                aiAgents.forEach(agent => {
                    const status = agent.installed 
                        ? (agent.initialized ? colors.green('✓ Ready') : colors.yellow('⚠ Not initialized'))
                        : colors.red('✗ Not installed');
                    const agentColor = agent.name === 'Claude' ? colors.blue(agent.name) : colors.cyan(agent.name);
                    console.log(`  ${agentColor}: ${status}${agent.version ? colors.gray(` (${agent.version})`) : ''}`);
                });
            }
            
            // Store agents in environment
            environment.aiAgents = aiAgents;
            
            // Check if Claude is available for project analysis
            const claudeAgent = aiAgents.find(agent => agent.name === 'Claude');
            if (claudeAgent?.installed && claudeAgent?.initialized) {
                console.log('');
                const analysisSpinner = yoctoSpinner({ text: 'Analyzing project with Claude AI...' }).start();
                
                try {
                    await delay(500); // Small delay for UX
                    
                    const instructions = await GeminiAI.analyzeProject(path, environment);
                    
                    if (instructions) {
                        analysisSpinner.success('Project analyzed!');
                        
                        console.log('\n' + colors.bold('Run Instructions:'));
                        console.log(`  ${colors.gray('Dev command:')} ${colors.green(instructions.runDev)}`);
                        console.log(`  ${colors.gray('Interaction:')} ${colors.white(instructions.interaction)}`);
                        
                        environment.instructions = instructions;
                    } else {
                        analysisSpinner.stop();
                        console.log(colors.yellow('⚠ Could not analyze project automatically'));
                    }
                } catch (error) {
                    analysisSpinner.error('Failed to analyze project');
                    console.error(colors.red('Error:'), error);
                }
            } else if (aiAgents.length > 0) {
                console.log('\n' + colors.yellow('ℹ Claude AI not available for automatic project analysis'));
            }
            
        } catch (error) {
            aiSpinner.error('Failed to check AI agents');
            console.error(colors.red('Error:'), error);
        }
        
        // Save configuration to .rover directory
        console.log('');
        const saveSpinner = yoctoSpinner({ text: 'Saving configuration...' }).start();
        
        try {
            saveRoverConfig(path, environment);
            await delay(300); // Small delay for UX
            saveSpinner.success('Configuration saved to .rover/project.json');
            
            console.log('\n' + colors.green('✓ Rover initialization complete!'));
            console.log(colors.gray('  Run ') + colors.cyan('rover help') + colors.gray(' to see available commands'));
        } catch (error) {
            saveSpinner.error('Failed to save configuration');
            console.error(colors.red('Error:'), error);
            process.exit(1);
        }
        
    } catch (error) {
        spinner.error('Failed to detect environment');
        console.error(colors.red('Error:'), error);
        process.exit(1);
    }
};

export default init;