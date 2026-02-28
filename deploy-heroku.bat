@echo off
setlocal

echo ============================================================
echo  ArcFlow Treasury — Heroku Backend Deployment
echo ============================================================
echo.

:: Check login
heroku whoami >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Not logged in to Heroku.
    echo Run:  heroku login
    echo Then re-run this script.
    pause
    exit /b 1
)

echo Logged in as:
heroku whoami

echo.
echo [1/4] Creating Heroku app (arcflow-treasury-backend)...
heroku create arcflow-treasury-backend 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo App may already exist — continuing.
)

echo.
echo [2/4] Deploying arcflow-backend/ subtree to Heroku...
cd /d "%~dp0"
git subtree push --prefix arcflow-backend heroku main

echo.
echo [3/4] Setting environment variables...
heroku config:set NODE_ENV=production --app arcflow-treasury-backend
heroku config:set FRONTEND_URL=https://arcflow-frontend.vercel.app --app arcflow-treasury-backend

echo.
echo [4/4] Done!
echo.
echo Backend URL:  https://arcflow-treasury-backend.herokuapp.com
echo Logs:         heroku logs --tail --app arcflow-treasury-backend
echo.
echo Next: set VITE_BACKEND_URL on Vercel:
echo   cd arcflow-frontend
echo   vercel env add VITE_BACKEND_URL production
echo   (enter: https://arcflow-treasury-backend.herokuapp.com)
echo   vercel --prod
echo.
pause
