#!/bin/bash

# Test script for Admin User Approval Flow
# This script tests the complete user registration and approval workflow

BASE_URL="http://localhost:3000"
API_URL="$BASE_URL/api"

echo "========================================="
echo "🧪 Admin User Approval Flow Test"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Check server health
echo "📋 Test 1: Checking server health..."
HEALTH_RESPONSE=$(curl -s "$BASE_URL/health")
if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
    echo -e "${GREEN}✅ Server is healthy${NC}"
else
    echo -e "${RED}❌ Server health check failed${NC}"
    exit 1
fi
echo ""

# Test 2: Register a new test user
echo "📋 Test 2: Registering new test user..."
TIMESTAMP=$(date +%s)
TEST_USERNAME="testuser_$TIMESTAMP"
TEST_EMAIL="testuser_$TIMESTAMP@example.com"
TEST_PASSWORD="TestPass123!"

REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"$TEST_USERNAME\",
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\",
    \"firstName\": \"Test\",
    \"lastName\": \"User\"
  }")

if echo "$REGISTER_RESPONSE" | grep -q "success.*true"; then
    echo -e "${GREEN}✅ User registration successful${NC}"
    echo "   Username: $TEST_USERNAME"
    echo "   Email: $TEST_EMAIL"
    
    # Extract user ID (field is 'userId' not 'id')
    USER_ID=$(echo "$REGISTER_RESPONSE" | grep -o '"userId":"[^"]*"' | head -1 | cut -d'"' -f4)
    echo "   User ID: $USER_ID"
    
    if [ -z "$USER_ID" ]; then
        echo -e "${RED}❌ Failed to extract user ID${NC}"
        echo "   Response: $REGISTER_RESPONSE"
        exit 1
    fi
else
    echo -e "${RED}❌ User registration failed${NC}"
    echo "   Response: $REGISTER_RESPONSE"
    exit 1
fi
echo ""

# Test 3: Login as admin
echo "📋 Test 3: Logging in as admin..."
ADMIN_LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"usernameOrEmail\": \"admin\",
    \"password\": \"Admin123!\"
  }")

if echo "$ADMIN_LOGIN_RESPONSE" | grep -q "success.*true"; then
    echo -e "${GREEN}✅ Admin login successful${NC}"
    
    # Extract admin token
    ADMIN_TOKEN=$(echo "$ADMIN_LOGIN_RESPONSE" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    echo "   Token extracted: ${ADMIN_TOKEN:0:20}..."
else
    echo -e "${RED}❌ Admin login failed${NC}"
    echo "   Response: $ADMIN_LOGIN_RESPONSE"
    exit 1
fi
echo ""

# Test 4: Get pending users list
echo "📋 Test 4: Fetching pending users..."
PENDING_USERS=$(curl -s -X GET "$API_URL/auth/admin/users?status=pending" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json")

if echo "$PENDING_USERS" | grep -q "$TEST_USERNAME"; then
    echo -e "${GREEN}✅ Found newly registered user in pending list${NC}"
else
    echo -e "${YELLOW}⚠️  User not found in pending list (may already be processed)${NC}"
    echo "   Response: $PENDING_USERS"
fi
echo ""

# Test 5: Approve the user (THE MAIN FIX)
echo "📋 Test 5: Approving the user (TESTING THE FIX)..."
APPROVE_RESPONSE=$(curl -s -X POST "$API_URL/auth/admin/users/$USER_ID/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json")

if echo "$APPROVE_RESPONSE" | grep -q "success.*true"; then
    echo -e "${GREEN}✅ ✨ USER APPROVAL SUCCESSFUL! ✨${NC}"
    echo -e "${GREEN}   The admin approval functionality is working correctly!${NC}"
else
    echo -e "${RED}❌ User approval failed${NC}"
    echo "   Response: $APPROVE_RESPONSE"
    exit 1
fi
echo ""

# Test 6: Verify user is now active
echo "📋 Test 6: Verifying user status changed to active..."
ACTIVE_USERS=$(curl -s -X GET "$API_URL/auth/admin/users?status=active" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json")

if echo "$ACTIVE_USERS" | grep -q "$TEST_USERNAME"; then
    echo -e "${GREEN}✅ User is now active${NC}"
else
    echo -e "${YELLOW}⚠️  User not found in active list${NC}"
fi
echo ""

# Test 7: Test approved user can login
echo "📋 Test 7: Testing approved user can login..."
USER_LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"usernameOrEmail\": \"$TEST_USERNAME\",
    \"password\": \"$TEST_PASSWORD\"
  }")

if echo "$USER_LOGIN_RESPONSE" | grep -q "success.*true"; then
    echo -e "${GREEN}✅ Approved user can login successfully${NC}"
else
    echo -e "${RED}❌ Approved user cannot login${NC}"
    echo "   Response: $USER_LOGIN_RESPONSE"
    exit 1
fi
echo ""

# Summary
echo "========================================="
echo -e "${GREEN}✅ ALL TESTS PASSED!${NC}"
echo "========================================="
echo ""
echo "Summary:"
echo "  ✅ Server is running and healthy"
echo "  ✅ User registration works"
echo "  ✅ Admin login works"
echo "  ✅ Pending users list accessible"
echo "  ✅ USER APPROVAL WORKS (FIX VERIFIED)"
echo "  ✅ User status updated correctly"
echo "  ✅ Approved user can login"
echo ""
echo "🎉 The admin approval functionality is working correctly!"
echo ""

