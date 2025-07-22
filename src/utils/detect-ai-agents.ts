import { execa } from 'execa';
import type { AIAgent } from '../types.js';

async function checkClaude(): Promise<AIAgent> {
    const agent: AIAgent = {
        name: 'Claude',
        installed: false,
        initialized: false
    };

    try {
        // Check if Claude CLI is installed
        const { stdout: version } = await execa('claude', ['--version']);
        agent.installed = true;
        agent.initialized = true;
        agent.version = version.trim();
    } catch {
        // Claude CLI not found
        agent.installed = false;
    }

    return agent;
}

async function checkGemini(): Promise<AIAgent> {
    const agent: AIAgent = {
        name: 'Gemini',
        installed: false,
        initialized: false
    };

    try {
        // Check if Gemini CLI is installed
        const { stdout: version } = await execa('gemini', ['--version']);
        agent.installed = true;
        agent.initialized = true;
        agent.version = version.trim();
    } catch {
        // Gemini CLI not found
        agent.installed = false;
    }

    return agent;
}

export async function detectAIAgents(): Promise<AIAgent[]> {
    const agents = await Promise.all([
        checkClaude(),
        checkGemini()
    ]);

    return agents;
}