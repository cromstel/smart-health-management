# Deployment Guide (localhost)

This guide provides instructions for deploying the Smart Health Manager application in different environments.

## Prerequisites

- [Node.js](https://nodejs.org/) (v24 or later)
- [npm](https://www.npmjs.com/)
- [Git](https://git-scm.com/)
- A running instance of [PostgreSQL](https://www.postgresql.org/)
- [Apache Web Server](https://httpd.apache.org/) (for local deployment)

## Building for Production

Before deploying, you need to create a production-ready build of both the frontend and backend.

### Frontend

1.  Navigate to the root project directory.
2.  Run the build command:
    ```bash
    npm run build
    ```
3.  This will create a `dist` folder in the root directory containing the optimized static assets.

### Backend

1.  Navigate to the `server` directory.
2.  Run the build command:
    ```bash
    npm run build
    ```
3.  This will compile the TypeScript code into JavaScript in a `dist` folder inside the `server` directory.

## Local Deployment with Apache

This setup is ideal for a local network or testing environment.

1.  **Configure Apache as a Reverse Proxy**: You need to configure Apache to serve the frontend files and forward API requests to the backend Node.js server.
2.  **Start the Backend Server**:
    ```bash
    cd server
    npm start
    ```
    By default, the server runs on port 5600.
3.  **Configure Apache Virtual Host**:
    Create a new virtual host configuration file in your Apache configuration directory (e.g., `/etc/apache2/sites-available/smart-health.conf`):

    ```apache
    <VirtualHost *:80>
        ServerName your-local-domain.com
        DocumentRoot /path/to/your/project/dist

        <Directory /path/to/your/project/dist>
            AllowOverride All
            Require all granted
        </Directory>

        ProxyPass /api http://localhost:5600/api
        ProxyPassReverse /api http://localhost:5600/api
    </VirtualHost>
    ```

4.  **Enable the necessary Apache modules** (`proxy`, `proxy_http`) and the new site, then restart Apache.

## Cloud Deployment (General Guide)

This guide provides a general overview of deploying to a cloud platform like AWS, Heroku, or DigitalOcean.

1.  **Provision a Server**: Set up a virtual server (e.g., an AWS EC2 instance) with Node.js and PostgreSQL installed.
2.  **Deploy the Backend**:
    - Clone the repository to your server.
    - Install dependencies and build the backend code.
    - Configure environment variables for production (database credentials, JWT secret, etc.).
    - Use a process manager like [PM2](https://pm2.keymetrics.io/) to run the Node.js server continuously.
3.  **Deploy the Frontend**:
    - Build the frontend application.
    - Serve the static files from the `dist` directory using a web server like Nginx or a static hosting service like AWS S3.
4.  **Configure a Reverse Proxy (Nginx)**:
    Set up Nginx to serve the frontend and proxy API requests to the backend, similar to the Apache setup.
5.  **Set up a Domain and SSL**:
    - Point your domain to the server's IP address.
    - Install an SSL certificate (e.g., using Let's Encrypt) to enable HTTPS.
