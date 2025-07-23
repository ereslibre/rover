// Simple test to verify the prerequisite checks work
import { execa } from 'execa';

// Test Git check
async function testGitCheck() {
    try {
        const { stdout } = await execa('git', ['--version']);
        console.log('✓ Git check passed:', stdout.trim());
        return true;
    } catch (error) {
        console.log('✗ Git check failed:', error.message);
        return false;
    }
}

// Test Docker check
async function testDockerCheck() {
    try {
        const { stdout } = await execa('docker', ['--version']);
        console.log('✓ Docker check passed:', stdout.trim());
        return true;
    } catch (error) {
        console.log('✗ Docker check failed:', error.message);
        return false;
    }
}

// Run tests
console.log('Testing prerequisite checks...\n');
await testGitCheck();
await testDockerCheck();