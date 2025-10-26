#!/bin/bash

echo "Starting Secure File Upload Server..."
echo "====================================="

cd /home/vaishnavu/Project_Secure_Coding

# Kill any existing processes
pkill -f "node src/main/app.js" 2>/dev/null
sleep 2

# Start the server
echo "Starting server..."
node src/main/app.js
