const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR);
}

// Helper to read data
function readData() {
    if (!fs.existsSync(USERS_FILE)) {
        return {};
    }
    try {
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error("Error reading users file:", err);
        return {};
    }
}

// Helper to write data
function writeData(data) {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (err) {
        console.error("Error writing users file:", err);
        return false;
    }
}

const db = {
    // Find user by ID (referral code)
    findUserById: (id) => {
        const users = readData();
        return Object.values(users).find(u => u.id == id);
    },

    // Find user by username
    findUserByUsername: (username) => {
        const users = readData();
        return users[username];
    },

    // Create new user
    createUser: (userData) => {
        const users = readData();
        if (users[userData.username]) {
            throw new Error('Username already exists');
        }
        
        // Validate referrer_id logic: can be null
        // If provided, must exist (validation logic should be handled by caller or here)
        
        users[userData.username] = {
            ...userData,
            regDate: new Date().toISOString(),
            balance: 0,
            hashrate: 0,
            // Ensure referrer_id is stored (can be null)
            referrer_id: userData.referrer_id || null 
        };
        
        writeData(users);
        return users[userData.username];
    },

    // Get all users (for admin)
    getAllUsers: () => {
        return readData();
    }
};

module.exports = db;
