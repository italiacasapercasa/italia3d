@echo off
rem Abre o site local: http://localhost:5173  (feche esta janela para desligar)
cd /d "%~dp0"
start "" http://localhost:5173/
".tools\node-v22.11.0-win-x64\node.exe" strumenti\server.mjs 5173
pause
