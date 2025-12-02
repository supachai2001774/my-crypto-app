/**
 * ============================================
 * SYNC MANAGER - Real-time Data Synchronization
 * ใช้ Storage Events เพื่อซิงค์ข้อมูลระหว่าง Admin และ User App
 * ============================================
 */

class SyncManager {
    constructor() {
        this.listeners = {};
        this.initListeners();
        this.lastSync = Date.now();
    }

    // Initialize Storage Event Listeners
    initListeners() {
        // Listen for localStorage changes from other tabs/windows
        window.addEventListener('storage', (e) => {
            this.handleStorageChange(e);
        });

        // Broadcast Channel API สำหรับแท็บเดียวกัน
        if ('BroadcastChannel' in window) {
            try {
                this.bc = new BroadcastChannel('miner_sync_channel');
                this.bc. onmessage = (e) => this.handleBroadcastMessage(e. data);
            } catch (err) {
                console.log('BroadcastChannel not supported:', err);
            }
        }

        // Local event emitter for same-page changes
        document.addEventListener('minersync', (e) => {
            this.notifyChange(e. detail. type, e.detail.payload);
        });
    }

    /**
     * Handle localStorage changes (from other tabs/windows)
     */
    handleStorageChange(event) {
        const key = event.key;
        const newValue = event.newValue;
        const oldValue = event.oldValue;

        console.log('📡 Storage Changed:', key, newValue);

        // Users Management
        if (key === 'mining_users') {
            try {
                const users = JSON.parse(newValue || '{}');
                this.notifyChange('users_updated', users);
                this.notifyChange('admin_action', { 
                    action: 'users_modified', 
                    timestamp: Date.now() 
                });
            } catch (e) {
                console.error('Error parsing mining_users:', e);
            }
        }
        
        // Transactions
        else if (key === 'mining_transactions') {
            try {
                const trans = JSON.parse(newValue || '[]');
                this.notifyChange('transactions_updated', trans);
            } catch (e) {
                console.error('Error parsing mining_transactions:', e);
            }
        }
        
        // Maintenance Mode
        else if (key === 'mining_maintenance') {
            const isMaint = newValue === 'true';
            this.notifyChange('maintenance_changed', isMaint);
            this.notifyChange('admin_action', { 
                action: 'maintenance_toggled', 
                value: isMaint,
                timestamp: Date.now() 
            });
        }
        
        // Announcement
        else if (key === 'mining_announcement') {
            try {
                const ann = JSON.parse(newValue || '{}');
                this.notifyChange('announcement_changed', ann);
            } catch (e) {
                console.error('Error parsing announcement:', e);
            }
        }

        // Maintenance Message
        else if (key === 'mining_maintenance_msg') {
            this.notifyChange('maintenance_msg_changed', newValue);
        }
        
        // User Rigs
        else if (key. startsWith('mining_rigs_')) {
            try {
                const username = key.replace('mining_rigs_', '');
                const rigs = JSON.parse(newValue || '[]');
                this.notifyChange('rigs_updated', { username, rigs });
            } catch (e) {
                console. error('Error parsing rigs:', e);
            }
        }
        
        // User Profile
        else if (key.startsWith('pf_')) {
            try {
                const username = key.replace('pf_', '');
                const profile = JSON.parse(newValue || '{}');
                this.notifyChange('profile_updated', { username, profile });
            } catch (e) {
                console.error('Error parsing profile:', e);
            }
        }
        
        // Shop Items
        else if (key === 'mining_shop_items' || key === 'shop_last_update') {
            try {
                if (key === 'mining_shop_items') {
                    const items = JSON.parse(newValue || '[]');
                    this.notifyChange('shop_items_updated', items);
                }
                this.notifyChange('shop_updated', {
                    timestamp: Date.now(),
                    key: key
                });
            } catch (e) {
                console.error('Error parsing shop:', e);
            }
        }
        
        // Referrals
        else if (key. startsWith('mining_referrals_')) {
            try {
                const username = key.replace('mining_referrals_', '');
                const refs = JSON.parse(newValue || '[]');
                this. notifyChange('referrals_updated', { username, refs });
            } catch (e) {
                console.error('Error parsing referrals:', e);
            }
        }
        
        // Notifications
        else if (key. startsWith('notifications_')) {
            try {
                const username = key.replace('notifications_', '');
                const notifs = JSON.parse(newValue || '[]');
                this.notifyChange('notifications_updated', { username, notifs });
            } catch (e) {
                console.error('Error parsing notifications:', e);
            }
        }
    }

    /**
     * Handle Broadcast Channel messages
     */
    handleBroadcastMessage(data) {
        console.log('📡 Broadcast Message:', data. type);
        this.notifyChange(data.type, data.payload);
    }

    /**
     * Register change listeners
     */
    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
        return () => {
            this.listeners[event] = this. listeners[event].filter(cb => cb !== callback);
        };
    }

    /**
     * One-time listener
     */
    once(event, callback) {
        const unsubscribe = this.on(event, (data) => {
            callback(data);
            unsubscribe();
        });
    }

    /**
     * Notify all listeners
     */
    notifyChange(event, data) {
        console.log('🔔 Notify Event:', event, data);
        if (this.listeners[event]) {
            this.listeners[event]. forEach(callback => {
                try {
                    callback(data);
                } catch (err) {
                    console. error(`Error in listener for ${event}:`, err);
                }
            });
        }
    }

    /**
     * Broadcast message to all tabs/windows
     */
    broadcast(type, payload) {
        try {
            if (this.bc) {
                this.bc. postMessage({ type, payload, timestamp: Date.now() });
            }
        } catch (err) {
            console.error('Broadcast error:', err);
        }
    }

    /**
     * Emit local event (same page/tab)
     */
    emitLocal(type, payload) {
        const event = new CustomEvent('minersync', {
            detail: { type, payload, timestamp: Date.now() }
        });
        document.dispatchEvent(event);
    }

    /**
     * Verify User Data Integrity
     */
    verifyUserData(username) {
        try {
            const raw = JSON.parse(localStorage.getItem('mining_users') || '{}');
            const profile = JSON.parse(localStorage.getItem(`pf_${username}`) || '{}');
            
            // Check for consistency
            if (raw[username] && profile. username !== username) {
                profile.username = username;
                localStorage.setItem(`pf_${username}`, JSON.stringify(profile));
            }
            
            return { 
                user: raw[username] || {}, 
                profile: profile || {},
                isValid: !!raw[username]
            };
        } catch (err) {
            console.error('Error verifying user data:', err);
            return { user: {}, profile: {}, isValid: false };
        }
    }

    /**
     * Check User Ban Status
     */
    isUserBanned(username) {
        try {
            const users = JSON.parse(localStorage.getItem('mining_users') || '{}');
            return users[username] && users[username].banned === true;
        } catch (err) {
            return false;
        }
    }

    /**
     * Get User Transaction History
     */
    getUserTransactions(username) {
        try {
            const trans = JSON.parse(localStorage.getItem('mining_transactions') || '[]');
            return trans.filter(t => t.user === username). sort((a, b) => b.timestamp - a.timestamp);
        } catch (err) {
            return [];
        }
    }

    /**
     * Get Maintenance Status
     */
    getMaintenanceStatus() {
        const isMaint = localStorage.getItem('mining_maintenance') === 'true';
        const msg = localStorage.getItem('mining_maintenance_msg') || '';
        return { enabled: isMaint, message: msg };
    }

    /**
     * Get Current Announcement
     */
    getCurrentAnnouncement() {
        try {
            const raw = localStorage.getItem('mining_announcement');
            if (! raw) return null;
            return JSON.parse(raw);
        } catch (err) {
            const raw = localStorage.getItem('mining_announcement');
            return { msg: raw || '', date: new Date().toISOString() };
        }
    }

    /**
     * Force Full Sync
     */
    forceSync() {
        this.lastSync = Date.now();
        localStorage.setItem('sync_timestamp', this.lastSync. toString());
        this.broadcast('force_sync', { timestamp: this. lastSync });
        this.notifyChange('force_sync_requested', { timestamp: this.lastSync });
    }

    /**
     * Get Sync Statistics
     */
    getSyncStats() {
        return {
            lastSync: this.lastSync,
            timeSinceSync: Date.now() - this. lastSync,
            listenersCount: Object.keys(this.listeners).length,
            hasBroadcastChannel: !!this.bc
        };
    }

    /**
     * Clean Data (Remove Old Records)
     */
    cleanOldData(maxAgeMs = 30 * 24 * 60 * 60 * 1000) { // 30 days default
        try {
            const trans = JSON.parse(localStorage.getItem('mining_transactions') || '[]');
            const now = Date.now();
            const filtered = trans.filter(t => (now - (t.timestamp || 0)) < maxAgeMs);
            
            if (filtered.length < trans.length) {
                localStorage.setItem('mining_transactions', JSON.stringify(filtered));
                this.notifyChange('old_data_cleaned', { 
                    removed: trans.length - filtered.length 
                });
                return trans.length - filtered.length;
            }
        } catch (err) {
            console.error('Error cleaning old data:', err);
        }
        return 0;
    }

    /**
     * Export Debug Info
     */
    debugInfo() {
        return {
            listeners: Object.keys(this.listeners),
            stats: this.getSyncStats(),
            maintenance: this.getMaintenanceStatus(),
            announcement: this.getCurrentAnnouncement()
        };
    }
}

// ============ Global Instance ============
const syncManager = new SyncManager();
console.log('✅ SyncManager initialized');