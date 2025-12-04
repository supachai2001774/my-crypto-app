const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname)); // Serve frontend files

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
    const { username, password, name, bank, acc, referrer_id } = req.body;

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
            referrer_id: referrer_id // Can be null
        });

        // If there is a referrer, we might want to add to their referral list (logic from frontend)
        // For now, we just store the relationship in the user object. 
        // Advanced logic (commission) can be added here later.

        res.json({ success: true, user: newUser });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// 3. Login (Basic)
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = db.findUserByUsername(username);

    if (user && user.password === password) {
        res.json({ success: true, user });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
