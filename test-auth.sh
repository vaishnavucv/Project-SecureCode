#!/bin/bash

# Test script for Secure File Upload Application
# This script demonstrates how to test the authentication system

echo "🔐 Secure File Upload - Authentication Test"
echo "=========================================="
echo ""

echo "📋 Valid User ID Examples:"
echo "✅ testuser"
echo "✅ user123" 
echo "✅ admin_user"
echo "✅ demo-user-2024"
echo "✅ alice123"
echo "✅ bob_test"
echo ""

echo "❌ Invalid User ID Examples:"
echo "❌ ab (too short)"
echo "❌ user@domain.com (contains @)"
echo "❌ user name (contains space)"
echo "❌ user.name (contains dot)"
echo ""

echo "🧪 How to Test:"
echo "1. Start the application: node src/main/app.js"
echo "2. Open browser: http://localhost:3000"
echo "3. Enter any valid user ID (e.g., 'testuser')"
echo "4. Click Login"
echo "5. Upload files and test the dashboard"
echo ""

echo "🔧 API Testing Examples:"
echo ""

# Test health endpoint
echo "Testing health endpoint..."
curl -s -H "X-User-ID: testuser" http://localhost:3000/api/health 2>/dev/null | head -1 || echo "Server not running - start with: node src/main/app.js"

echo ""
echo "📁 Test file upload:"
echo "curl -X POST http://localhost:3000/api/upload \\"
echo "  -H 'X-User-ID: testuser' \\"
echo "  -F 'file=@test.txt'"
echo ""

echo "📥 Test file download:"
echo "curl -H 'X-User-ID: testuser' \\"
echo "  http://localhost:3000/api/files/{fileId}"
echo ""

echo "📊 Test statistics:"
echo "curl -H 'X-User-ID: testuser' \\"
echo "  http://localhost:3000/api/stats"
echo ""

echo "🎯 Ready to test! Use any valid user ID format."
