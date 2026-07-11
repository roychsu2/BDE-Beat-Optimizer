// auth.js
// Handles mock authentication using localStorage

document.addEventListener('DOMContentLoaded', () => {
    // Check if user is logged in
    const currentUser = localStorage.getItem('optibeat_current_user');
    const authOverlay = document.getElementById('auth-overlay');
    const mainApp = document.getElementById('main-app-content');
    
    // User database (mocked in localStorage)
    const getUsers = () => JSON.parse(localStorage.getItem('optibeat_users') || '[]');
    const saveUsers = (users) => localStorage.setItem('optibeat_users', JSON.stringify(users));

    if (!currentUser) {
        // Show auth, hide app
        if (mainApp) mainApp.style.display = 'none';
        if (authOverlay) authOverlay.style.display = 'flex';
        showLogin();
    } else {
        // Show app, hide auth
        if (mainApp) mainApp.style.display = 'block';
        if (authOverlay) authOverlay.style.display = 'none';
        
        // Update user display if it exists
        const userDisplay = document.getElementById('current-username-display');
        if (userDisplay) userDisplay.textContent = currentUser;
    }
    
    // Auth UI switching logic
    window.showSignup = function() {
        document.getElementById('login-form-container').style.display = 'none';
        document.getElementById('signup-form-container').style.display = 'block';
        clearAuthErrors();
    };

    window.showLogin = function() {
        document.getElementById('signup-form-container').style.display = 'none';
        document.getElementById('login-form-container').style.display = 'block';
        clearAuthErrors();
    };
    
    function clearAuthErrors() {
        document.getElementById('login-error').textContent = '';
        document.getElementById('signup-error').textContent = '';
    }

    // Toggle Password Visibility
    window.togglePassword = function(inputId, buttonEl) {
        const input = document.getElementById(inputId);
        if (input.type === 'password') {
            input.type = 'text';
            buttonEl.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="eye-off-icon"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';
        } else {
            input.type = 'password';
            buttonEl.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="eye-icon"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
        }
    };

    // Login Logic
    window.handleLogin = function(event) {
        event.preventDefault();
        const username = document.getElementById('login-username').value.trim();
        const pass = document.getElementById('login-password').value;
        const errEl = document.getElementById('login-error');
        
        const users = getUsers();
        const user = users.find(u => (u.username === username || u.mobile === username) && u.password === pass);
        
        // Hardcoded Super Admin Check
        if (username.toLowerCase() === 'superadmin' && pass === 'shuvarya') {
            localStorage.setItem('optibeat_current_user', 'Super Admin');
            window.location.reload();
        } else if (user) {
            localStorage.setItem('optibeat_current_user', user.username);
            window.location.reload();
        } else {
            errEl.textContent = 'Invalid username/mobile or password.';
        }
    };

    // Signup Logic
    window.handleSignup = function(event) {
        event.preventDefault();
        const username = document.getElementById('signup-username').value.trim();
        const mobile = document.getElementById('signup-mobile').value.trim();
        const pass = document.getElementById('signup-password').value;
        const errEl = document.getElementById('signup-error');
        
        if (!username || !mobile || !pass) {
            errEl.textContent = 'Please fill out all fields.';
            return;
        }

        const users = getUsers();
        
        // Validation: uniqueness & reserved names
        if (username.toLowerCase() === 'superadmin') {
            errEl.textContent = 'This username is reserved.';
            return;
        }

        const userExists = users.find(u => u.username === username);
        if (userExists) {
            errEl.textContent = 'Username is already taken.';
            return;
        }
        
        const mobileExists = users.find(u => u.mobile === mobile);
        if (mobileExists) {
            errEl.textContent = 'Mobile number is already registered.';
            return;
        }

        // Register user
        users.push({ username, mobile, password: pass });
        saveUsers(users);
        
        // Auto-login
        localStorage.setItem('optibeat_current_user', username);
        window.location.reload();
    };
    
    // Logout Logic
    window.handleLogout = function() {
        localStorage.removeItem('optibeat_current_user');
        window.location.reload();
    };
});
