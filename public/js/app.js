/**
 * Secure File Upload Dashboard - Enhanced Authentication
 * Client-side application with user registration and admin approval
 * Following OWASP guidelines for client-side security
 */

class SecureFileUploadApp {
    constructor() {
        this.currentUser = null;
        this.authToken = null;
        this.apiBaseUrl = '/api';
        this.authApiUrl = '/api/auth';
        this.currentTab = 'upload';
        this.files = [];
        this.users = [];
        this.currentPage = 0;
        this.filesPerPage = 10;
        this.usersPerPage = 10;
        
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkAuth();
        this.setupFileIcons();
    }

    bindEvents() {
        // Authentication forms
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        document.getElementById('register-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleRegistration();
        });

        // Auth form switching
        document.getElementById('show-register').addEventListener('click', (e) => {
            e.preventDefault();
            this.showRegistrationForm();
        });

        document.getElementById('show-login').addEventListener('click', (e) => {
            e.preventDefault();
            this.showLoginForm();
        });

        // Logout button
        document.getElementById('logout-btn').addEventListener('click', () => {
            this.handleLogout();
        });

        // Tab navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // File upload
        const uploadArea = document.getElementById('upload-area');
        const fileInput = document.getElementById('file-input');

        uploadArea.addEventListener('click', () => fileInput.click());
        uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
        fileInput.addEventListener('change', (e) => this.handleFileSelect(e));

        // File management
        document.getElementById('refresh-files').addEventListener('click', () => {
            this.loadFiles();
        });

        document.getElementById('status-filter').addEventListener('change', () => {
            this.loadFiles();
        });

        // Statistics
        document.getElementById('refresh-stats').addEventListener('click', () => {
            this.loadStats();
        });

        // Admin panel
        document.getElementById('refresh-users').addEventListener('click', () => {
            this.loadUsers();
        });

        document.getElementById('user-status-filter').addEventListener('change', () => {
            this.loadUsers();
        });

        document.getElementById('refresh-admin-stats').addEventListener('click', () => {
            this.loadAdminStats();
        });

        // Modal
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                this.closeModal();
            });
        });

        // Close modal on outside click
        document.getElementById('file-modal').addEventListener('click', (e) => {
            if (e.target.id === 'file-modal') {
                this.closeModal();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });

        // Real-time username/email checking
        document.getElementById('reg-username').addEventListener('blur', () => {
            this.checkUsernameAvailability();
        });

        document.getElementById('reg-email').addEventListener('blur', () => {
            this.checkEmailAvailability();
        });
    }

    checkAuth() {
        const savedToken = localStorage.getItem('secureFileUploadToken');
        const savedUser = localStorage.getItem('secureFileUploadUser');
        
        if (savedToken && savedUser) {
            try {
                const user = JSON.parse(savedUser);
                this.authToken = savedToken;
                this.currentUser = user;
                this.showDashboard();
            } catch (error) {
                this.clearAuth();
                this.showAuth();
            }
        } else {
            this.showAuth();
        }
    }

    async handleLogin() {
        const usernameOrEmail = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;

        if (!usernameOrEmail || !password) {
            this.showToast('Please enter both username/email and password', 'error');
            return;
        }

        try {
            const response = await fetch(`${this.authApiUrl}/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    usernameOrEmail,
                    password
                })
            });

            const result = await response.json();

            if (result.success) {
                this.authToken = result.data.token;
                this.currentUser = result.data.user;
                
                localStorage.setItem('secureFileUploadToken', this.authToken);
                localStorage.setItem('secureFileUploadUser', JSON.stringify(this.currentUser));
                
                this.showDashboard();
                this.showToast('Login successful', 'success');
            } else {
                this.showToast(result.error, 'error');
            }
        } catch (error) {
            this.showToast('Login failed. Please try again.', 'error');
            console.error('Login error:', error);
        }
    }

    async handleRegistration() {
        const formData = {
            firstName: document.getElementById('reg-firstname').value.trim(),
            lastName: document.getElementById('reg-lastname').value.trim(),
            username: document.getElementById('reg-username').value.trim(),
            email: document.getElementById('reg-email').value.trim(),
            password: document.getElementById('reg-password').value,
            confirmPassword: document.getElementById('reg-confirm-password').value
        };

        // Client-side validation
        const validation = this.validateRegistration(formData);
        if (!validation.isValid) {
            this.showToast(validation.errors.join(', '), 'error');
            return;
        }

        try {
            const response = await fetch(`${this.authApiUrl}/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (result.success) {
                this.showToast(result.message, 'success');
                this.showLoginForm();
                this.clearRegistrationForm();
            } else {
                this.showToast(result.error, 'error');
            }
        } catch (error) {
            this.showToast('Registration failed. Please try again.', 'error');
            console.error('Registration error:', error);
        }
    }

    validateRegistration(data) {
        const errors = [];

        if (!data.firstName) errors.push('First name is required');
        if (!data.lastName) errors.push('Last name is required');
        if (!data.username) errors.push('Username is required');
        if (!data.email) errors.push('Email is required');
        if (!data.password) errors.push('Password is required');

        if (data.username && !/^[a-zA-Z0-9_-]{3,30}$/.test(data.username)) {
            errors.push('Username must be 3-30 characters, alphanumeric with underscores and hyphens only');
        }

        if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
            errors.push('Valid email address is required');
        }

        if (data.password && data.password.length < 8) {
            errors.push('Password must be at least 8 characters long');
        }

        if (data.password && !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(data.password)) {
            errors.push('Password must contain at least one lowercase letter, one uppercase letter, and one number');
        }

        if (data.password !== data.confirmPassword) {
            errors.push('Passwords do not match');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    async checkUsernameAvailability() {
        const username = document.getElementById('reg-username').value.trim();
        if (!username || !/^[a-zA-Z0-9_-]{3,30}$/.test(username)) return;

        try {
            const response = await fetch(`${this.authApiUrl}/check-username/${encodeURIComponent(username)}`);
            const result = await response.json();
            
            if (result.success) {
                const input = document.getElementById('reg-username');
                if (result.available) {
                    input.style.borderColor = 'var(--success-color)';
                } else {
                    input.style.borderColor = 'var(--danger-color)';
                }
            }
        } catch (error) {
            console.error('Username check error:', error);
        }
    }

    async checkEmailAvailability() {
        const email = document.getElementById('reg-email').value.trim();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;

        try {
            const response = await fetch(`${this.authApiUrl}/check-email/${encodeURIComponent(email)}`);
            const result = await response.json();
            
            if (result.success) {
                const input = document.getElementById('reg-email');
                if (result.available) {
                    input.style.borderColor = 'var(--success-color)';
                } else {
                    input.style.borderColor = 'var(--danger-color)';
                }
            }
        } catch (error) {
            console.error('Email check error:', error);
        }
    }

    showLoginForm() {
        document.getElementById('login-card').style.display = 'block';
        document.getElementById('register-card').style.display = 'none';
    }

    showRegistrationForm() {
        document.getElementById('login-card').style.display = 'none';
        document.getElementById('register-card').style.display = 'block';
    }

    clearRegistrationForm() {
        document.getElementById('register-form').reset();
        document.querySelectorAll('#register-form input').forEach(input => {
            input.style.borderColor = '';
        });
    }

    handleLogout() {
        this.clearAuth();
        this.showAuth();
        this.showToast('Logged out successfully', 'success');
    }

    clearAuth() {
        this.currentUser = null;
        this.authToken = null;
        localStorage.removeItem('secureFileUploadToken');
        localStorage.removeItem('secureFileUploadUser');
    }

    showAuth() {
        document.getElementById('auth-section').style.display = 'flex';
        document.getElementById('dashboard-section').style.display = 'none';
        document.getElementById('current-user').textContent = 'Not logged in';
        document.getElementById('logout-btn').style.display = 'none';
        this.showLoginForm();
    }

    showDashboard() {
        document.getElementById('auth-section').style.display = 'none';
        document.getElementById('dashboard-section').style.display = 'block';
        document.getElementById('current-user').textContent = this.currentUser.username;
        document.getElementById('logout-btn').style.display = 'inline-flex';
        
        // Show admin tab if user is admin
        if (this.currentUser.role === 'admin') {
            document.querySelector('.admin-only').style.display = 'inline-flex';
        } else {
            document.querySelector('.admin-only').style.display = 'none';
        }
        
        // Load initial data
        this.loadFiles();
        this.loadStats();
        
        if (this.currentUser.role === 'admin') {
            this.loadUsers();
            this.loadAdminStats();
        }
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}-tab`).classList.add('active');

        this.currentTab = tabName;

        // Load data for specific tabs
        if (tabName === 'files') {
            this.loadFiles();
        } else if (tabName === 'stats') {
            this.loadStats();
        } else if (tabName === 'admin') {
            this.loadUsers();
            this.loadAdminStats();
        }
    }

    // File Upload Methods (same as before)
    handleDragOver(e) {
        e.preventDefault();
        e.currentTarget.classList.add('dragover');
    }

    handleDragLeave(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('dragover');
    }

    handleDrop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('dragover');
        const files = Array.from(e.dataTransfer.files);
        this.processFiles(files);
    }

    handleFileSelect(e) {
        const files = Array.from(e.target.files);
        this.processFiles(files);
    }

    async processFiles(files) {
        if (!files.length) return;

        // Validate files
        const validFiles = files.filter(file => this.validateFile(file));
        if (validFiles.length !== files.length) {
            this.showToast('Some files were rejected due to validation errors', 'warning');
        }

        if (!validFiles.length) return;

        // Upload files
        for (const file of validFiles) {
            await this.uploadFile(file);
        }
    }

    validateFile(file) {
        const maxSize = 10 * 1024 * 1024; // 10MB
        const allowedTypes = [
            'image/png', 'image/jpeg', 'image/gif',
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'text/plain', 'text/csv',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        ];

        if (file.size > maxSize) {
            this.showToast(`File ${file.name} is too large (max 10MB)`, 'error');
            return false;
        }

        if (!allowedTypes.includes(file.type)) {
            this.showToast(`File ${file.name} has an unsupported type`, 'error');
            return false;
        }

        return true;
    }

    async uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('metadata', JSON.stringify({
            uploadedAt: new Date().toISOString(),
            userAgent: navigator.userAgent
        }));

        try {
            this.showUploadProgress(file.name, 0);
            
            const response = await fetch(`${this.apiBaseUrl}/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: formData
            });

            const result = await response.json();
            
            if (result.success) {
                this.showUploadProgress(file.name, 100);
                this.showUploadResult(file.name, result, 'success');
                this.showToast(`File ${file.name} uploaded successfully`, 'success');
                
                // Refresh files list if on files tab
                if (this.currentTab === 'files') {
                    this.loadFiles();
                }
            } else {
                this.showUploadResult(file.name, result, 'error');
                this.showToast(`Upload failed: ${result.error}`, 'error');
            }
        } catch (error) {
            this.showUploadResult(file.name, { error: error.message }, 'error');
            this.showToast(`Upload failed: ${error.message}`, 'error');
            console.error('Upload error:', error);
        }
    }

    showUploadProgress(fileName, progress) {
        const progressContainer = document.getElementById('upload-progress');
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');

        if (progress === 0) {
            progressContainer.style.display = 'block';
        }

        progressFill.style.width = `${progress}%`;
        progressText.textContent = `${progress}%`;

        if (progress === 100) {
            setTimeout(() => {
                progressContainer.style.display = 'none';
            }, 2000);
        }
    }

    showUploadResult(fileName, result, type) {
        const resultsContainer = document.getElementById('upload-results');
        const resultDiv = document.createElement('div');
        resultDiv.className = `upload-result ${type}`;

        if (type === 'success') {
            resultDiv.innerHTML = `
                <div>
                    <strong>${fileName}</strong> uploaded successfully
                    <br><small>Size: ${this.formatFileSize(result.data.fileSize)}</small>
                </div>
                <button class="btn btn-sm btn-secondary" onclick="app.viewFile('${result.data.fileId}')">
                    View Details
                </button>
            `;
        } else {
            resultDiv.innerHTML = `
                <div>
                    <strong>${fileName}</strong> upload failed
                    <br><small>${result.error || result.details}</small>
                </div>
            `;
        }

        resultsContainer.appendChild(resultDiv);

        // Auto-remove after 10 seconds
        setTimeout(() => {
            if (resultDiv.parentNode) {
                resultDiv.parentNode.removeChild(resultDiv);
            }
        }, 10000);
    }

    // File Management Methods (updated for new auth)
    async loadFiles() {
        const status = document.getElementById('status-filter').value;
        const loading = document.getElementById('files-loading');
        const filesList = document.getElementById('files-list');

        try {
            loading.style.display = 'block';
            filesList.innerHTML = '';

            const response = await this.apiRequest(`/files?limit=${this.filesPerPage}&offset=${this.currentPage * this.filesPerPage}&status=${status}`);
            
            console.log('Files API Response:', response);
            
            if (response.success) {
                this.files = response.data;
                console.log('Files loaded:', this.files);
                this.renderFilesList();
                this.renderPagination(response.pagination);
            } else {
                console.error('Files API Error:', response);
                this.showToast('Failed to load files', 'error');
            }
        } catch (error) {
            this.showToast('Failed to load files', 'error');
            console.error('Load files error:', error);
        } finally {
            loading.style.display = 'none';
        }
    }

    renderFilesList() {
        const filesList = document.getElementById('files-list');
        
        console.log('Rendering files list. Files count:', this.files.length);
        console.log('Files data:', this.files);

        if (this.files.length === 0) {
            filesList.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">📁</div>
                    <h3>No files found</h3>
                    <p>Upload some files to get started</p>
                </div>
            `;
            return;
        }

        filesList.innerHTML = this.files.map(file => `
            <div class="file-item">
                <div class="file-icon">${this.getFileIcon(file.mimeType)}</div>
                <div class="file-info">
                    <div class="file-name">${this.escapeHtml(file.originalFilename)}</div>
                    <div class="file-meta">
                        ${this.formatFileSize(file.fileSize)} • 
                        ${this.formatDate(file.uploadTimestamp)} • 
                        Status: ${file.status} • 
                        Access: ${file.accessCount} times
                    </div>
                </div>
                <div class="file-actions">
                    <button class="btn btn-sm btn-primary" onclick="app.downloadFile('${file.id}')">
                        📥 Download
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="app.viewFile('${file.id}')">
                        👁️ View
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="app.deleteFile('${file.id}', '${this.escapeHtml(file.originalFilename)}')">
                        🗑️ Delete
                    </button>
                </div>
            </div>
        `).join('');
    }

    renderPagination(pagination) {
        const paginationContainer = document.getElementById('files-pagination');
        const totalPages = Math.ceil(pagination.total / this.filesPerPage);

        if (totalPages <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }

        let paginationHTML = '';

        // Previous button
        paginationHTML += `
            <button ${this.currentPage === 0 ? 'disabled' : ''} onclick="app.changePage(${this.currentPage - 1})">
                ← Previous
            </button>
        `;

        // Page numbers
        for (let i = 0; i < totalPages; i++) {
            paginationHTML += `
                <button class="${i === this.currentPage ? 'active' : ''}" onclick="app.changePage(${i})">
                    ${i + 1}
                </button>
            `;
        }

        // Next button
        paginationHTML += `
            <button ${this.currentPage >= totalPages - 1 ? 'disabled' : ''} onclick="app.changePage(${this.currentPage + 1})">
                Next →
            </button>
        `;

        paginationContainer.innerHTML = paginationHTML;
    }

    changePage(page) {
        this.currentPage = page;
        this.loadFiles();
    }

    async downloadFile(fileId) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/files/${fileId}`, {
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                }
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = response.headers.get('Content-Disposition')?.split('filename=')[1]?.replace(/"/g, '') || 'download';
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                
                this.showToast('File downloaded successfully', 'success');
            } else {
                const error = await response.json();
                this.showToast(`Download failed: ${error.error}`, 'error');
            }
        } catch (error) {
            this.showToast(`Download failed: ${error.message}`, 'error');
            console.error('Download error:', error);
        }
    }

    async viewFile(fileId) {
        try {
            const response = await this.apiRequest(`/files/${fileId}/metadata`);
            
            if (response.success) {
                this.showFileModal(response.data);
            } else {
                this.showToast(`Failed to load file details: ${response.error}`, 'error');
            }
        } catch (error) {
            this.showToast(`Failed to load file details: ${error.message}`, 'error');
            console.error('View file error:', error);
        }
    }

    showFileModal(fileData) {
        const modal = document.getElementById('file-modal');
        const details = document.getElementById('file-details');

        details.innerHTML = `
            <div style="display: grid; gap: 1rem;">
                <div><strong>Filename:</strong> ${this.escapeHtml(fileData.originalFilename)}</div>
                <div><strong>Size:</strong> ${this.formatFileSize(fileData.fileSize)}</div>
                <div><strong>Type:</strong> ${fileData.mimeType}</div>
                <div><strong>Uploaded:</strong> ${this.formatDate(fileData.uploadTimestamp)}</div>
                <div><strong>Last Accessed:</strong> ${fileData.lastAccessed ? this.formatDate(fileData.lastAccessed) : 'Never'}</div>
                <div><strong>Access Count:</strong> ${fileData.accessCount}</div>
                <div><strong>Status:</strong> ${fileData.status}</div>
                <div><strong>Virus Scan:</strong> ${fileData.virusScanStatus}</div>
                <div><strong>Checksum:</strong> <code>${fileData.checksum}</code></div>
            </div>
        `;

        // Update modal buttons
        document.getElementById('download-file').onclick = () => {
            this.downloadFile(fileData.id);
            this.closeModal();
        };

        document.getElementById('delete-file').onclick = () => {
            this.deleteFile(fileData.id, fileData.originalFilename);
            this.closeModal();
        };

        modal.classList.add('show');
    }

    closeModal() {
        document.getElementById('file-modal').classList.remove('show');
    }

    async deleteFile(fileId, fileName) {
        if (!confirm(`Are you sure you want to delete "${fileName}"? This action cannot be undone.`)) {
            return;
        }

        try {
            const response = await this.apiRequest(`/files/${fileId}`, {
                method: 'DELETE'
            });

            if (response.success) {
                this.showToast(`File "${fileName}" deleted successfully`, 'success');
                this.loadFiles();
            } else {
                this.showToast(`Delete failed: ${response.error}`, 'error');
            }
        } catch (error) {
            this.showToast(`Delete failed: ${error.message}`, 'error');
            console.error('Delete error:', error);
        }
    }

    // Statistics Methods
    async loadStats() {
        try {
            const response = await this.apiRequest('/stats');
            
            if (response.success) {
                this.renderStats(response.data);
            } else {
                this.showToast('Failed to load statistics', 'error');
            }
        } catch (error) {
            this.showToast('Failed to load statistics', 'error');
            console.error('Load stats error:', error);
        }
    }

    renderStats(stats) {
        document.getElementById('stat-total-files').textContent = stats.totalFiles || 0;
        document.getElementById('stat-active-files').textContent = stats.activeFiles || 0;
        document.getElementById('stat-storage-used').textContent = stats.storage?.totalSizeFormatted || '0 Bytes';
        
        const statusElement = document.getElementById('stat-system-status');
        statusElement.textContent = 'Healthy';
        statusElement.className = 'stat-status healthy';
    }

    // Admin Methods
    async loadUsers() {
        const status = document.getElementById('user-status-filter').value;
        const loading = document.getElementById('users-loading');
        const usersList = document.getElementById('users-list');

        try {
            loading.style.display = 'block';
            usersList.innerHTML = '';

            const response = await this.apiRequest(`/auth/admin/users?status=${status}&limit=${this.usersPerPage}&offset=${this.currentPage * this.usersPerPage}`);
            
            console.log('Users API Response:', response);
            console.log('Filter status:', status);
            
            if (response.success) {
                this.users = response.data;
                console.log('Users loaded:', this.users);
                this.renderUsersList();
                this.renderUsersPagination(response.pagination);
            } else {
                console.error('Users API Error:', response);
                this.showToast('Failed to load users', 'error');
            }
        } catch (error) {
            this.showToast('Failed to load users', 'error');
            console.error('Load users error:', error);
        } finally {
            loading.style.display = 'none';
        }
    }

    renderUsersList() {
        const usersList = document.getElementById('users-list');

        if (this.users.length === 0) {
            usersList.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                    <div style="font-size: 3rem; margin-bottom: 1rem;">👥</div>
                    <h3>No users found</h3>
                    <p>No users match the current filter</p>
                </div>
            `;
            return;
        }

        usersList.innerHTML = this.users.map(user => `
            <div class="user-item">
                <div class="user-avatar">${user.firstName.charAt(0).toUpperCase()}${user.lastName.charAt(0).toUpperCase()}</div>
                <div class="user-info">
                    <div class="user-name">${this.escapeHtml(user.firstName)} ${this.escapeHtml(user.lastName)}</div>
                    <div class="user-meta">
                        @${this.escapeHtml(user.username)} • ${this.escapeHtml(user.email)} • 
                        Joined: ${this.formatDate(user.createdAt)} • 
                        Last Login: ${user.lastLogin ? this.formatDate(user.lastLogin) : 'Never'}
                    </div>
                </div>
                <div class="user-status ${user.status}">${user.status}</div>
                <div class="user-actions">
                    ${user.status === 'pending' ? `
                        <button class="btn btn-sm btn-primary" onclick="app.approveUser('${this.escapeHtml(user.id)}')">
                            ✅ Approve
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="app.rejectUser('${this.escapeHtml(user.id)}')">
                            ❌ Reject
                        </button>
                    ` : ''}
                    ${user.status === 'active' ? `
                        <button class="btn btn-sm btn-danger" onclick="app.suspendUser('${this.escapeHtml(user.id)}')">
                            ⏸️ Suspend
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');
    }

    renderUsersPagination(pagination) {
        const paginationContainer = document.getElementById('users-pagination');
        const totalPages = Math.ceil(pagination.total / this.usersPerPage);

        if (totalPages <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }

        let paginationHTML = '';

        // Previous button
        paginationHTML += `
            <button ${this.currentPage === 0 ? 'disabled' : ''} onclick="app.changeUsersPage(${this.currentPage - 1})">
                ← Previous
            </button>
        `;

        // Page numbers
        for (let i = 0; i < totalPages; i++) {
            paginationHTML += `
                <button class="${i === this.currentPage ? 'active' : ''}" onclick="app.changeUsersPage(${i})">
                    ${i + 1}
                </button>
            `;
        }

        // Next button
        paginationHTML += `
            <button ${this.currentPage >= totalPages - 1 ? 'disabled' : ''} onclick="app.changeUsersPage(${this.currentPage + 1})">
                Next →
            </button>
        `;

        paginationContainer.innerHTML = paginationHTML;
    }

    changeUsersPage(page) {
        this.currentPage = page;
        this.loadUsers();
    }

    async approveUser(userId) {
        try {
            const response = await this.apiRequest(`/auth/admin/users/${userId}/approve`, {
                method: 'POST'
            });

            if (response.success) {
                this.showToast('User approved successfully', 'success');
                this.loadUsers();
                this.loadAdminStats();
            } else {
                this.showToast(`Failed to approve user: ${response.error}`, 'error');
            }
        } catch (error) {
            this.showToast(`Failed to approve user: ${error.message}`, 'error');
            console.error('Approve user error:', error);
        }
    }

    async rejectUser(userId) {
        const reason = prompt('Please provide a reason for rejection:');
        if (!reason) return;

        try {
            const response = await this.apiRequest(`/auth/admin/users/${userId}/reject`, {
                method: 'POST',
                body: JSON.stringify({ reason })
            });

            if (response.success) {
                this.showToast('User rejected successfully', 'success');
                this.loadUsers();
                this.loadAdminStats();
            } else {
                this.showToast(`Failed to reject user: ${response.error}`, 'error');
            }
        } catch (error) {
            this.showToast(`Failed to reject user: ${error.message}`, 'error');
            console.error('Reject user error:', error);
        }
    }

    async suspendUser(userId) {
        const reason = prompt('Please provide a reason for suspension:');
        if (!reason) return;

        try {
            const response = await this.apiRequest(`/auth/admin/users/${userId}/suspend`, {
                method: 'POST',
                body: JSON.stringify({ reason })
            });

            if (response.success) {
                this.showToast('User suspended successfully', 'success');
                this.loadUsers();
                this.loadAdminStats();
            } else {
                this.showToast(`Failed to suspend user: ${response.error}`, 'error');
            }
        } catch (error) {
            this.showToast(`Failed to suspend user: ${error.message}`, 'error');
            console.error('Suspend user error:', error);
        }
    }

    async loadAdminStats() {
        try {
            const response = await this.apiRequest('/auth/admin/stats');
            
            if (response.success) {
                this.renderAdminStats(response.data);
            } else {
                this.showToast('Failed to load admin statistics', 'error');
            }
        } catch (error) {
            this.showToast('Failed to load admin statistics', 'error');
            console.error('Load admin stats error:', error);
        }
    }

    renderAdminStats(stats) {
        document.getElementById('admin-stat-total-users').textContent = stats.total || 0;
        document.getElementById('admin-stat-active-users').textContent = stats.active || 0;
        document.getElementById('admin-stat-pending-users').textContent = stats.pending || 0;
        document.getElementById('admin-stat-admin-users').textContent = stats.admins || 0;
    }

    // Utility Methods
    async apiRequest(endpoint, options = {}) {
        const url = `${this.apiBaseUrl}${endpoint}`;
        const defaultOptions = {
            headers: {
                'Authorization': `Bearer ${this.authToken}`,
                'Content-Type': 'application/json'
            }
        };

        const response = await fetch(url, { ...defaultOptions, ...options });
        
        if (response.status === 401) {
            this.clearAuth();
            this.showAuth();
            throw new Error('Authentication required');
        }
        
        return await response.json();
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;

        container.appendChild(toast);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 5000);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleString();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getFileIcon(mimeType) {
        const icons = {
            'image/png': '🖼️',
            'image/jpeg': '🖼️',
            'image/gif': '🖼️',
            'application/pdf': '📄',
            'application/msword': '📝',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
            'text/plain': '📄',
            'text/csv': '📊',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📊'
        };
        return icons[mimeType] || '📁';
    }

    setupFileIcons() {
        // This method can be extended to add more file type icons
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new SecureFileUploadApp();
});

// Security: Prevent right-click context menu in production
if (window.location.hostname !== 'localhost') {
    document.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });
}

// Security: Prevent F12 and other dev tools shortcuts
document.addEventListener('keydown', (e) => {
    if (window.location.hostname !== 'localhost') {
        if (e.key === 'F12' || 
            (e.ctrlKey && e.shiftKey && e.key === 'I') ||
            (e.ctrlKey && e.shiftKey && e.key === 'C') ||
            (e.ctrlKey && e.shiftKey && e.key === 'J') ||
            (e.ctrlKey && e.key === 'U')) {
            e.preventDefault();
        }
    }
});