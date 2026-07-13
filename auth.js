import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// TODO: Replace the following with your app's Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyDsC9BkkaWdewLDUtqj8896-pRBTukdRUc",
  authDomain: "optibeat-ad7a8.firebaseapp.com",
  projectId: "optibeat-ad7a8",
  storageBucket: "optibeat-ad7a8.firebasestorage.app",
  messagingSenderId: "758468844863",
  appId: "1:758468844863:web:658adf7af5cbd3298a878a"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

document.addEventListener('DOMContentLoaded', () => {
    const authOverlay = document.getElementById('auth-overlay');
    const mainApp = document.getElementById('main-app-content');
    
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

    // Firebase Auth State Listener
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // User is signed in
            if (mainApp) mainApp.style.display = 'block';
            if (authOverlay) authOverlay.style.display = 'none';
            
            const userDisplay = document.getElementById('current-username-display');
            if (userDisplay) userDisplay.textContent = user.email.split('@')[0]; // Simple display name fallback
        } else {
            // User is signed out
            if (mainApp) mainApp.style.display = 'none';
            if (authOverlay) authOverlay.style.display = 'flex';
            window.showLogin();
        }
    });

    // Login Logic
    window.handleLogin = async function(event) {
        event.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const pass = document.getElementById('login-password').value;
        const errEl = document.getElementById('login-error');
        
        try {
            errEl.textContent = 'Logging in...';
            await signInWithEmailAndPassword(auth, email, pass);
            errEl.textContent = '';
        } catch (error) {
            console.error("Login Error:", error);
            errEl.textContent = 'Invalid email or password.';
        }
    };

    // Signup Logic
    window.handleSignup = async function(event) {
        event.preventDefault();
        const email = document.getElementById('signup-email').value.trim();
        const pass = document.getElementById('signup-password').value;
        const errEl = document.getElementById('signup-error');
        
        if (!email || !pass) {
            errEl.textContent = 'Please fill out all fields.';
            return;
        }

        try {
            errEl.textContent = 'Creating account...';
            await createUserWithEmailAndPassword(auth, email, pass);
            errEl.textContent = '';
        } catch (error) {
            console.error("Signup Error:", error);
            if (error.code === 'auth/email-already-in-use') {
                errEl.textContent = 'Email is already taken.';
            } else if (error.code === 'auth/weak-password') {
                errEl.textContent = 'Password should be at least 6 characters.';
            } else {
                errEl.textContent = 'Failed to create account. ' + error.message;
            }
        }
    };
    
    // Logout Logic
    window.handleLogout = async function() {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Logout Error:", error);
        }
    };
});
