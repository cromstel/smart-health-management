# Contributing to Smart Health Manager System

Thank you for your interest in contributing to Smart Health Manager! This document provides guidelines and instructions for contributing.
Cromstel IT Group welcomes contributions from the community and values the time and effort you invest to improve the project.

To maintain a consistent and professional development process, please follow the guidelines below.


## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)

## Code of Conduct

This project adheres to a code of conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## Getting Started

Before contributing, please ensure you:
   - Review the documentation.
   - Search existing issues to avoid duplicates.
   - Use clear and descriptive communication.
   - 
1. **Fork the repository**
   ```bash
   git clone https://github.com/cromstelit/health-management.git
   cd smart-health-management
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd server && npm install
   ```

3. **Set up environment**
   ```bash
   cp .env.example .env
   cp server/.env.example server/.env
   # Update .env files with your configuration
   ```

4. **Set up database**
   ```bash
   mysql -u root -p < server/src/database/schema.sql
   mysql -u root -p < server/src/database/seed.sql
   ```

5. **Start development servers**
   ```bash
   # Terminal 1 - Frontend
   npm run dev
   
   # Terminal 2 - Backend
   cd server && npm run dev
   ```

## Development Workflow

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Write clean, readable code
   - Follow the coding standards
   - Add tests for new features
   - Update documentation as needed

3. **Test your changes**
   ```bash
   npm run type-check
   npm test
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add new feature"
   ```

5. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Create a Pull Request**

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Enable strict mode
- Avoid `any` types when possible
- Use interfaces for object shapes
- Use type aliases for unions and complex types

### React

- Use functional components with hooks
- Keep components small and focused
- Use proper prop types
- Avoid inline styles (use Tailwind classes)
- Extract reusable logic into custom hooks

### File Organization

```
src/
├── components/
│   ├── layout/      # Layout components
│   ├── ui/          # Reusable UI components
│   └── features/    # Feature-specific components
├── pages/           # Page components
├── contexts/        # React contexts
├── hooks/           # Custom hooks
├── services/        # API services
├── types/           # TypeScript types
└── utils/           # Utility functions
```

### Naming Conventions

- **Components**: PascalCase (e.g., `PatientCard.tsx`)
- **Hooks**: camelCase with 'use' prefix (e.g., `useAuth.ts`)
- **Utilities**: camelCase (e.g., `formatDate.ts`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `API_BASE_URL`)
- **Types/Interfaces**: PascalCase (e.g., `Patient`, `UserRole`)

### Code Style

- Use 2 spaces for indentation
- Use single quotes for strings
- Add trailing commas in objects and arrays
- Use semicolons
- Max line length: 100 characters
- Use meaningful variable names

## Commit Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples

```bash
feat(auth): add two-factor authentication
fix(patients): resolve search filter bug
docs(readme): update installation instructions
refactor(api): simplify error handling
```

## Pull Request Process

1. **Update documentation**
   - Update README if needed
   - Update implementation checklist
   - Add JSDoc comments for new functions

2. **Ensure tests pass**
   ```bash
   npm run type-check
   npm test
   ```

3. **Update the checklist**
   - Mark completed items in `src/docs/IMPLEMENTATION_CHECKLIST.md`

4. **Create the PR**
   - Use a clear, descriptive title
   - Reference any related issues
   - Provide a detailed description
   - Add screenshots for UI changes

5. **Code review**
   - Address review comments
   - Keep the PR focused and small
   - Rebase if needed

## Testing

### Frontend Tests

```bash
npm test
```

### Backend Tests

```bash
cd server
npm test
```

### Type Checking

```bash
npm run type-check
cd server && npm run type-check
```

## Project Structure

### Frontend

- **src/components/**: Reusable React components
- **src/pages/**: Page-level components
- **src/contexts/**: React context providers
- **src/services/**: API service layer
- **src/hooks/**: Custom React hooks

### Backend

- **server/src/controllers/**: Request handlers
- **server/src/routes/**: API route definitions
- **server/src/middleware/**: Express middleware
- **server/src/config/**: Configuration files
- **server/src/database/**: Database schema and migrations

## Questions?

If you have questions, please:
1. Check the [Implementation Checklist](src/docs/IMPLEMENTATION_CHECKLIST.md)
2. Review existing issues
3. Create a new issue with the `question` label

## Communication

For general inquiries or professional contact, please use:
https://cromstelit.com/contact-us/

We appreciate your contributions and helping improve the project.

Thank you for contributing! 🎉
