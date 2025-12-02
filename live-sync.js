/**
 * ============================================
 * LIVE SYNC - Real-time Updates between Admin & Mobile App
 * ใช้ Polling + LocalStorage Events
 * ============================================
 */

class LiveSync {
    constructor() {
        this.pollInterval = 1000; // 1 second
        this.isPolling = false;
        this.lastUpdate = {};
        this.callbacks = {};
        this.init();
    }

    init() {
        // Start polling
        this.startPolling();
        
        // Listen to storage changes
        window.addEventListener('storage', (e) => this.handleStorageChange(e));
        
        console.log('✅ LiveSync initialized');
    }

    /**
     * Start polling for updates
     */
    startPolling() {
        if (this.isPolling) return;
        
        this.isPolling = true;
        this.pollingInterval = setInterval(() => {
            this.checkForUpdates();
        }, this.pollInterval);
        
        console.log('🔄 Live polling started (every ' + this.pollInterval + 'ms)');
    }

    /**
     * Stop polling
     */
    stopPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.isPolling = false;
            console.log('⏸ Live polling stopped');
        }
    }

    /**
     * Check for all updates
     */
    checkForUpdates() {
        // Check Users
        this.checkUpdate('mining_users', 'users');
        
        // Check Transactions
        this.checkUpdate('mining_transactions', 'transactions');
        
        // Check Shop
        this.checkUpdate('mining_shop_items', 'shop');
        
        // Check Maintenance
        this.checkUpdate('mining_maintenance', 'maintenance');
        
        // Check Announcement
        this.checkUpdate('mining_announcement', 'announcement');
        
        // Check Referrals (all users)
        this.checkReferralsUpdate();
        
        // Check User Profiles (all users)
        this.checkProfilesUpdate();
    }

    /**
     * Check single key update
     */
    checkUpdate(key, eventName) {
        try {
            const current = localStorage.getItem(key);
            const hash = this.hashString(current || '');
            
            if (! this.lastUpdate[key]) {
                this.lastUpdate[key] = hash;
                return;
            }
            
            if (this.lastUpdate[key] !== hash) {
                console.log('📡 Update detected:', key);
                this.lastUpdate[key] = hash;
                this.emit(eventName, JSON.parse(current || '{}'));
                this.broadcastUpdate(eventName, current);
            }
        } catch (e) {
            console. error('Error checking update:', key, e);
        }
    }

    /**
     * Check referrals for all users
     */
    checkReferralsUpdate() {
        try {
            const users = JSON.parse(localStorage.getItem('mining_users') || '{}');
            Object.keys(users).forEach(username => {
                const key = `mining_referrals_${username}`;
                const current = localStorage.getItem(key);
                const hash = this.hashString(current || '');
                
                if (!this.lastUpdate[key]) {
                    this.lastUpdate[key] = hash;
                    return;
                }
                
                if (this.lastUpdate[key] !== hash) {
                    console.log('📡 Referral update:', username);
                    this.lastUpdate[key] = hash;
                    this.emit('referrals_updated', { 
                        username, 
                        data: JSON.parse(current || '[]') 
                    });
                }
            });
        } catch (e) {
            console.error('Error checking referrals:', e);
        }
    }

    /**
     * Check profiles for all users
     */
    checkProfilesUpdate() {
        try {
            const users = JSON.parse(localStorage.getItem('mining_users') || '{}');
            Object.keys(users). forEach(username => {
                const key = `pf_${username}`;
                const current = localStorage.getItem(key);
                const hash = this. hashString(current || '');
                
                if (!this.lastUpdate[key]) {
                    this.lastUpdate[key] = hash;
                    return;
                }
                
                if (this.lastUpdate[key] !== hash) {
                    console. log('📡 Profile update:', username);
                    this.lastUpdate[key] = hash;
                    this.emit('profile_updated', { 
                        username, 
                        data: JSON.parse(current || '{}') 
                    });
                }
            });
        } catch (e) {
            console. error('Error checking profiles:', e);
        }
    }

    /**
     * Handle storage change events
     */
    handleStorageChange(event) {
        if (event. key) {
            console.log('🔔 Storage changed (from another tab):', event.key);
            this.checkUpdate(event.key, event.key. replace(/[_0-9]/g, ''));
        }
    }

    /**
     * Register event listener
     */
    on(event, callback) {
        if (!this.callbacks[event]) {
            this.callbacks[event] = [];
        }
        this.callbacks[event].push(callback);
        return () => {
            this.callbacks[event] = this. callbacks[event].filter(cb => cb !== callback);
        };
    }

    /**
     * Emit event
     */
    emit(event, data) {
        if (this.callbacks[event]) {
            this.callbacks[event]. forEach(callback => {
                try {
                    callback(data);
                } catch (e) {
                    console.error('Error in callback:', e);
                }
            });
        }
    }

    /**
     * Broadcast update via SharedWorker or ServiceWorker (if available)
     */
    broadcastUpdate(eventName, data) {
        if ('BroadcastChannel' in window) {
            try {
                const bc = new BroadcastChannel('live_sync');
                bc.postMessage({ event: eventName, data });
            } catch (e) {
                // Silently fail if BroadcastChannel not available
            }
        }
    }

    /**
     * Simple hash function for change detection
     */
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash. toString(36);
    }

    /**
     * Get current data
     */
    getData(key) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Force refresh
     */
    forceRefresh() {
        console.log('🔄 Force refresh triggered');
        this.lastUpdate = {};
        this.checkForUpdates();
    }

    /**
     * Get sync status
     */
    getStatus() {
        return {
            isPolling: this.isPolling,
            pollInterval: this.pollInterval,
            lastChecked: new Date().toISOString(),
            watchedKeys: Object.keys(this.lastUpdate).length
        };
    }
}

// Global instance
const liveSync = new LiveSync();
console.log('✅ LiveSync ready');