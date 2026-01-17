// PWA Install Prompt Handler
let deferredPrompt;
let installButton = null;

// Create install button if it doesn't exist
function createInstallButton() {
    // Check if button already exists
    if (document.getElementById('pwa-install-button')) {
        return;
    }

    // Create install button
    const installBtn = document.createElement('button');
    installBtn.id = 'pwa-install-button';
    installBtn.className = 'btn btn-primary position-fixed';
    installBtn.style.cssText = 'bottom: 20px; right: 20px; z-index: 1050; box-shadow: 0 4px 12px rgba(0,0,0,0.3); border-radius: 50px; padding: 12px 24px; display: none;';
    installBtn.innerHTML = '<i class="fas fa-download me-2"></i>Install App';
    installBtn.setAttribute('aria-label', 'Install Kitui Housing App');
    
    // Add click handler
    installBtn.addEventListener('click', async () => {
        if (deferredPrompt) {
            // Show the install prompt
            deferredPrompt.prompt();
            
            // Wait for the user to respond to the prompt
            const { outcome } = await deferredPrompt.userChoice;
            
            console.log(`User response to install prompt: ${outcome}`);
            
            // Clear the deferredPrompt
            deferredPrompt = null;
            
            // Hide the install button
            installBtn.style.display = 'none';
        }
    });
    
    // Add to body
    document.body.appendChild(installBtn);
    installButton = installBtn;
}

// Listen for the beforeinstallprompt event
window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    
    // Stash the event so it can be triggered later
    deferredPrompt = e;
    
    // Show install button
    createInstallButton();
    if (installButton) {
        installButton.style.display = 'block';
        
        // Add animation
        installButton.style.animation = 'slideInUp 0.3s ease-out';
    }
    
    console.log('PWA install prompt available');
});

// Listen for app installed event
window.addEventListener('appinstalled', () => {
    console.log('PWA was installed');
    
    // Hide install button
    if (installButton) {
        installButton.style.display = 'none';
    }
    
    // Show success message
    if (typeof flash !== 'undefined') {
        // If using Flask flash messages
        showNotification('App installed successfully!', 'success');
    } else {
        // Fallback notification
        alert('App installed successfully! You can now access it from your home screen.');
    }
    
    deferredPrompt = null;
});

// Check if app is already installed (standalone mode)
function isPWAInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true ||
           document.referrer.includes('android-app://');
}

// Hide install button if already installed
if (isPWAInstalled()) {
    console.log('PWA is already installed');
    if (installButton) {
        installButton.style.display = 'none';
    }
}

// Register service worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then((registration) => {
                console.log('Service Worker registered successfully:', registration.scope);
                
                // Check for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // New service worker available
                            showNotification('New version available! Refresh to update.', 'info');
                        }
                    });
                });
            })
            .catch((error) => {
                console.error('Service Worker registration failed:', error);
            });
    });
}

// Helper function to show notifications
function showNotification(message, type = 'info') {
    // Try to use Bootstrap alerts if available
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type === 'success' ? 'success' : 'info'} alert-dismissible fade show position-fixed`;
    alertDiv.style.cssText = 'top: 80px; right: 20px; z-index: 1060; min-width: 300px; max-width: 500px;';
    alertDiv.setAttribute('role', 'alert');
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    document.body.appendChild(alertDiv);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

// Add CSS animation for install button
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInUp {
        from {
            transform: translateY(100px);
            opacity: 0;
        }
        to {
            transform: translateY(0);
            opacity: 1;
        }
    }
    
    #pwa-install-button {
        animation: slideInUp 0.3s ease-out;
    }
    
    @media (max-width: 768px) {
        #pwa-install-button {
            bottom: 15px;
            right: 15px;
            padding: 10px 20px;
            font-size: 0.9rem;
        }
    }
`;
document.head.appendChild(style);
