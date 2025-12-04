
==================================================================
   CRYPTO MINER TYCOON - INSTALLATION & SETUP GUIDE
==================================================================

1. SYSTEM OVERVIEW
------------------
This system is designed to run in two modes:
   A. Live Simulation (Current) - Uses LocalStorage for instant demo/testing.
   B. Production (MySQL) - Uses the provided SQL schema for real backend deployment.

2. LIVE CONNECTION (TESTING)
----------------------------
To test the "Real Live Connection" feature on your PC:
   - Open [Admin.html] in one browser window (this acts as the Server/PC Admin).
   - Open [index.html] in a different window or tab (this acts as the User App).
   - Both windows will sync instantly via the "LiveSync" protocol.

3. REFERRAL SYSTEM TESTING
--------------------------
To test the referral link flow:
   1. Open index.html and login as User A.
   2. Go to "Invite Friends" and copy the code (e.g., 123456).
   3. Open a NEW browser (or Incognito window) with the link:
      index.html?ref=123456
   4. Register as User B.
   5. Check User A's dashboard - the new referral will appear instantly.
   6. Check Admin Panel - the new user will appear in "Monitor" and "Referrals".

4. MYSQL DATABASE DEPLOYMENT
----------------------------
For production deployment, a full SQL schema has been generated at:
   [ database.sql ]

   - Import this file into phpMyAdmin or MySQL Workbench.
   - It contains all necessary tables: Users, Transactions, Referrals, Shop.
   - Connect your backend API (PHP/Node.js) to this database.

5. FILES INCLUDED
-----------------
- Admin.html      : PC Admin Panel (Live Connected)
- index.html      : User Application
- database.sql    : MySQL Database Schema
- live-sync.js    : Real-time synchronization engine

==================================================================
   SYSTEM STATUS: READY TO DEPLOY
==================================================================
