// PWA Update Handler
class PWAUpdateHandler {
    constructor() {
        this.swRegistration = null;
        this.waitingWorker = null;
        this.isUpdateAvailable = false;
        
        this.init();
    }

    async init() {
        if ('serviceWorker' in navigator) {
            try {
                // Register service worker
                this.swRegistration = await navigator.serviceWorker.register('/service-worker.js');
                console.log('Service Worker registered');

                // Check for updates on page load
                this.checkForUpdates();

                // Listen for waiting service worker
                this.swRegistration.addEventListener('updatefound', () => {
                    const newWorker = this.swRegistration.installing;
                    
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && this.swRegistration.active) {
                            // New version installed, waiting to activate
                            this.waitingWorker = newWorker;
                            this.isUpdateAvailable = true;
                            this.showUpdateNotification();
                        }
                    });
                });

                // Listen for messages from service worker
                navigator.serviceWorker.addEventListener('message', (event) => {
                    if (event.data && event.data.type === 'SW_ACTIVATED') {
                        console.log('New service worker activated:', event.data.version);
                        // Reload to ensure everything is fresh
                        if (this.isUpdateAvailable) {
                            window.location.reload();
                        }
                    }
                });

                // Periodic update checks (every 30 seconds in development)
                if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                    setInterval(() => this.checkForUpdates(), 30000);
                } else {
                    // Every 5 minutes in production
                    setInterval(() => this.checkForUpdates(), 300000);
                }

            } catch (error) {
                console.error('Service Worker registration failed:', error);
            }
        }
    }

    checkForUpdates() {
        if (this.swRegistration) {
            this.swRegistration.update().then(() => {
                console.log('Checked for service worker updates');
            }).catch(error => {
                console.error('Update check failed:', error);
            });
        }
    }

    showUpdateNotification() {
        // Create update notification if it doesn't exist
        if (!document.getElementById('update-notification')) {
            const notification = document.createElement('div');
            notification.id = 'update-notification';
            notification.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: #1a4d47;
                color: white;
                padding: 15px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 9999;
                display: flex;
                align-items: center;
                gap: 15px;
                animation: slideIn 0.3s ease;
            `;

            notification.innerHTML = `
                <div>
                    <strong>Update Available!</strong>
                    <p style="margin: 5px 0 0; font-size: 14px;">A new version is ready</p>
                </div>
                <div style="display: flex; gap: 10px;">
                    <button onclick="pwaHandler.applyUpdate()" 
                            style="background: white; color: #1a4d47; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight: bold;">
                        Update Now
                    </button>
                    <button onclick="pwaHandler.dismissNotification()" 
                            style="background: transparent; color: white; border: 1px solid white; padding: 8px 16px; border-radius: 4px; cursor: pointer;">
                        Later
                    </button>
                </div>
            `;

            // Add animation styles
            const style = document.createElement('style');
            style.textContent = `
                @keyframes slideIn {
                    from {
                        transform: translateX(100%);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
            `;
            document.head.appendChild(style);
            
            document.body.appendChild(notification);
        }
    }

    applyUpdate() {
        if (this.waitingWorker) {
            // Send message to service worker to skip waiting
            this.waitingWorker.postMessage({ type: 'SKIP_WAITING' });
            
            // Hide notification
            this.dismissNotification();
            
            // Show loading indicator
            this.showLoadingIndicator();
        }
    }

    dismissNotification() {
        const notification = document.getElementById('update-notification');
        if (notification) {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }
    }

    showLoadingIndicator() {
        const loader = document.createElement('div');
        loader.id = 'update-loader';
        loader.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 3px;
            background: linear-gradient(90deg, #1a4d47, #3498db, #1a4d47);
            background-size: 200% 100%;
            animation: loading 1s linear infinite;
            z-index: 10000;
        `;

        const style = document.createElement('style');
        style.textContent = `
            @keyframes loading {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
            }
            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(loader);
    }
}

// Initialize PWA handler
const pwaHandler = new PWAUpdateHandler();