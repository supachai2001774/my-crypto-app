@echo off
title Crypto App Server (DO NOT CLOSE)
echo ====================================================
echo    STARTING SERVER... (Crypto Miner Tycoon)
echo ====================================================
echo.
echo 1. PC Admin Link:   http://localhost:3002/admin.html
echo 2. PC App Link:     http://localhost:3002/index.html
echo.
echo 3. Mobile Link:     http://[YOUR-PC-IP]:3002/index.html
echo.
echo    (Check IP by typing 'ipconfig' in cmd)
echo.
echo ====================================================
echo    STATUS: ONLINE
echo    (Keep this window OPEN to let mobile connect)
echo ====================================================
echo.
node server.js
pause