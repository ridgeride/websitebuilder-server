@echo off
cd /d "%~dp0"
echo Leerstap start op http://127.0.0.1:4173
echo Houd dit venster open tijdens gebruik. Sluiten stopt de app-server.
node scripts/serve.mjs
pause
