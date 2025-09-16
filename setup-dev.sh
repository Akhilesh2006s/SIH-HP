#!/bin/bash

# Smart Travel Diary - Development Setup Script
# This script sets up the development environment for both frontend and backend

set -e

echo "🚀 Setting up Smart Travel Diary Development Environment"
echo "=================================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ and try again."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm and try again."
    exit 1
fi

echo "✅ npm $(npm -v) detected"

# Install Expo CLI globally if not already installed
if ! command -v expo &> /dev/null; then
    echo "📦 Installing Expo CLI globally..."
    npm install -g @expo/cli
    echo "✅ Expo CLI installed"
else
    echo "✅ Expo CLI already installed"
fi

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
npm install
echo "✅ Frontend dependencies installed"

# Set up backend
echo "📦 Setting up backend..."
cd backend

# Install backend dependencies
echo "📦 Installing backend dependencies..."
npm install

# Create .env file from example
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp env.example .env
    echo "✅ .env file created. Please edit it with your configuration."
else
    echo "✅ .env file already exists"
fi

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p data logs uploads/exports
echo "✅ Directories created"

# Run database migrations
echo "🗄️ Running database migrations..."
npm run migrate
echo "✅ Database migrations completed"

# Run database seeds (development data)
echo "🌱 Seeding development data..."
npm run seed
echo "✅ Development data seeded"

cd ..

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "📱 To start the mobile app:"
echo "   npm start"
echo ""
echo "🖥️ To start the backend API:"
echo "   cd backend && npm run dev"
echo ""
echo "📧 Test user credentials:"
echo "   Email: test@example.com"
echo "   Password: testpassword123"
echo ""
echo "🔗 Backend API will be available at: http://localhost:3000"
echo "📊 Health check: http://localhost:3000/health"
echo ""
echo "📱 Install Expo Go on your mobile device and scan the QR code to test the app!"
echo ""
echo "Happy coding! 🚀"
