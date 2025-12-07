const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(__dirname)); // Serve frontend files

// Serve index.html on root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API endpoint to check maintenance status
app.get('/api/maintenance-status', (req, res) => {
    const settings = db.getSettings();
    res.json({ maintenance: !!settings.maintenance });
});

// --- API Endpoints ---

// 1. Check Referral Code
app.get('/api/check-referral/:code', (req, res) => {
    const code = req.params.code;
    // Remove 'x' suffix if present (logic from frontend moved here or kept consistent)
    const cleanCode = code.replace(/x/i, '');
    
    const referrer = db.findUserById(cleanCode);
    
    if (referrer) {
        res.json({ 
            valid: true, 
            referrer: { 
                id: referrer.id, 
                username: referrer.username // Send back name for confirmation
            } 
        });
    } else {
        res.json({ valid: false });
    }
});

// 2. Register User
app.post('/api/register', (req, res) => {
    const { username, password, name, bank, acc, referrer_id, ip, deviceId } = req.body;

    if (!username || !password || !name || !bank || !acc) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        // Generate a random ID for the new user
        const newId = Math.floor(100000 + Math.random() * 900000);

        const newUser = db.createUser({
            username,
            password, // In a real app, hash this!
            name,
            bank,
            acc,
            id: newId,
            referrer_id: referrer_id, // Can be null
            ip: ip,
            deviceId: deviceId,
            status: referrer_id ? 'pending' : 'approved' // If no referrer, auto-approve? Or always pending? Let's say if referred, pending approval.
        });

        res.json({ success: true, user: newUser });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// 3. Login (Basic)
app.post('/api/login', (req, res) => {
    const settings = db.getSettings();
    if (settings.maintenance) {
        // Allow admin login during maintenance, assuming 'admin' is a specific username
        const { username } = req.body;
        if (username !== 'admin') { // You might want a more robust role system
            return res.status(503).json({ error: 'ระบบกำลังอยู่ในช่วงบำรุงรักษา' });
        }
    }

    const { username, password } = req.body;
    const user = db.findUserByUsername(username);

    if (user && user.password === password) {
        res.json({ success: true, user });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// Get User Data
app.get('/api/user/:username', (req, res) => {
    const user = db.findUserByUsername(req.params.username);
    if (user) {
        res.json({ success: true, user });
    } else {
        res.status(404).json({ error: 'User not found' });
    }
});

// Get User Referrals
app.get('/api/user/:username/referrals', (req, res) => {
    const refs = db.getUserReferrals(req.params.username);
    res.json({ success: true, referrals: refs });
});

// Sync User Data (Mining Progress)
app.post('/api/user/sync', (req, res) => {
    const { username, balance, hashrate, rigs } = req.body;
    try {
        const user = db.findUserByUsername(username);
        if (user) {
            // Update fields
            if(balance !== undefined) user.balance = balance;
            if(hashrate !== undefined) user.hashrate = hashrate;
            if(rigs !== undefined) user.rigs = rigs;
            
            // Save to DB (need a generic update helper or use specific ones)
            // database.js doesn't have a generic 'updateUser' that takes all fields.
            // But 'createUser' overwrites if we were to use it, but that's risky.
            // Let's add 'updateUser' to database.js or just manually update in memory and write.
            // db.updateUser(user); // Need to implement this
            
            // Quick fix: Generic update in database.js
             const allUsers = db.getAllUsers();
             allUsers[username] = { ...allUsers[username], ...user };
             const fs = require('fs');
             const path = require('path');
             const USERS_FILE = path.join(__dirname, 'data', 'users.json');
             fs.writeFileSync(USERS_FILE, JSON.stringify(allUsers, null, 2));

            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Admin API ---

// Get All Users
app.get('/api/admin/users', (req, res) => {
    // In real app, check for admin token/session here!
    const users = db.getAllUsers();
    res.json(users);
});

// Update User Status (Referral Approval)
app.post('/api/admin/update-status', (req, res) => {
    const { username, status, referrer_id } = req.body;
    
    try {
        const updatedUser = db.updateUserStatus(username, status);
        
        if(updatedUser && status === 'approved') {
            // 1. Add Bonus Transaction for New User (100 THB)
            db.createTransaction({
                user: username,
                type: 'deposit',
                amount: 100,
                status: 'approved',
                method: 'referral_bonus',
                fee: 0,
                net: 100,
                processed: true
            });

            // 2. Update Balance
            db.updateUserBalance(username, 100);
        }
        
        res.json({ success: true, user: updatedUser });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// Update Balance (General)
app.post('/api/admin/update-balance', (req, res) => {
    const { username, amount } = req.body;
    try {
        const updated = db.updateUserBalance(username, parseFloat(amount));
        res.json({ success: true, user: updated });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Transactions API ---
app.get('/api/admin/transactions', (req, res) => {
    const trans = db.getAllTransactions();
    res.json(trans);
});

app.post('/api/transactions/deposit', (req, res) => {
    const { username, amount, method, slip } = req.body;
    try {
        const trans = db.createTransaction({
            user: username,
            type: 'deposit',
            amount: parseFloat(amount),
            status: 'pending',
            method: method || 'qr_auto',
            slip: slip,
            processed: false
        });
        res.json({ success: true, transaction: trans });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// Get User Transactions
app.get('/api/user/:username/transactions', (req, res) => {
    const username = req.params.username;
    const allTrans = db.getAllTransactions();
    const userTrans = allTrans.filter(t => t.user === username);
    res.json({ success: true, transactions: userTrans });
});

app.post('/api/transactions/withdraw', (req, res) => {
    const { username, amount, bank, account } = req.body;
    try {
        const user = db.findUserByUsername(username);
        if(!user) throw new Error('User not found');
        if(user.balance < parseFloat(amount)) throw new Error('Insufficient balance');

        // Deduct balance immediately (hold)
        db.updateUserBalance(username, -parseFloat(amount));

        const trans = db.createTransaction({
            user: username,
            type: 'withdraw',
            amount: parseFloat(amount),
            status: 'pending',
            method: 'bank_transfer',
            bank: bank,
            account: account,
            processed: false
        });
        res.json({ success: true, transaction: trans });
    } catch(err) {
        res.status(400).json({ error: err.message });
    }
});

app.post('/api/admin/transactions/clear', (req, res) => {
    try {
        db.clearTransactions();
        res.json({ success: true });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/update-transaction-status', (req, res) => {
    const { id, status } = req.body;
    try {
        const trans = db.updateTransactionStatus(id, status);
        if (!trans) throw new Error('Transaction not found');

        // If approved/rejected, update balance logic might be needed
        // Deposit Approved -> Add Balance
        // Withdraw Rejected -> Refund Balance
        if (status === 'approved' && trans.type === 'deposit') {
             db.updateUserBalance(trans.user, parseFloat(trans.amount));
        } else if (status === 'rejected' && trans.type === 'withdraw') {
             db.updateUserBalance(trans.user, parseFloat(trans.amount));
        }

        res.json({ success: true, transaction: trans });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Settings API ---
app.get('/api/admin/settings', (req, res) => {
    const settings = db.getSettings();
    res.json(settings);
});

app.post('/api/admin/settings', (req, res) => {
    const settings = req.body;
    try {
        const updated = db.updateSettings(settings);
        res.json({ success: true, settings: updated });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// Delete User
app.post('/api/admin/delete-user', (req, res) => {
    const { username } = req.body;
    // Implement delete in database.js (need to add deleteUser function)
    // For now, let's assume we have it or add it.
    // db.deleteUser(username); 
    // Wait, I need to add deleteUser to database.js first.
    // Or I can implement it here if database.js exposes generic write? No, encapsulated.
    try {
        db.deleteUser(username);
        res.json({ success: true });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// Reset Password
app.post('/api/admin/reset-password', (req, res) => {
    const { username, password } = req.body;
    try {
        db.updateUserPassword(username, password);
        res.json({ success: true });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Shop API ---
app.get('/api/shop/items', (req, res) => {
    const settings = db.getSettings();
    if(settings.shop_disabled === 'true') {
        res.json({ 
            disabled: true, 
            notice: settings.shop_notice || '',
            items: [] 
        });
    } else {
        res.json({ 
            disabled: false, 
            notice: settings.shop_notice || '',
            items: db.getShopItems() 
        });
    }
});

app.post('/api/shop/buy', (req, res) => {
    const { username, itemId } = req.body;
    try {
        const user = db.findUserByUsername(username);
        if(!user) throw new Error('User not found');
        
        const items = db.getShopItems();
        const item = items.find(i => i.id == itemId);
        if(!item) throw new Error('Item not found');
        
        if(user.balance < item.price) throw new Error('ยอดเงินไม่พอ');
        
        // Deduct balance
        db.updateUserBalance(username, -item.price);
        
        // Add Rig
        const rig = {
            name: item.name,
            speed: item.speed,
            type: 'GPU', // Default
            temp: 60 + Math.random() * 20,
            power: 120 + Math.random() * 50,
            fan: 50 + Math.random() * 30,
            status: 'active',
            id: Date.now()
        };
        db.addUserRig(username, rig);
        
        // Create Transaction Record
        db.createTransaction({
            user: username,
            type: 'buy_item',
            amount: item.price,
            item: item.name,
            status: 'completed',
            processed: true
        });

        res.json({ success: true, user: db.findUserByUsername(username) });
    } catch(err) {
        res.status(400).json({ error: err.message });
    }
});

app.post('/api/admin/shop/items', (req, res) => {
    const item = req.body;
    try {
        const newItem = db.addShopItem(item);
        res.json({ success: true, item: newItem });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/delete-shop-item', (req, res) => {
    const { id } = req.body;
    try {
        db.deleteShopItem(id);
        res.json({ success: true });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/shop/clear', (req, res) => {
    try {
        db.clearShopItems();
        res.json({ success: true });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/reset-system', (req, res) => {
    try {
        db.resetSystem();
        res.json({ success: true });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Rig Management ---
app.post('/api/admin/delete-rig', (req, res) => {
    const { username, rigName } = req.body;
    try {
        const success = db.deleteUserRig(username, rigName);
        if(success) res.json({ success: true });
        else res.status(404).json({ error: 'Rig or User not found' });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// --- System Logs ---
app.post('/api/log', (req, res) => {
    const log = req.body;
    // Optional: Store logs in a file or DB
    // console.log('Client Log:', log);
    res.json({ success: true });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
