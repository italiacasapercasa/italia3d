@echo off
rem Pausa a atualizacao automatica do mapa (para voltar: riprendi-aggiornamento.bat)
schtasks /change /tn "Italia3D - aggiorna mappa" /disable
schtasks /change /tn "Italia3D - aggiorna completo" /disable
echo Atualizacao automatica PAUSADA.
pause
