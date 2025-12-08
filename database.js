const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

const TRANSACTIONS_FILE = path.join(DATA_DIR, 'transactions.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const SHOP_FILE = path.join(DATA_DIR, 'shop.json');
const NOTIFICATIONS_FILE = path.join(DATA_DIR, 'notifications.json');
const LOGS_FILE = path.join(DATA_DIR, 'logs.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

// Generic read/write helpers
function readJson(file) {
    if (!fs.existsSync(file)) return []; // Default to array for transactions
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
        console.error(`Error reading ${file}:`, err);
        return [];
    }
}

function readJsonObj(file) {
    if (!fs.existsSync(file)) return {};
    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
        console.error(`Error reading ${file}:`, err);
        return {};
    }
}

function writeJson(file, data) {
    try {
        fs.writeFileSync(file, JSON.stringify(data, null, 2));
        return true;
    } catch (err) {
        console.error(`Error writing ${file}:`, err);
        return false;
    }
}

// Helper functions for Shop Generation
function formatPrice(num) {
    if (num < 1000) return Math.round(num / 10) * 10;
    if (num < 10000) return Math.round(num / 100) * 100;
    if (num < 1000000) return Math.round(num / 1000) * 1000;
    return Math.round(num / 10000) * 10000;
}

function getTier(lv) {
    if (lv <= 20) return 'basic';
    if (lv <= 50) return 'mid';
    if (lv <= 80) return 'pro';
    if (lv < 100) return 'legendary';
    return 'limited';
}

function getIcon(lv) {
    if (lv <= 20) return 'fa-fan';
    if (lv <= 40) return 'fa-server';
    if (lv <= 60) return 'fa-microchip';
    if (lv <= 80) return 'fa-memory';
    if (lv < 100) return 'fa-brain';
    return 'fa-rocket';
}

function getTag(lv) {
    if (lv === 1) return 'new';
    if (lv === 100) return 'best';
    if (lv % 25 === 0) return 'hot';
    if (lv % 10 === 0) return 'sale';
    return '';
}

function generateDefaultShop() {
    const LEVELS = 100;
    const BASE_PRICE = 500;
    const BASE_INCOME_MO = 300;
    const MULT_PRICE = 1.135;
    const MULT_INCOME = 1.10;

    const items = [];
    for (let i = 1; i <= LEVELS; i++) {
        const rawPrice = BASE_PRICE * Math.pow(MULT_PRICE, i - 1);
        const price = formatPrice(rawPrice);
        const incomeMo = BASE_INCOME_MO * Math.pow(MULT_INCOME, i - 1);
        const speed = incomeMo / (30 * 24 * 3600);

        items.push({
            id: i,
            name: `AI Miner System Lv.${i}`,
            price: price,
            speed: speed,
            tier: getTier(i),
            icon: getIcon(i),
            tag: getTag(i)
        });
    }
    return items;
}

// Legacy helpers (to be refactored if needed, but keeping for compatibility)
function readData() { return readJsonObj(USERS_FILE); }
function writeData(data) { return writeJson(USERS_FILE, data); }

const db = {
    // --- USERS ---
    findUserById: (id) => {
        const users = readData();
        return Object.values(users).find(u => u.id == id);
    },
    findUserByUsername: (username) => {
        const users = readData();
        return users[username];
    },
    createUser: (userData) => {
        const users = readData();
        if (users[userData.username]) {
            throw new Error('Username already exists');
        }
        users[userData.username] = {
            ...userData,
            regDate: new Date().toISOString(),
            balance: 0,
            hashrate: 0,
            referrer_id: userData.referrer_id || null,
            ip: userData.ip || 'Unknown',
            deviceId: userData.deviceId || 'Unknown',
            status: userData.status || 'pending',
            rigs: [] // Add rigs support
        };
        writeData(users);
        return users[userData.username];
    },
    getAllUsers: () => {
        return readData();
    },
    getUserReferrals: (username) => {
        const users = readData();
        const user = users[username];
        if(!user) return [];
        // Find all users who have this user's ID as referrer_id
        // First get the user's ID
        const myId = user.id;
        if(!myId) return [];
        
        return Object.values(users).filter(u => u.referrer_id == myId);
    },
    updateUserStatus: (username, status) => {
        const users = readData();
        if (users[username]) {
            users[username].status = status;
            writeData(users);
            return users[username];
        }
        return null;
    },
    updateUserBalance: (username, amount) => {
        const users = readData();
        if (users[username]) {
            users[username].balance = (users[username].balance || 0) + amount;
            writeData(users);
            return users[username];
        }
        return null;
    },
    updateUserPassword: (username, password) => {
        const users = readData();
        if (users[username]) {
            users[username].password = password;
            writeData(users);
            return users[username];
        }
        throw new Error('User not found');
    },
    deleteUser: (username) => {
        const users = readData();
        if (users[username]) {
            delete users[username];
            writeData(users);
            return true;
        }
        throw new Error('User not found');
    },

    // --- TRANSACTIONS ---
    getAllTransactions: () => {
        return readJson(TRANSACTIONS_FILE);
    },
    createTransaction: (transData) => {
        const trans = readJson(TRANSACTIONS_FILE);
        const newTrans = { ...transData, id: Date.now(), timestamp: Date.now() };
        trans.push(newTrans);
        writeJson(TRANSACTIONS_FILE, trans);
        return newTrans;
    },
    updateTransactionStatus: (id, status, updates = {}) => {
        const trans = readJson(TRANSACTIONS_FILE);
        const idx = trans.findIndex(t => t.id == id);
        if (idx !== -1) {
            trans[idx].status = status;
            // Apply other updates (e.g., fee, net_amount, admin_note)
            Object.keys(updates).forEach(key => {
                trans[idx][key] = updates[key];
            });
            writeJson(TRANSACTIONS_FILE, trans);
            return trans[idx];
        }
        return null;
    },

    // --- SETTINGS ---
    getSettings: () => {
        return readJsonObj(SETTINGS_FILE);
    },
    updateSettings: (newSettings) => {
        const settings = readJsonObj(SETTINGS_FILE);
        const updated = { ...settings, ...newSettings };
        writeJson(SETTINGS_FILE, updated);
        return updated;
    },

    // --- SHOP ---
    getShopItems: () => {
        let items = readJson(SHOP_FILE);
        // If shop is empty, generate default items
        if (items.length === 0) {
            console.log('Shop is empty, generating default items...');
            items = generateDefaultShop();
            writeJson(SHOP_FILE, items);
        }
        return items;
    },
    addShopItem: (item) => {
        const items = readJson(SHOP_FILE);
        const newItem = { ...item, id: Date.now() };
        items.push(newItem);
        writeJson(SHOP_FILE, items);
        
        // Update timestamp for polling
        const settings = readJsonObj(SETTINGS_FILE);
        settings.last_shop_update = Date.now();
        writeJson(SETTINGS_FILE, settings);

        return newItem;
    },
    deleteShopItem: (id) => {
        let items = readJson(SHOP_FILE);
        const initLen = items.length;
        items = items.filter(i => i.id != id);
        if (items.length !== initLen) {
            writeJson(SHOP_FILE, items);
            
            // Update timestamp for polling
            const settings = readJsonObj(SETTINGS_FILE);
            settings.last_shop_update = Date.now();
            writeJson(SETTINGS_FILE, settings);
            
            return true;
        }
        return false;
    },
    clearShopItems: () => {
        writeJson(SHOP_FILE, []);
        
        // Update timestamp for polling
        const settings = readJsonObj(SETTINGS_FILE);
        settings.last_shop_update = Date.now();
        writeJson(SETTINGS_FILE, settings);
        
        return true;
    },
    clearTransactions: () => {
        writeJson(TRANSACTIONS_FILE, []);
        return true;
    },
    resetSystem: () => {
        // Preserve critical settings (maintenance, announcement)
        const currentSettings = readJsonObj(SETTINGS_FILE);
        const preservedSettings = {
            maintenance: currentSettings.maintenance,
            maintenance_msg: currentSettings.maintenance_msg,
            system_announcement: currentSettings.system_announcement,
            system_announcement_active: currentSettings.system_announcement_active
        };

        writeJson(USERS_FILE, {});
        writeJson(TRANSACTIONS_FILE, []);
        writeJson(SHOP_FILE, []);
        writeJson(NOTIFICATIONS_FILE, []); // Clear notifications
        writeJson(SETTINGS_FILE, preservedSettings);
        // Note: Logs are intentionally NOT cleared
        return true;
    },

    // --- RIGS ---
    addUserRig: (username, rig) => {
        const users = readData();
        if (users[username]) {
            if (!users[username].rigs) users[username].rigs = [];
            users[username].rigs.push(rig);
            // Recalculate hashrate
            users[username].hashrate = (users[username].hashrate || 0) + (rig.speed || 0);
            writeData(users);
            return users[username];
        }
        throw new Error('User not found');
    },
    deleteUserRig: (username, rigName) => {
        const users = readData();
        if (users[username] && users[username].rigs) {
            const initLen = users[username].rigs.length;
            users[username].rigs = users[username].rigs.filter(r => r.name !== rigName);
            if (users[username].rigs.length !== initLen) {
                // Recalculate hashrate based on ACTIVE rigs only
                users[username].hashrate = users[username].rigs
                    .filter(r => r.status !== 'paused')
                    .reduce((sum, r) => sum + (r.speed || 0), 0);
                writeData(users);
                return true;
            }
        }
        return false;
    },
    toggleUserRigStatus: (username, rigName) => {
        const users = readData();
        if (users[username] && users[username].rigs) {
            const rig = users[username].rigs.find(r => r.name === rigName);
            if (rig) {
                // Toggle status
                const currentStatus = rig.status || 'active';
                const newStatus = currentStatus === 'active' ? 'paused' : 'active';
                rig.status = newStatus;

                // Recalculate hashrate based on ACTIVE rigs only
                users[username].hashrate = users[username].rigs
                    .filter(r => r.status !== 'paused')
                    .reduce((sum, r) => sum + (r.speed || 0), 0);
                
                writeData(users);
                return { success: true, status: newStatus, user: users[username] };
            }
        }
        return { success: false, error: 'Rig not found' };
    },

    // --- LOGS ---
    getLogs: () => {
        return readJson(LOGS_FILE).sort((a, b) => b.timestamp - a.timestamp).slice(0, 100);
    },
    addLog: (logData) => {
        const logs = readJson(LOGS_FILE);
        const newLog = { ...logData, id: Date.now(), timestamp: Date.now() };
        logs.push(newLog);
        // Limit to 500 logs
        if(logs.length > 500) logs.shift();
        writeJson(LOGS_FILE, logs);
        return newLog;
    },
    clearLogs: () => {
        writeJson(LOGS_FILE, []);
        return true;
    },

    // --- NOTIFICATIONS ---
    getNotifications: (username) => {
        const all = readJson(NOTIFICATIONS_FILE);
        // Filter by user and sort by newest
        return all.filter(n => n.user === username).sort((a, b) => b.timestamp - a.timestamp);
    },
    addNotification: (username, message, type = 'info') => {
        const all = readJson(NOTIFICATIONS_FILE);
        const notif = {
            id: Date.now(),
            user: username,
            message: message,
            type: type, // info, success, warning, error
            read: false,
            timestamp: Date.now()
        };
        all.push(notif);
        // Limit total notifications to avoid file bloat
        if(all.length > 2000) all.shift();
        writeJson(NOTIFICATIONS_FILE, all);
        return notif;
    },
    markNotificationRead: (id) => {
        const all = readJson(NOTIFICATIONS_FILE);
        const idx = all.findIndex(n => n.id == id);
        if(idx !== -1) {
            all[idx].read = true;
            writeJson(NOTIFICATIONS_FILE, all);
            return true;
        }
        return false;
    }
};

module.exports = db;
