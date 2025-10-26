# 🔐 Enhanced Authentication System - Testing Guide

## 🎉 **Complete User Registration & Admin Approval System**

The application now includes a comprehensive authentication system with user registration, admin approval workflow, and secure password-based login.

## 🔑 **Default Admin Credentials**

**Admin Account (Pre-configured):**
- **Username:** `admin`
- **Password:** `Admin123!`
- **Email:** `admin@securefileupload.com`
- **Role:** Administrator
- **Status:** Active

## 👥 **User Registration & Approval Workflow**

### **1. User Registration Process**
1. **Open Dashboard:** Go to `http://localhost:3000`
2. **Click "Register here"** on the login form
3. **Fill Registration Form:**
   - First Name: `John`
   - Last Name: `Doe`
   - Username: `johndoe` (3-30 chars, alphanumeric + underscore/hyphen)
   - Email: `john@example.com`
   - Password: `Password123!` (min 8 chars, uppercase, lowercase, number)
   - Confirm Password: `Password123!`
4. **Click "Register"**
5. **Status:** Account will be created with "pending" status

### **2. Admin Approval Process**
1. **Login as Admin:**
   - Username: `admin`
   - Password: `Admin123!`
2. **Go to Admin Panel** (👑 Admin Panel tab)
3. **View Pending Users** in User Management section
4. **Approve User:**
   - Click "✅ Approve" button
   - User status changes to "active"
5. **User can now login** with their credentials

## 🧪 **Testing Scenarios**

### **Test 1: User Registration**
```bash
# Test registration API
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Jane",
    "lastName": "Smith",
    "username": "janesmith",
    "email": "jane@example.com",
    "password": "Password123!",
    "confirmPassword": "Password123!"
  }'
```

### **Test 2: User Login**
```bash
# Test login API
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "usernameOrEmail": "admin",
    "password": "Admin123!"
  }'
```

### **Test 3: Admin User Management**
```bash
# Get all users (requires admin token)
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  http://localhost:3000/api/auth/admin/users

# Approve user (requires admin token)
curl -X POST http://localhost:3000/api/auth/admin/users/USER_ID/approve \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## 🎯 **Complete Testing Workflow**

### **Step 1: Start the Application**
```bash
cd /home/vaishnavu/Project_Secure_Coding
node src/main/app.js
```

### **Step 2: Test Admin Login**
1. Go to `http://localhost:3000`
2. Login with admin credentials
3. Verify admin panel is visible
4. Check user statistics

### **Step 3: Test User Registration**
1. Logout from admin account
2. Click "Register here"
3. Create a new user account
4. Verify registration success message

### **Step 4: Test Admin Approval**
1. Login as admin again
2. Go to Admin Panel
3. Find the pending user
4. Approve the user
5. Verify user status changes to "active"

### **Step 5: Test User Login**
1. Logout from admin
2. Login with the newly approved user
3. Verify dashboard access
4. Test file upload functionality

## 🔒 **Security Features Implemented**

### **Password Security**
- **Hashing:** bcrypt with 12 salt rounds
- **Validation:** Minimum 8 characters, uppercase, lowercase, number
- **Storage:** Passwords never stored in plain text

### **Account Security**
- **Lockout:** 5 failed attempts = 2-hour lockout
- **Status Management:** pending, active, suspended, rejected
- **Admin Control:** Full user management capabilities

### **Authentication Security**
- **Token-based:** Simple token system (upgrade to JWT in production)
- **Session Management:** Secure token storage
- **Authorization:** Role-based access control

## 📊 **Admin Panel Features**

### **User Management**
- **View All Users:** With filtering by status
- **Approve Users:** Change status from pending to active
- **Reject Users:** With reason tracking
- **Suspend Users:** Temporary account suspension
- **User Statistics:** Real-time user metrics

### **User Information Display**
- **Avatar:** Initials-based user avatars
- **Status Badges:** Color-coded status indicators
- **Metadata:** Join date, last login, email verification
- **Actions:** Context-sensitive action buttons

## 🎨 **UI/UX Enhancements**

### **Authentication Forms**
- **Dual Forms:** Login and registration in one interface
- **Form Switching:** Smooth transitions between forms
- **Real-time Validation:** Username/email availability checking
- **Password Strength:** Visual password requirements

### **Admin Interface**
- **Professional Design:** Clean, modern admin panel
- **Status Indicators:** Color-coded user status badges
- **Action Buttons:** Context-sensitive user management
- **Statistics Dashboard:** Real-time user metrics

## 🚀 **How to Use the New System**

### **For Regular Users:**
1. **Register:** Create account with username/password
2. **Wait for Approval:** Admin must approve your account
3. **Login:** Use your credentials once approved
4. **Upload Files:** Access full file management features

### **For Administrators:**
1. **Login:** Use admin credentials
2. **Access Admin Panel:** Click the admin tab
3. **Manage Users:** Approve, reject, or suspend users
4. **Monitor Statistics:** Track user activity and system health

## 🔧 **API Endpoints**

### **Authentication Endpoints**
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user info
- `GET /api/auth/check-username/:username` - Check username availability
- `GET /api/auth/check-email/:email` - Check email availability

### **Admin Endpoints**
- `GET /api/auth/admin/users` - Get all users
- `POST /api/auth/admin/users/:id/approve` - Approve user
- `POST /api/auth/admin/users/:id/reject` - Reject user
- `POST /api/auth/admin/users/:id/suspend` - Suspend user
- `GET /api/auth/admin/stats` - Get user statistics

## 🎯 **Testing Checklist**

- [ ] Admin can login with default credentials
- [ ] Admin panel is visible for admin users
- [ ] User registration form works correctly
- [ ] Username/email validation works
- [ ] Password strength validation works
- [ ] New users are created with "pending" status
- [ ] Admin can view pending users
- [ ] Admin can approve users
- [ ] Approved users can login
- [ ] User statistics are accurate
- [ ] File upload works for approved users
- [ ] Admin can suspend/reject users
- [ ] Authentication tokens work correctly

## 🎉 **Ready to Test!**

The enhanced authentication system is now complete with:
- ✅ User registration with validation
- ✅ Secure password hashing
- ✅ Admin approval workflow
- ✅ User management interface
- ✅ Role-based access control
- ✅ Modern, responsive UI

**Start testing with the default admin account and create new users to test the approval workflow!**
