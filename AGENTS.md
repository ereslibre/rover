# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Rover is a TypeScript-based CLI tool that aims to help developers and AI agents spin up services instantly. It uses Commander.js for CLI parsing and Ink (React for CLI) for terminal UI components. Rover supports multiple AI agents including Claude and Gemini for task automation.

## Essential Development Commands

```bash
# Development workflow
pnpm run dev    # Start development mode with watch and hot reload
pnpm build      # Type-check and build for production
pnpm check      # Run TypeScript type checking only
pnpm start      # Run the built CLI

# Clean build artifacts
pnpm clean      # Remove dist directory
```

## Architecture

The codebase follows a command-based architecture:

- **Entry point**: `src/index.ts` - Sets up the CLI using Commander.js
- **Commands**: `src/commands/` - Each command is implemented as a separate module
- **Build output**: `dist/index.mjs` - Single bundled ES module file
- **AI Providers**: `src/utils/` - AI provider implementations (Claude, Gemini) with a common interface

Key architectural decisions:
- Uses tsup for bundling, which packages all dependencies into a single file
- Ink framework enables React-style component development for CLI interfaces
- Zod is available for runtime validation of inputs and configurations
- AI providers implement a common interface for easy switching between Claude and Gemini

## Technical Details

- **TypeScript**: Strict mode enabled, targeting ES2022
- **Module system**: ES modules with Node.js compatibility shims
- **Node version**: Targets Node.js 20+
- **JSX**: Configured for React (Ink) components

When adding new commands:
1. Create a new file in `src/commands/`
2. Export a function that returns a Commander command
3. Import and add the command in `src/index.ts`
4. Use Ink components for any interactive UI elements