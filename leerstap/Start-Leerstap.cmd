@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Eerste keer: onderdelen installeren...
  call npm ci || (pause & exit /b 1)
)
if not exist dist\public\index.html call npm run build
echo.
echo Leerstap start op http://127.0.0.1:4173
echo Gegevens staan in de map "data" naast dit bestand. Houd dit venster open tijdens gebruik.
node --env-file-if-exists=.env --disable-warning=ExperimentalWarning scripts/serve.mjs
pause
