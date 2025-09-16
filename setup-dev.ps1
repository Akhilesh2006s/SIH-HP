# Smart Travel Diary - Development Setup Script (PowerShell)
# This script sets up the development environment for both frontend and backend

Write-Host "🚀 Setting up Smart Travel Diary Development Environment" -ForegroundColor Green
Write-Host "==================================================" -ForegroundColor Green

# Check if Node.js is installed
try {
    $nodeVersion = node -v
    Write-Host "✅ Node.js $nodeVersion detected" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js is not installed. Please install Node.js 18+ and try again." -ForegroundColor Red
    exit 1
}

# Check if npm is installed
try {
    $npmVersion = npm -v
    Write-Host "✅ npm $npmVersion detected" -ForegroundColor Green
} catch {
    Write-Host "❌ npm is not installed. Please install npm and try again." -ForegroundColor Red
    exit 1
}

# Install Expo CLI globally if not already installed
try {
    $expoVersion = expo --version
    Write-Host "✅ Expo CLI already installed" -ForegroundColor Green
} catch {
    Write-Host "📦 Installing Expo CLI globally..." -ForegroundColor Yellow
    npm install -g @expo/cli
    Write-Host "✅ Expo CLI installed" -ForegroundColor Green
}

# Install frontend dependencies
Write-Host "📦 Installing frontend dependencies..." -ForegroundColor Yellow
npm install
Write-Host "✅ Frontend dependencies installed" -ForegroundColor Green

# Set up backend
Write-Host "📦 Setting up backend..." -ForegroundColor Yellow
Set-Location backend

# Install backend dependencies
Write-Host "📦 Installing backend dependencies..." -ForegroundColor Yellow
npm install

# Create .env file from example
if (-not (Test-Path ".env")) {
    Write-Host "📝 Creating .env file from template..." -ForegroundColor Yellow
    Copy-Item "env.example" ".env"
    Write-Host "✅ .env file created. Please edit it with your configuration." -ForegroundColor Green
} else {
    Write-Host "✅ .env file already exists" -ForegroundColor Green
}

# Create necessary directories
Write-Host "📁 Creating necessary directories..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path "data" | Out-Null
New-Item -ItemType Directory -Force -Path "logs" | Out-Null
New-Item -ItemType Directory -Force -Path "uploads" | Out-Null
New-Item -ItemType Directory -Force -Path "uploads\exports" | Out-Null
Write-Host "✅ Directories created" -ForegroundColor Green

# Run database seeds (development data)
Write-Host "🌱 Seeding development data..." -ForegroundColor Yellow
npm run seed
Write-Host "✅ Development data seeded" -ForegroundColor Green

Set-Location ..

Write-Host ""
Write-Host "🎉 Setup completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📱 To start the mobile app:" -ForegroundColor Cyan
Write-Host "   npm start" -ForegroundColor White
Write-Host ""
Write-Host "🖥️ To start the backend API:" -ForegroundColor Cyan
Write-Host "   cd backend && npm run dev" -ForegroundColor White
Write-Host ""
Write-Host "📧 Test user credentials:" -ForegroundColor Cyan
Write-Host "   Email: test@example.com" -ForegroundColor White
Write-Host "   Password: testpassword123" -ForegroundColor White
Write-Host ""
Write-Host "🔗 Backend API will be available at: http://localhost:3000" -ForegroundColor Cyan
Write-Host "📊 Health check: http://localhost:3000/health" -ForegroundColor Cyan
Write-Host ""
Write-Host "📱 Install Expo Go on your mobile device and scan the QR code to test the app!" -ForegroundColor Cyan
Write-Host ""
Write-Host "Happy coding! 🚀" -ForegroundColor Green
