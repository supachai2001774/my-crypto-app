
const BASE_URL = 'http://localhost:3002';

async function testLogs() {
    console.log('--- Testing System Logs ---');

    // 1. Register User
    const username = 'logtest_' + Date.now();
    console.log(`1. Registering user: ${username}`);
    try {
        const resReg = await fetch(`${BASE_URL}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username,
                password: 'password123',
                name: 'Log Test User',
                bank: 'KBank',
                acc: '1234567890'
            })
        });
        const dataReg = await resReg.json();
        if (dataReg.success) console.log('   ✅ Registration successful');
        else console.error('   ❌ Registration failed:', dataReg);
    } catch (e) { console.error('   ❌ Error:', e.message); }

    // 2. Login User
    console.log('2. Logging in');
    try {
        const resLogin = await fetch(`${BASE_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username,
                password: 'password123'
            })
        });
        const dataLogin = await resLogin.json();
        if (dataLogin.success) console.log('   ✅ Login successful');
        else console.error('   ❌ Login failed:', dataLogin);
    } catch (e) { console.error('   ❌ Error:', e.message); }

    // 3. Check Logs
    console.log('3. Fetching Admin Logs');
    try {
        const resLogs = await fetch(`${BASE_URL}/api/admin/logs`);
        const logs = await resLogs.json();
        
        console.log(`   📊 Total Logs: ${logs.length}`);
        
        const regLog = logs.find(l => l.type === 'register' && l.user === username);
        const loginLog = logs.find(l => l.type === 'login' && l.user === username);

        if (regLog) console.log('   ✅ Found Registration Log');
        else console.error('   ❌ Missing Registration Log');

        if (loginLog) console.log('   ✅ Found Login Log');
        else console.error('   ❌ Missing Login Log');
        
        if(logs.length > 0) {
            console.log('   Sample Log:', logs[0]);
        }

    } catch (e) { console.error('   ❌ Error fetching logs:', e.message); }
}

testLogs();
