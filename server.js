const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(compression()); // Compress all routes
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(__dirname)); // Serve frontend files

// Serve index.html on root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// API endpoint to check maintenance status and announcement
app.get('/api/maintenance-status', (req, res) => {
    try {
        const settings = db.getSettings();
        res.json({ 
            maintenance: !!settings.maintenance,
            announcement: settings.system_announcement || '',
            announcement_active: settings.system_announcement_active === 'true',
            deposit_fee_percent: settings.deposit_fee_percent || 0,
            withdraw_fee_percent: settings.withdraw_fee_percent || 0
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch maintenance status' });
    }
});

// --- Logs API ---
app.get('/api/admin/logs', (req, res) => {
    try {
        const logs = db.getLogs();
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

// Regenerate Shop Items (Admin)
app.post('/api/admin/shop/regenerate', (req, res) => {
    try {
        const items = db.regenerateShop();
        res.json({ success: true, count: items.length });
    } catch (err) {
        res.status(500).json({ error: 'Failed to regenerate shop' });
    }
});

const { exec } = require('child_process');

// --- Git / System Commands ---

// 1. Get Git Status
app.get('/api/admin/git/status', (req, res) => {
    exec('git log -1 --format="%h - %s (%cd)" --date=short', (err, stdout, stderr) => {
        if (err) {
            console.error('Git Status Error:', err);
            // Fallback for non-git environments
            return res.json({ 
                commit: 'No Git Info', 
                message: 'Running in non-git environment or error occurred.' 
            });
        }
        res.json({ commit: stdout.trim() });
    });
});

// 2. Trigger Git Pull (Local Update)
app.post('/api/admin/git/pull', (req, res) => {
    exec('git pull', (err, stdout, stderr) => {
        if (err) {
            console.error('Git Pull Error:', err);
            return res.status(500).json({ error: 'Git Pull Failed', details: stderr });
        }
        console.log('Git Pull Output:', stdout);
        res.json({ success: true, output: stdout });
    });
});



// --- API Endpoints ---

// 1. Check Referral Code
app.get('/api/check-referral/:code', (req, res) => {
    try {
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
    } catch (err) {
        res.status(500).json({ error: 'Failed to check referral' });
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
            status: 'approved' // Auto-approve all new users
        });

        db.addLog({
            type: 'register',
            user: username,
            action: 'New User Registration',
            details: `Referrer: ${referrer_id || 'None'}, IP: ${ip || 'Unknown'}`
        });

        res.json({ success: true, user: newUser });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// 3. Login (Basic)
app.post('/api/login', (req, res) => {
    try {
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
            // Log Login
            db.addLog({
                type: 'login',
                user: username,
                action: 'User Login',
                details: `IP: ${req.ip || 'Unknown'}`
            });
            res.json({ success: true, user });
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Login failed' });
    }
});

// Get User Data
app.get('/api/user/:username', (req, res) => {
    try {
        const user = db.findUserByUsername(req.params.username);
        if (user) {
            res.json({ success: true, user });
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch user data' });
    }
});

// Get User Referrals
app.get('/api/user/:username/referrals', (req, res) => {
    const refs = db.getUserReferrals(req.params.username);
    res.json({ success: true, referrals: refs });
});

// Get User Notifications
app.get('/api/user/:username/notifications', (req, res) => {
    let notifs = db.getNotifications(req.params.username);
    
    // Filter by unread if requested
    if (req.query.unread === 'true') {
        notifs = notifs.filter(n => !n.read);
    }
    
    res.json({ success: true, notifications: notifs });
});

// Mark Notification Read
app.post('/api/user/notifications/read', (req, res) => {
    const { id } = req.body;
    try {
        db.markNotificationRead(id);
        res.json({ success: true });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
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
            
            // Update Activity Timestamp for Online Status
            user.lastActive = Date.now();
            
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
    try {
        const trans = db.getAllTransactions();
        res.json(trans);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
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

        db.addLog({
            type: 'transaction',
            user: username,
            action: 'Deposit Request',
            details: `Amount: ${amount}, Method: ${method || 'qr_auto'}`
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

        db.addLog({
            type: 'transaction',
            user: username,
            action: 'Withdraw Request',
            details: `Amount: ${amount}, Bank: ${bank}, Acc: ${account}`
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
        // 1. Get Settings & Transaction
        const settings = db.getSettings();
        const allTrans = db.getAllTransactions();
        const existingTrans = allTrans.find(t => t.id == id);
        
        if (!existingTrans) throw new Error('Transaction not found');

        let updates = {};
        let amount = parseFloat(existingTrans.amount);
        let netAmount = amount;
        let fee = 0;

        // Calculate Fee if approving
        if (status === 'approved') {
            if (existingTrans.type === 'deposit') {
                const feePercent = parseFloat(settings.deposit_fee_percent || 0);
                fee = (amount * feePercent) / 100;
                netAmount = amount - fee;
            } else if (existingTrans.type === 'withdraw') {
                const feePercent = parseFloat(settings.withdraw_fee_percent || 0);
                fee = (amount * feePercent) / 100;
                netAmount = amount - fee;
            }
            updates = { fee, net_amount: netAmount };
        }

        const trans = db.updateTransactionStatus(id, status, updates);

        if (status === 'approved' && trans.type === 'deposit') {
             db.updateUserBalance(trans.user, parseFloat(trans.net_amount));
             db.addNotification(trans.user, `รายการฝากเงิน ${amount.toLocaleString()} บาท ได้รับการอนุมัติแล้ว (เข้าบัญชี: ${netAmount.toLocaleString()} บาท)`, 'success');
        } else if (status === 'approved' && trans.type === 'withdraw') {
             // Balance already deducted. Just notify.
             db.addNotification(trans.user, `รายการถอนเงิน ${amount.toLocaleString()} บาท ได้รับการอนุมัติแล้ว (ได้รับจริง: ${netAmount.toLocaleString()} บาท)`, 'success');
        } else if (status === 'rejected') {
             if (trans.type === 'withdraw') {
                 db.updateUserBalance(trans.user, parseFloat(trans.amount)); // Refund full amount
             }
             db.addNotification(trans.user, `รายการ ${trans.type === 'deposit' ? 'ฝากเงิน' : 'ถอนเงิน'} ${amount.toLocaleString()} บาท ถูกปฏิเสธ`, 'error');
        }

        db.addLog({
            type: 'admin_action',
            user: 'admin',
            action: 'Transaction Update',
            details: `ID: ${id}, Status: ${status}, User: ${trans.user}`
        });

        res.json({ success: true, transaction: trans });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// --- Settings API ---
app.get('/api/admin/settings', (req, res) => {
    try {
        const settings = db.getSettings();
        res.json(settings);
    } catch (err) {
        console.error('Error fetching settings:', err);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

app.post('/api/admin/settings', (req, res) => {
    const settings = req.body;
    try {
        const updated = db.updateSettings(settings);
        
        db.addLog({
            type: 'admin_action',
            user: 'admin',
            action: 'Settings Update',
            details: JSON.stringify(settings)
        });
        
        res.json({ success: true, settings: updated });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// Create User (Admin)
app.post('/api/admin/create-user', (req, res) => {
    const { username, password, email } = req.body;
    try {
        if(!username || !password) throw new Error('กรุณาระบุชื่อผู้ใช้และรหัสผ่าน');
        
        // Basic ID generation if not handled by db (db uses username as key, but stores id inside)
        // db.createUser expects userData
        const newUser = db.createUser({
            username,
            password,
            email: email || '',
            id: Date.now(),
            status: 'active', // Admin created users are active by default
            ip: 'Admin Created',
            deviceId: 'Admin Console'
        });
        
        db.addLog({
            type: 'admin_action',
            user: 'admin',
            action: 'Create User',
            details: `Created user: ${username}`
        });
        
        res.json({ success: true, user: newUser });
    } catch(err) {
        res.status(400).json({ error: err.message });
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
    try {
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
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch shop items' });
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

        db.addLog({
            type: 'purchase',
            user: username,
            action: 'Item Purchased',
            details: `Item: ${item.name}, Price: ${item.price}`
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
        if(success) {
            db.addLog({ type: 'system', action: 'delete_rig', detail: `Admin deleted rig ${rigName} from ${username}` });
            res.json({ success: true });
        }
        else res.status(404).json({ error: 'Rig or User not found' });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/admin/toggle-rig-status', (req, res) => {
    const { username, rigName } = req.body;
    try {
        const result = db.toggleUserRigStatus(username, rigName);
        if(result.success) {
            db.addLog({ type: 'system', action: 'toggle_rig', detail: `Admin changed rig ${rigName} status to ${result.status} for ${username}` });
            res.json(result);
        } else {
            res.status(404).json({ error: result.error });
        }
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// --- System Logs ---
app.get('/api/admin/logs', (req, res) => {
    const logs = db.getLogs();
    res.json(logs);
});

app.post('/api/admin/logs/clear', (req, res) => {
    try {
        db.clearLogs();
        db.addLog({ type: 'system', action: 'clear_logs', detail: 'Admin cleared system logs' });
        res.json({ success: true });
    } catch(err) {
        res.status(500).json({ error: err.message });
    }
});

// Client Logs
app.post('/api/log', (req, res) => {
    try {
        const log = req.body;
        db.addLog({ type: 'client', ...log });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: 'Failed to add log' });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    db.addLog({ type: 'system', action: 'startup', detail: `Server started on port ${PORT}` });
});
