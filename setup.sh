#!/bin/bash

echo "🏥 Smart Health Manager - Setup Script"
echo "======================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

echo "✅ Node.js version: $(node --version)"

# Check if MySQL is installed
if ! command -v mysql &> /dev/null; then
    echo "⚠️  MySQL is not installed. Please install MySQL 8.0+ before proceeding."
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Install frontend dependencies
echo ""
echo "📦 Installing frontend dependencies..."
npm install

# Install backend dependencies
echo ""
echo "📦 Installing backend dependencies..."
cd server
npm install
cd ..

# Create environment files
echo ""
echo "📝 Creating environment files..."

if [ ! -f .env ]; then
    cp .env.example .env
    echo "✅ Created frontend .env file"
else
    echo "ℹ️  Frontend .env already exists"
fi

if [ ! -f server/.env ]; then
    cp server/.env.example server/.env
    echo "✅ Created backend .env file"
    echo "⚠️  Please update server/.env with your database credentials"
else
    echo "ℹ️  Backend .env already exists"
fi

# Database setup
echo ""
read -p "Do you want to set up the database now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    read -p "Enter MySQL username (default: root): " db_user
    db_user=${db_user:-root}
    
    read -sp "Enter MySQL password: " db_password
    echo
    
    echo "Creating database..."
    mysql -u "$db_user" -p"$db_password" < server/src/database/schema.sql
    
    if [ $? -eq 0 ]; then
        echo "✅ Database created successfully"
    else
        echo "❌ Database creation failed"
    fi
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update server/.env with your configuration"
echo "2. Run 'npm run dev' to start the frontend"
echo "3. Run 'cd server && npm run dev' to start the backend"
echo ""
echo "Happy coding! 🚀"