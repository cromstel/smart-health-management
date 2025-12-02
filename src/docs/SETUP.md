# Development Setup Instructions

This guide will walk you through the process of setting up the development environment for the health management project.

## Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [npm](https://www.npmjs.com/)
- [Git](https://git-scm.com/)
- A running instance of [PostgreSQL](https://www.postgresql.org/)

## Frontend Setup

1.  **Clone the repository**:
    ```bash
    git clone https://github.com/cromstelit/health-management.git
    cd health-management
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Configure environment variables**:
    Create a `.env` file in the root directory and add the necessary environment variables, such as the API endpoint.

4.  **Run the development server**:
    ```bash
    npm run dev
    ```

## Backend Setup

1.  **Navigate to the server directory**:
    ```bash
    cd server
    ```

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Configure environment variables**:
    Create a `.env` file in the `server` directory and configure the database connection and other settings.

4.  **Run database migrations**:
    ```bash
    npm run db:migrate
    ```

5.  **Run the server**:
    ```bash
    npm run start