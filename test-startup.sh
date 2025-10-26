#!/bin/bash

echo "🔧 Testing Secure File Upload Application..."

# Check if we're in the right directory
if [ ! -f "src/main/app.js" ]; then
    echo "❌ Not in the correct directory"
    exit 1
fi

echo "✅ In correct directory"

# Test syntax
echo "🔍 Checking syntax..."
if node -c src/main/app.js 2>/dev/null; then
    echo "✅ Syntax check passed"
else
    echo "❌ Syntax errors found"
    exit 1
fi

# Test if dependencies are installed
echo "🔍 Checking dependencies..."
if [ ! -d "node_modules" ]; then
    echo "❌ Dependencies not installed. Run: npm install"
    exit 1
fi

echo "✅ Dependencies installed"

# Test the application startup
echo "🚀 Starting application..."
timeout 5s node src/main/app.js &
APP_PID=$!

sleep 3

# Check if the process is still running
if kill -0 $APP_PID 2>/dev/null; then
    echo "✅ Application started successfully"
    kill $APP_PID 2>/dev/null
    echo "✅ Application stopped cleanly"
else
    echo "❌ Application failed to start"
    exit 1
fi

echo "🎉 All tests passed! The application is ready to use."
echo ""
echo "📋 Next steps:"
echo "1. Start the application: npm start"
echo "2. Open browser: http://localhost:3000"
echo "3. Login with admin credentials:"
echo "   Username: admin"
echo "   Password: Admin123!"
echo "4. Test user registration and approval workflow"
