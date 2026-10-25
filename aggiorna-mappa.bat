@echo off
rem Atualiza o mapa com os comentarios do Instagram (precisa de config\instagram.json)
cd /d "%~dp0"
".tools\node-v22.11.0-win-x64\node.exe" strumenti\aggiorna.mjs %*
pause
