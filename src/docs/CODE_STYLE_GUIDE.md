# Code Style Guide

This document outlines the coding standards and conventions to be followed when contributing to the health management project. Consistency in code style is crucial for maintaining readability and ease of collaboration.

## General Principles

- **Clarity over brevity**: Write code that is easy to understand, even if it is more verbose.
- **Consistency**: Adhere to the established style throughout the codebase.
- **Simplicity**: Prefer simple, straightforward solutions over complex ones.

## Frontend (TypeScript/React)

We use [ESLint](https://eslint.org/) and [Prettier](https://prettier.io/) to enforce a consistent code style. The configuration for these tools can be found in the root of the project.

- **Component Naming**: Use PascalCase for React components (e.g., `PatientDashboard`).
- **File Naming**: Use kebab-case for component files (e.g., `patient-dashboard.tsx`).
- **Styling**: We use Tailwind CSS for styling. Utility classes should be grouped logically.

## Backend (Node.js/TypeScript)

- **File Naming**: Use kebab-case for all backend files (e.g., `appointment.controller.ts`).
- **Variable Naming**: Use camelCase for variables and functions (e.g., `getPatientDetails`).
- **Error Handling**: Use async/await with try/catch blocks for handling asynchronous operations.

## Database

- **Table Naming**: Use plural, snake_case for table names (e.g., `medical_records`).
- **Column Naming**: Use snake_case for column names (e.g., `patient_id`).