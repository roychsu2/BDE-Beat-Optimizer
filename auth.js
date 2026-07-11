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

    // Login Logic
    window.handleLogin = function(event) {
        event.preventDefault();
        const username = document.getElementById('login-username').value.trim();
        const pass = document.getElementById('login-password').value;
        const errEl = document.getElementById('login-error');
        
        const users = getUsers();
        const user = users.find(u => (u.username === username || u.mobile === username) && u.password === pass);
        
        if (user) {
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
        
        // Validation: uniqueness
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
