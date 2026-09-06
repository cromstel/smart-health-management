# Troubleshooting Guide

This guide provides solutions to common problems you might encounter during development or deployment.

## Frontend Issues

### `npm install` fails

- **Symptom**: The command `npm install` fails with errors related to package resolution.
- **Solution**:
    1. Delete the `node_modules` directory and the `package-lock.json` file.
    2. Run `npm cache clean --force`.
    3. Try running `npm install` again.

### Application does not start

- **Symptom**: `npm run dev` completes without errors, but the application is not accessible in the browser.
- **Solution**:
    1. Check the browser's developer console for any errors.
    2. Ensure that the backend server is running and accessible.
    3. Verify that the API endpoint in your `.env` file is correct.

## Backend Issues

### Database connection error

- **Symptom**: The server fails to start with an error message indicating a database connection problem.
- **Solution**:
    1. Verify that your PostgreSQL server is running.
    2. Check the database credentials in the `server/.env` file.
    3. Ensure that the database specified in the configuration exists.

### Migrations fail to run

- **Symptom**: The `npm run db:migrate` command fails.
- **Solution**:
    1. Check the error message for details about which migration failed.
    2. Ensure your database user has the necessary permissions to alter the database schema.