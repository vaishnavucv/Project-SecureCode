# Deployment Guide

## Secure File Upload Application - Production Deployment

This guide provides comprehensive instructions for deploying the Secure File Upload Application in production environments following security best practices.

---

## Prerequisites

### System Requirements

- **Operating System**: Linux (Ubuntu 20.04+ recommended)
- **Node.js**: Version 18.0.0 or higher
- **Memory**: Minimum 2GB RAM, 4GB recommended
- **Storage**: Minimum 10GB available space
- **CPU**: 2 cores minimum, 4 cores recommended

### Software Dependencies

- **Docker**: 20.10+ (for containerized deployment)
- **Docker Compose**: 2.0+ (for multi-container deployment)
- **Nginx**: 1.18+ (for reverse proxy)
- **SSL Certificate**: Valid SSL certificate for HTTPS

---

## Security Considerations

### Production Security Checklist

- [ ] Change all default secrets and passwords
- [ ] Enable HTTPS with valid SSL certificate
- [ ] Configure firewall rules
- [ ] Set up monitoring and logging
- [ ] Implement backup strategy
- [ ] Configure file permissions
- [ ] Enable security headers
- [ ] Set up intrusion detection
- [ ] Configure rate limiting
- [ ] Implement access controls

---

## Deployment Methods

### Method 1: Docker Deployment (Recommended)

#### 1. Prepare Environment

```bash
# Clone the repository
git clone <repository-url>
cd Project_Secure_Coding
```

**Copy the .env.example file to .env and update all environment variables**

#### 2. Configure Docker Compose

```bash
# Review and modify docker-compose.yml
# Ensure all secrets are properly configured
# Set appropriate resource limits
```

#### 3. Deploy Application

```bash
# Build and start services
docker-compose up -d

# Check service status
docker-compose ps

# View logs
docker-compose logs -f secure-file-upload
```

#### 4. Verify Deployment

```bash
# Check health endpoint
curl https://your-domain.com/api/health

# Check service statistics
curl -H "X-User-ID: test" https://your-domain.com/api/stats
```

### Method 2: Manual Deployment

#### 1. Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install curl
sudo apt install curl -y

# Download and install nvm:
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
# in lieu of restarting the shell
\. "$HOME/.nvm/nvm.sh"
# Download and install Node.js:
nvm install 22
# Verify the Node.js version:
node -v # Should print "v24.11.0".
# Verify npm version:
npm -v # Should print "11.6.1".

# Install PM2 for process management
sudo npm install -g pm2

# Install Nginx
sudo apt install nginx -y
```

#### 2. Deploy Application

```bash
# Clone repository
git clone <repository-url>
cd Project_Secure_Coding

# Install dependencies
npm ci --production

# Create application user
sudo useradd -r -s /bin/false secureapp

# Create directories
sudo mkdir -p /var/secure-file-upload/{uploads,logs,data}
sudo chown -R secureapp:secureapp /var/secure-file-upload
sudo chmod 755 /var/secure-file-upload/{uploads,logs,data}

# Copy application files
sudo cp -r . /opt/secure-file-upload
sudo chown -R secureapp:secureapp /opt/secure-file-upload
```

#### 3. Configure Application

```bash
# Create production config
sudo -u secureapp tee /opt/secure-file-upload/config.yaml << EOF
server:
  port: 3000
  host: "127.0.0.1"
  environment: "production"

security:
  max_file_size_mb: 10
  allowed_extensions: [".png", ".jpg", ".jpeg", ".gif", ".pdf", ".doc", ".docx", ".txt", ".csv", ".xlsx"]
  storage_path: "/var/secure-file-upload/uploads"
  storage_permissions: "644"
  session_secret: "your-super-secret-session-key"
  jwt_secret: "your-super-secret-jwt-key"
  session_timeout_minutes: 30

logging:
  level: "info"
  log_path: "/var/secure-file-upload/logs"
  max_file_size: "10m"
  max_files: 5
EOF
```

#### 4. Configure PM2

```bash
# Create PM2 ecosystem file
sudo -u secureapp tee /opt/secure-file-upload/ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'secure-file-upload',
    script: 'src/main/app.js',
    cwd: '/opt/secure-file-upload',
    user: 'secureapp',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/secure-file-upload/logs/error.log',
    out_file: '/var/secure-file-upload/logs/out.log',
    log_file: '/var/secure-file-upload/logs/combined.log',
    time: true,
    max_memory_restart: '1G',
    node_args: '--max-old-space-size=1024'
  }]
};
EOF

# Start application
sudo -u secureapp pm2 start /opt/secure-file-upload/ecosystem.config.js
sudo -u secureapp pm2 save
sudo -u secureapp pm2 startup
```

---

## Nginx Configuration

### 1. Create Nginx Configuration

```bash
sudo tee /etc/nginx/sites-available/secure-file-upload << EOF
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL Configuration
    ssl_certificate /etc/ssl/certs/your-domain.crt;
    ssl_certificate_key /etc/ssl/private/your-domain.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Rate Limiting
    limit_req_zone \$binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone \$binary_remote_addr zone=upload:10m rate=1r/s;

    # File Upload Limits
    client_max_body_size 10M;
    client_body_timeout 60s;
    client_header_timeout 60s;

    # Proxy Configuration
    location / {
        limit_req zone=api burst=20 nodelay;
        
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Upload Endpoint with Special Rate Limiting
    location /api/upload {
        limit_req zone=upload burst=5 nodelay;
        
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # Extended timeouts for file uploads
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # Health Check (No Rate Limiting)
    location /api/health {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
```

### 2. Enable Site

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/secure-file-upload /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

## SSL Certificate Setup

### Using Let's Encrypt (Recommended)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Obtain certificate
sudo certbot --nginx -d your-domain.com

# Test renewal
sudo certbot renew --dry-run
```

### Using Custom Certificate

```bash
# Copy certificate files
sudo cp your-domain.crt /etc/ssl/certs/
sudo cp your-domain.key /etc/ssl/private/
sudo chmod 600 /etc/ssl/private/your-domain.key
sudo chmod 644 /etc/ssl/certs/your-domain.crt
```

---

## Firewall Configuration

### UFW Configuration

```bash
# Enable UFW
sudo ufw enable

# Allow SSH
sudo ufw allow ssh

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Deny direct access to application port
sudo ufw deny 3000/tcp

# Check status
sudo ufw status
```

### iptables Configuration

```bash
# Allow loopback
iptables -A INPUT -i lo -j ACCEPT

# Allow established connections
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Allow SSH
iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# Allow HTTP and HTTPS
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# Deny direct access to application
iptables -A INPUT -p tcp --dport 3000 -j DROP

# Set default policies
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -P OUTPUT ACCEPT
```

---

## Monitoring and Logging

### 1. Configure Log Rotation

```bash
sudo tee /etc/logrotate.d/secure-file-upload << EOF
/var/secure-file-upload/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 644 secureapp secureapp
    postrotate
        pm2 reload secure-file-upload
    endscript
}
EOF
```

### 2. Set Up Monitoring

```bash
# Install monitoring tools
sudo apt install htop iotop nethogs -y

# Create monitoring script
sudo tee /opt/secure-file-upload/monitor.sh << 'EOF'
#!/bin/bash

# Check application health
curl -f http://localhost:3000/api/health > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo "$(date): Application health check failed" >> /var/secure-file-upload/logs/monitor.log
    # Restart application
    pm2 restart secure-file-upload
fi

# Check disk space
DISK_USAGE=$(df /var/secure-file-upload | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "$(date): Disk usage is ${DISK_USAGE}%" >> /var/secure-file-upload/logs/monitor.log
fi

# Check memory usage
MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
if [ $MEMORY_USAGE -gt 90 ]; then
    echo "$(date): Memory usage is ${MEMORY_USAGE}%" >> /var/secure-file-upload/logs/monitor.log
fi
EOF

sudo chmod +x /opt/secure-file-upload/monitor.sh

# Add to crontab
echo "*/5 * * * * /opt/secure-file-upload/monitor.sh" | sudo crontab -
```

### 3. Set Up Log Monitoring

```bash
# Install fail2ban for log monitoring
sudo apt install fail2ban -y

# Configure fail2ban
sudo tee /etc/fail2ban/jail.local << EOF
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[nginx-http-auth]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log

[nginx-limit-req]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 10
EOF

sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

---

## Backup Strategy

### 1. Create Backup Script

```bash
sudo tee /opt/secure-file-upload/backup.sh << 'EOF'
#!/bin/bash

BACKUP_DIR="/var/backups/secure-file-upload"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup application files
tar -czf $BACKUP_DIR/app_$DATE.tar.gz -C /opt secure-file-upload

# Backup uploads
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz -C /var secure-file-upload/uploads

# Backup logs
tar -czf $BACKUP_DIR/logs_$DATE.tar.gz -C /var secure-file-upload/logs

# Backup database
tar -czf $BACKUP_DIR/data_$DATE.tar.gz -C /var secure-file-upload/data

# Remove old backups (keep 7 days)
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "$(date): Backup completed" >> /var/secure-file-upload/logs/backup.log
EOF

sudo chmod +x /opt/secure-file-upload/backup.sh

# Add to crontab (daily at 2 AM)
echo "0 2 * * * /opt/secure-file-upload/backup.sh" | sudo crontab -
```

### 2. Test Backup

```bash
# Run backup manually
sudo /opt/secure-file-upload/backup.sh

# Verify backup
ls -la /var/backups/secure-file-upload/
```

---

## Security Hardening

### 1. System Hardening

```bash
# Disable unnecessary services
sudo systemctl disable bluetooth
sudo systemctl disable cups
sudo systemctl disable avahi-daemon

# Configure kernel parameters
echo "net.ipv4.conf.all.send_redirects = 0" | sudo tee -a /etc/sysctl.conf
echo "net.ipv4.conf.default.send_redirects = 0" | sudo tee -a /etc/sysctl.conf
echo "net.ipv4.conf.all.accept_redirects = 0" | sudo tee -a /etc/sysctl.conf
echo "net.ipv4.conf.default.accept_redirects = 0" | sudo tee -a /etc/sysctl.conf
echo "net.ipv4.conf.all.secure_redirects = 0" | sudo tee -a /etc/sysctl.conf
echo "net.ipv4.conf.default.secure_redirects = 0" | sudo tee -a /etc/sysctl.conf
echo "net.ipv4.ip_forward = 0" | sudo tee -a /etc/sysctl.conf
echo "net.ipv4.conf.all.accept_source_route = 0" | sudo tee -a /etc/sysctl.conf
echo "net.ipv4.conf.default.accept_source_route = 0" | sudo tee -a /etc/sysctl.conf
echo "net.ipv4.conf.all.log_martians = 1" | sudo tee -a /etc/sysctl.conf
echo "net.ipv4.conf.default.log_martians = 1" | sudo tee -a /etc/sysctl.conf
echo "net.ipv4.icmp_echo_ignore_broadcasts = 1" | sudo tee -a /etc/sysctl.conf
echo "net.ipv4.icmp_ignore_bogus_error_responses = 1" | sudo tee -a /etc/sysctl.conf
echo "net.ipv4.tcp_syncookies = 1" | sudo tee -a /etc/sysctl.conf
echo "net.ipv4.conf.all.rp_filter = 1" | sudo tee -a /etc/sysctl.conf
echo "net.ipv4.conf.default.rp_filter = 1" | sudo tee -a /etc/sysctl.conf

# Apply changes
sudo sysctl -p
```

### 2. Application Security

```bash
# Set proper file permissions
sudo chown -R secureapp:secureapp /var/secure-file-upload
sudo chmod 755 /var/secure-file-upload
sudo chmod 644 /var/secure-file-upload/uploads/*
sudo chmod 644 /var/secure-file-upload/logs/*

# Disable directory listing
echo "Options -Indexes" | sudo tee /etc/nginx/conf.d/disable-indexes.conf

# Remove server tokens
echo "server_tokens off;" | sudo tee /etc/nginx/conf.d/security.conf
```

---

## Troubleshooting

### Common Issues

#### 1. Application Won't Start

```bash
# Check logs
pm2 logs secure-file-upload

# Check configuration
node -c /opt/secure-file-upload/src/main/app.js

# Check permissions
ls -la /var/secure-file-upload/
```

#### 2. File Upload Fails

```bash
# Check file permissions
ls -la /var/secure-file-upload/uploads/

# Check disk space
df -h /var/secure-file-upload/

# Check Nginx configuration
sudo nginx -t
```

#### 3. High Memory Usage

```bash
# Check memory usage
pm2 monit

# Restart application
pm2 restart secure-file-upload

# Check for memory leaks
node --inspect /opt/secure-file-upload/src/main/app.js
```

### Log Analysis

```bash
# View application logs
tail -f /var/secure-file-upload/logs/app.log

# View security logs
tail -f /var/secure-file-upload/logs/security.log

# View error logs
tail -f /var/secure-file-upload/logs/error.log

# Search for specific errors
grep -i "error" /var/secure-file-upload/logs/*.log
```

---

## Maintenance

### Regular Maintenance Tasks

1. **Daily**:
   - Check application health
   - Monitor disk space
   - Review security logs

2. **Weekly**:
   - Update system packages
   - Review application logs
   - Check backup status

3. **Monthly**:
   - Update application dependencies
   - Review security audit
   - Test disaster recovery

### Update Procedure

```bash
# 1. Backup current version
sudo /opt/secure-file-upload/backup.sh

# 2. Pull latest changes
cd /opt/secure-file-upload
sudo -u secureapp git pull

# 3. Install new dependencies
sudo -u secureapp npm ci --production

# 4. Test configuration
sudo -u secureapp node -c src/main/app.js

# 5. Restart application
pm2 restart secure-file-upload

# 6. Verify deployment
curl -f http://localhost:3000/api/health
```

---

## Performance Optimization

### 1. Node.js Optimization

```bash
# Set Node.js options
export NODE_OPTIONS="--max-old-space-size=1024 --optimize-for-size"

# Enable clustering
pm2 start ecosystem.config.js --instances max
```

### 2. Nginx Optimization

```bash
# Add to nginx.conf
worker_processes auto;
worker_connections 1024;

# Enable gzip compression
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
```

### 3. System Optimization

```bash
# Increase file limits
echo "secureapp soft nofile 65536" | sudo tee -a /etc/security/limits.conf
echo "secureapp hard nofile 65536" | sudo tee -a /etc/security/limits.conf

# Optimize kernel parameters
echo "fs.file-max = 2097152" | sudo tee -a /etc/sysctl.conf
echo "net.core.somaxconn = 65535" | sudo tee -a /etc/sysctl.conf
```

---

## Conclusion

This deployment guide provides comprehensive instructions for securely deploying the Secure File Upload Application in production. Follow all security recommendations and regularly update the application to maintain security and performance.

For additional support, refer to:
- API Documentation: `API_DOC.md`
- Security Audit: `SELF_AUDIT.md`
- Application README: `README.md`
