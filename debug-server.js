const express = require('express');
const path = require('path');

// Simple test server to debug login issues
const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use('/static', express.static(path.join(__dirname, '../../public')));

// Serve dashboard at root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/index.html'));
});

// Test authentication endpoint
app.post('/api/auth/login', (req, res) => {
  console.log('Login attempt:', req.body);
  
  const { usernameOrEmail, password } = req.body;
  
  // Simple test - accept admin login
  if (usernameOrEmail === 'admin' && password === 'Admin123!') {
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: 'admin-123',
          username: 'admin',
          email: 'admin@securefileupload.com',
          role: 'admin',
          status: 'active'
        },
        token: 'admin-123:' + Date.now()
      }
    });
  } else {
    res.status(401).json({
      success: false,
      error: 'Invalid username or password',
      code: 'INVALID_CREDENTIALS'
    });
  }
});

// Test registration endpoint
app.post('/api/auth/register', (req, res) => {
  console.log('Registration attempt:', req.body);
  
  res.json({
    success: true,
    message: 'Registration successful. Your account is pending admin approval.',
    data: {
      userId: 'user-123',
      username: req.body.username,
      status: 'pending'
    }
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Test Server running on http://0.0.0.0:${PORT}`);
  console.log('🔐 Test Admin Login:');
  console.log('   Username: admin');
  console.log('   Password: Admin123!');
  console.log('');
  console.log('📝 Test Registration:');
  console.log('   Any valid registration data will be accepted');
});
