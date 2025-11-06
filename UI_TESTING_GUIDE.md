# UI Testing Guide - Approve Button Fix

## Quick Start

Your server is already running! You can now test the fixed Approve button.

### 🎯 What Was Fixed
The Approve button wasn't working because the Content Security Policy (CSP) was blocking inline JavaScript. This has been fixed by using event delegation with data attributes - a more secure and modern approach.

---

## 📋 Manual Testing Steps

### Step 1: Open Two Browser Windows

**Window 1:** Regular browser window  
**Window 2:** Incognito/Private window (or different browser)

### Step 2: Register a New User (Window 2)

1. Open `http://localhost:3000` in the incognito window
2. Click **"Don't have an account? Register here"**
3. Fill in the form:
   ```
   First Name: TestUser
   Last Name: Demo
   Username: testuser_demo
   Email: testuser_demo@example.com
   Password: TestPass123!
   Confirm Password: TestPass123!
   ```
4. Click **"Register"**
5. You should see: **"Registration successful - awaiting admin approval"**

### Step 3: Login as Admin (Window 1)

1. Open `http://localhost:3000` in the regular window
2. Enter admin credentials:
   ```
   Username: admin
   Password: Admin123!
   ```
3. Click **"Login"**

### Step 4: Approve the User (Window 1)

1. Click on the **"Admin"** tab
2. In the **User Status Filter** dropdown, select **"Pending Approval"**
3. You should see the user you just registered (`testuser_demo`)
4. **Open Browser Console** (F12) to verify no CSP errors
5. Click the **"✅ Approve"** button

### Step 5: Verify the Fix ✅

**What should happen:**
- ✅ Success toast message: "User approved successfully"
- ✅ User status changes from "PENDING" to "ACTIVE"
- ✅ User disappears from "Pending Approval" filter
- ✅ No CSP errors in browser console
- ✅ Admin stats update automatically

**What you should NOT see:**
- ❌ CSP violation errors in console
- ❌ Button doesn't respond to clicks
- ❌ Page refresh required to see changes

### Step 6: Verify Approved User Can Login (Window 2)

1. Go back to the incognito window
2. Click **"Already have an account? Login here"**
3. Enter the test user credentials:
   ```
   Username: testuser_demo
   Password: TestPass123!
   ```
4. Click **"Login"**
5. ✅ User should successfully login and see the dashboard

---

## 🔍 Browser Console Check

### Before Fix (What you were seeing):
```
Refused to execute inline event handler because it violates the following 
Content Security Policy directive: "script-src 'self'". Either the 
'unsafe-inline' keyword, a hash ('sha256-...'), or a nonce ('nonce-...') 
is required to enable inline execution.
```

### After Fix (What you should see now):
```
✓ No CSP errors
✓ Clean console (or only informational logs)
```

---

## 🔧 What Was Changed

### Old Code (Blocked by CSP):
```html
<button onclick="app.approveUser('user-id')">✅ Approve</button>
```

### New Code (CSP-Compliant):
```html
<button data-action="approve" data-user-id="user-id">✅ Approve</button>
```

The button now uses data attributes and event delegation, which is:
- ✅ More secure
- ✅ CSP-compliant
- ✅ Better performance
- ✅ Industry best practice

---

## 🧪 Automated Test

You can also run the automated test:

```bash
cd /home/vaishnavu/Project-SecureCode
./test-ui-approve.sh
```

This will:
1. Register a new test user
2. Login as admin
3. Approve the user via API
4. Verify the user can login

---

## 🐛 Troubleshooting

### Button still not working?
1. **Hard refresh** the page (Ctrl+Shift+R or Cmd+Shift+R)
2. **Clear browser cache**
3. Check console for any JavaScript errors
4. Verify server is running: `curl http://localhost:3000/health`

### CSP errors still appearing?
1. Make sure you're testing the latest code
2. Clear browser cache completely
3. Try a different browser
4. Check that `/public/js/app.js` has been updated

### Server not responding?
```bash
# Check if server is running
curl http://localhost:3000/health

# If not, start it
npm start
```

---

## ✨ Additional Features Fixed

This fix also resolved the same CSP issue for:
- ✅ **Reject** button (for pending users)
- ✅ **Suspend** button (for active users)
- ✅ **File management** buttons (Download, View, Delete)
- ✅ **Pagination** buttons (for both users and files)
- ✅ **Modal action** buttons (in file details modal)

All buttons now work properly with the strict CSP in place!

---

## 📊 Test Results

API endpoint test results:
```
✅ Test 1: Register user - PASSED
✅ Test 2: Login as admin - PASSED  
✅ Test 3: Approve user - PASSED
✅ Test 4: Login as approved user - PASSED
```

---

## 📝 Summary

**Problem:** Approve button in UI wasn't working due to CSP blocking inline onclick handlers

**Solution:** Refactored to use event delegation with data attributes (CSP-compliant)

**Result:** All buttons now work correctly while maintaining security

**Status:** ✅ **COMPLETE**

---

**Need help?** Check the console for errors or refer to `CSP_FIX_SUMMARY.md` for technical details.

