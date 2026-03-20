// Service Worker Registration
// This registers the service worker for offline functionality

export function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker
                .register('/service-worker.js')
                .then((registration) => {
                    console.log('✅ Service Worker registered:', registration.scope);

                    // Check for updates periodically
                    setInterval(() => {
                        registration.update();
                    }, 60000); // Check every minute

                    // Handle service worker updates
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;

                        if (newWorker) {
                            newWorker.addEventListener('statechange', () => {
                                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                    // New service worker available
                                    showUpdateNotification();
                                }
                            });
                        }
                    });
                })
                .catch((error) => {
                    console.error('❌ Service Worker registration failed:', error);
                });
        });
    }
}

// Show update notification when new version is available
function showUpdateNotification() {
    const updateBanner = document.createElement('div');
    updateBanner.id = 'sw-update-banner';
    updateBanner.innerHTML = `
    <div style="position: fixed; top: 20px; left: 50%; transform: translateX(-50%); 
                background: #0d2818; color: white; padding: 16px 24px; 
                border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); 
                z-index: 9999; display: flex; align-items: center; gap: 16px;
                max-width: 90%; animation: slideDown 0.3s ease-out;">
      <span>New version available!</span>
      <button id="sw-update-btn" style="background: #22c55e; color: #0d2818; 
              border: none; padding: 8px 16px; border-radius: 8px; 
              font-weight: 600; cursor: pointer;">
        Update Now
      </button>
      <button id="sw-dismiss-btn" style="background: transparent; color: white; 
              border: 1px solid white; padding: 8px 16px; border-radius: 8px; 
              cursor: pointer;">
        Later
      </button>
    </div>
    <style>
      @keyframes slideDown {
        from { transform: translate(-50%, -100%); opacity: 0; }
        to { transform: translate(-50%, 0%); opacity: 1; }
      }
    </style>
  `;

    document.body.appendChild(updateBanner);

    document.getElementById('sw-update-btn')?.addEventListener('click', () => {
        window.location.reload();
    });

    document.getElementById('sw-dismiss-btn')?.addEventListener('click', () => {
        updateBanner.remove();
    });
}

// Unregister service worker (useful for development)
export function unregisterServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready
            .then((registration) => {
                registration.unregister();
                console.log('Service Worker unregistered');
            })
            .catch((error) => {
                console.error('Service Worker unregistration failed:', error);
            });
    }
}
