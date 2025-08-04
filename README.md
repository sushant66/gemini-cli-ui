# Gemini Desk

A sleek, intuitive web-based user interface for the Gemini CLI tool.

## Project Structure

```
gemini-desk/
├── frontend/          # React + TypeScript frontend
├── backend/           # Node.js + Express backend
├── package.json       # Root package.json with workspaces
└── README.md
```

## Development Setup

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- Gemini CLI tool installed and configured

### Installation

1. Install dependencies for all workspaces:
```bash
npm install
```

2. Copy environment configuration:
```bash
cp backend/.env.example backend/.env
```

3. Start development servers:
```bash
npm run dev
```

This will start both the frontend (http://localhost:3000) and backend (http://localhost:3001) servers concurrently.

### Available Scripts

- `npm run dev` - Start both frontend and backend in development mode
- `npm run build` - Build both frontend and backend for production
- `npm run test` - Run tests for both frontend and backend
- `npm run lint` - Run ESLint for both frontend and backend
- `npm run format` - Format code with Prettier

### Individual Workspace Commands

Frontend:
```bash
cd frontend
npm run dev     # Start Vite dev server
npm run build   # Build for production
npm run test    # Run Jest tests
```

Backend:
```bash
cd backend
npm run dev     # Start with tsx watch
npm run build   # Compile TypeScript
npm run test    # Run Jest tests
```

## Technology Stack

### Frontend
- React 18 with TypeScript
- Vite for development and building
- Tailwind CSS for styling
- Zustand for state management
- React Query for server state
- Monaco Editor for code editing
- Xterm.js for terminal emulation

### Backend
- Node.js with Express
- TypeScript
- WebSocket support with ws
- File system operations
- CLI process execution

### Development Tools
- ESLint for code linting
- Prettier for code formatting
- Jest for testing
- TypeScript for type safety