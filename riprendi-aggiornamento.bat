@echo off
rem Liga de novo a atualizacao automatica do mapa
schtasks /change /tn "Italia3D - aggiorna mappa" /enable
schtasks /change /tn "Italia3D - aggiorna completo" /enable
echo Atualizacao automatica LIGADA (a cada 10 minutos).
pause
