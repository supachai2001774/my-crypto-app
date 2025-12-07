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

        // Listen to BroadcastChannel
        if ('BroadcastChannel' in window) {
            const bc = new BroadcastChannel('live_sync');
            bc.onmessage = (event) => {
                if(event.data && event.data.event) {
                    console.log('📡 Broadcast received:', event.data.event);
                    this.emit(event.data.event, event.data.data);
                }
            };
        }
        
        console.log('✅ LiveSync initialized');
    }

    /**
     * Broadcast event to all tabs
     */
    broadcast(event, data) {
        if ('BroadcastChannel' in window) {
            const bc = new BroadcastChannel('live_sync');
            bc.postMessage({ event: event, data: data });
        }
        // Also emit locally
        this.emit(event, data);
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

        // Check Maintenance Msg
        this.checkUpdate('mining_maintenance_msg', 'maintenance_msg');
        
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
            
            if (!this.lastUpdate[key]) {
                this.lastUpdate[key] = hash;
                return;
            }
            
            if (this.lastUpdate[key] !== hash) {
                console.log('📡 Update detected:', key);
                this.lastUpdate[key] = hash;
                
                let data;
                try { 
                    data = JSON.parse(current || '{}'); 
                } catch(e) { 
                    data = current; 
                }
                
                this.emit(eventName, data);
                this.broadcastUpdate(eventName, current);

                // Extra events for backward compatibility
                if (eventName === 'announcement') {
                    if (data && data.msg) {
                        this.emit('announcement_posted', data);
                    } else {
                        this.emit('announcement_cleared', {});
                    }
                }
                else if (eventName === 'maintenance') {
                    this.emit('maintenance_mode_changed', data);
                }
                else if (eventName === 'maintenance_msg') {
                    this.emit('maintenance_msg_changed', data);
                }
                else if (eventName === 'shop') {
                    this.emit('shop_items_updated', data);
                    this.emit('shop_updated', data);
                }
            }
        } catch (e) {
            console.error('Error checking update:', key, e);
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
                        refs: JSON.parse(current || '[]') 
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

    // --- Helper Methods (Migrated from SyncManager) ---

    isUserBanned(username) {
        try {
            const users = JSON.parse(localStorage.getItem('mining_users') || '{}');
            return users[username] && users[username].banned === true;
        } catch (err) { return false; }
    }

    verifyUserData(username) {
        try {
            const raw = JSON.parse(localStorage.getItem('mining_users') || '{}');
            const profile = JSON.parse(localStorage.getItem(`pf_${username}`) || '{}');
            if (raw[username] && profile.username !== username) {
                profile.username = username;
                localStorage.setItem(`pf_${username}`, JSON.stringify(profile));
            }
            return { user: raw[username] || {}, profile: profile || {}, isValid: !!raw[username] };
        } catch (err) { 
            console.error('Error verifying user data:', err); 
            return { user: {}, profile: {}, isValid: false }; 
        }
    }

    cleanOldData(maxAgeMs = 30 * 24 * 60 * 60 * 1000) {
        try {
            const trans = JSON.parse(localStorage.getItem('mining_transactions') || '[]');
            const now = Date.now();
            const filtered = trans.filter(t => (now - (t.timestamp || 0)) < maxAgeMs);
            if (filtered.length < trans.length) {
                localStorage.setItem('mining_transactions', JSON.stringify(filtered));
                return trans.length - filtered.length;
            }
        } catch (err) { console.error('Error cleaning old data:', err); }
        return 0;
    }

    getMaintenanceStatus() {
        const isMaint = localStorage.getItem('mining_maintenance') === 'true';
        const msg = localStorage.getItem('mining_maintenance_msg') || '';
        return { enabled: isMaint, message: msg };
    }

    getCurrentAnnouncement() {
        try {
            const raw = localStorage.getItem('mining_announcement');
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (err) { return null; }
    }
    
    debugInfo() {
        return {
             stats: this.getStatus(),
             maintenance: this.getMaintenanceStatus(),
             announcement: this.getCurrentAnnouncement()
        };
    }
}

// Global instance
const liveSync = new LiveSync();
console.log('✅ LiveSync ready');