# Gemini Desk

A sleek, intuitive web-based user interface for the [Gemini CLI tool](https://github.com/google-gemini/gemini-cli). Gemini Desk provides a modern chat interface, project management, and persistent session storage for seamless AI-powered development workflows.

## Features

- **Chat-centric Interface**: Natural conversation with Gemini AI through a clean, modern UI
- **Project Management**: Open and manage multiple project directories with context switching
- **Persistent Sessions**: SQLite-backed chat history with session management
- **Code Block Rendering**: Syntax-highlighted code blocks with copy functionality
- **Real-time CLI Integration**: Direct integration with Gemini CLI for authentic responses
- **Session Import**: Import existing CLI sessions from `~/.gemini/tmp/` directory
- **Responsive Design**: Works seamlessly across desktop and mobile devices

## Project Structure

```
gemini-cli-ui/
├── frontend/          # React + TypeScript frontend with Vite
├── backend/           # Node.js + Express backend with SQLite
├── package.json      # Root package.json with workspaces
└── README.md
```

## Prerequisites

- **Node.js** >= 18.0.0
- **npm** >= 9.0.0  
- **Gemini CLI** tool installed and configured ([Installation Guide](https://github.com/google-gemini/gemini-cli))

## Quick Start

1. **Clone and install dependencies:**
```bash
git clone <repository-url>
cd gemini-cli-ui
npm install
```

2. **Set up environment:**
```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your configuration if needed
```

3. **Start development servers:**
```bash
npm run dev
```

The application will be available at:
- **Frontend**: http://localhost:3000 (Vite dev server)
- **Backend**: http://localhost:3001 (Express API server)

## Available Scripts

### Root Level Commands
- `npm run dev` - Start both frontend and backend in development mode
- `npm run build` - Build both frontend and backend for production
- `npm run test` - Run tests for both frontend and backend
- `npm run lint` - Run ESLint for both frontend and backend
- `npm run format` - Format code with Prettier

### Backend Commands
```bash
cd backend
npm run dev        # Start with tsx watch mode
npm run build      # Compile TypeScript to dist/
npm run start      # Run compiled JavaScript
npm run test       # Run Jest tests
npm run lint       # Run ESLint
npm run format     # Format with Prettier
```

### Frontend Commands
```bash
cd frontend
npm run dev        # Start Vite dev server
npm run build      # Build for production
npm run preview    # Preview production build
npm run test       # Run Jest tests
npm run lint       # Run ESLint
npm run format     # Format with Prettier
```

## Architecture

### Frontend Stack
- **React 18** with TypeScript for component-based UI
- **Vite** for fast development and optimized builds
- **Tailwind CSS** for utility-first styling
- **Zustand** for lightweight state management
- **React Query** for server state synchronization
- **Lucide React** for consistent iconography

### Backend Stack
- **Node.js** with Express for REST API server
- **TypeScript** for type-safe server development
- **SQLite3** for persistent data storage
- **WebSocket (ws)** for real-time communication
- **Child Process** for Gemini CLI integration
- **Helmet** for security middleware
- **CORS** for cross-origin resource sharing

### Database Schema
- **Users**: User account management
- **Chat Sessions**: Persistent conversation storage
- **Messages**: Individual chat messages with metadata
- **Code Blocks**: Extracted code snippets with syntax info

### Development Tools
- **ESLint** + **Prettier** for code quality
- **Jest** for unit and integration testing
- **Concurrently** for running multiple dev servers
- **tsx** for TypeScript execution in development

## Key Features

### 🗨️ Chat Interface
- Clean, modern chat UI similar to Claude/ChatGPT
- Real-time message streaming from Gemini CLI
- Syntax-highlighted code blocks with copy functionality
- Message history with timestamps
- Loading states and error handling

### 📁 Project Management
- Open and switch between project directories
- Persistent project settings and recent projects
- Working directory context for CLI operations
- Project-scoped chat sessions

### 💾 Session Persistence
- SQLite database for reliable data storage
- Automatic session saving and restoration
- Session import from existing CLI sessions
- Message history with full metadata

### 🔧 CLI Integration
- Direct integration with Gemini CLI tool
- Command execution with proper error handling
- Working directory management
- Process timeout and output size limits

## API Endpoints

### Projects
- `GET /api/projects` - List all projects
- `GET /api/projects/recent` - Get recent projects
- `GET /api/projects/current` - Get current project
- `POST /api/projects/current` - Set current project
- `POST /api/projects` - Create new project
- `POST /api/projects/open` - Open existing directory
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project

### Sessions
- `GET /api/sessions` - List chat sessions
- `GET /api/sessions/:id` - Get specific session
- `POST /api/sessions` - Create new session
- `PUT /api/sessions/:id` - Update session
- `DELETE /api/sessions/:id` - Delete session
- `POST /api/sessions/:id/messages` - Add message to session

### CLI Integration
- `POST /api/cli/execute` - Execute Gemini CLI command
- `POST /api/cli/sessions/:id/message` - Send message to session
## Conf
iguration

### Environment Variables

Create a `.env` file in the `backend/` directory:

```bash
# Server Configuration
PORT=3001
NODE_ENV=development

# Database Configuration
DATABASE_PATH=./data/gemini-desk.db

# CLI Configuration
GEMINI_CLI_PATH=gemini
CLI_TIMEOUT=300000
MAX_OUTPUT_SIZE=10485760

# Security
CORS_ORIGIN=http://localhost:3000
```

## Production Deployment

### Build for Production

```bash
# Build both frontend and backend
npm run build

# Or build individually
cd frontend && npm run build
cd backend && npm run build
```

### Production Environment

1. **Set environment variables:**
```bash
NODE_ENV=production
PORT=3001
DATABASE_PATH=/path/to/production/database.db
CORS_ORIGIN=https://your-domain.com
```

2. **Start the production server:**
```bash
cd backend
npm start
```

3. **Serve frontend static files** using a web server like Nginx or serve them from Express.

## Development

### Project Structure Details

```
gemini-cli-ui/
├── frontend/
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── stores/         # Zustand state stores
│   │   ├── services/       # API client and utilities
│   │   ├── types/          # TypeScript type definitions
│   │   └── hooks/          # Custom React hooks
│   ├── dist/              # Built frontend assets
│   └── package.json
├── backend/
    ├── src/
    │   ├── routes/         # Express route handlers
    │   ├── services/       # Business logic services
    │   ├── database/       # Database schema and DAL
    │   ├── middleware/     # Express middleware
    │   ├── types/          # TypeScript interfaces
    │   └── scripts/        # Database initialization
    ├── data/              # SQLite database files
    ├── dist/              # Compiled TypeScript
    └── package.json
```

### Adding New Features

1. **Backend API**: Add routes in `backend/src/routes/`
2. **Frontend Components**: Add components in `frontend/src/components/`
3. **State Management**: Update stores in `frontend/src/stores/`
4. **Database Changes**: Update schema in `backend/src/database/schema.sql`

## Troubleshooting

### Common Issues

**Gemini CLI not found:**
```bash
# Ensure Gemini CLI is installed and in PATH
which gemini
# or
gemini --version
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript strict mode
- Use ESLint and Prettier for code formatting
- Write tests for new features
- Update documentation for API changes
- Follow conventional commit messages

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Gemini CLI](https://github.com/google-gemini/gemini-cli) - The underlying CLI tool
- [React](https://reactjs.org/) - Frontend framework
- [Express](https://expressjs.com/) - Backend framework
- [SQLite](https://www.sqlite.org/) - Database engine
- [Tailwind CSS](https://tailwindcss.com/) - CSS framework