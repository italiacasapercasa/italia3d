' Roda a atualização do mapa sem abrir janela (usado pelo Agendador de Tarefas).
' Argumento opcional: --completo
Set sh = CreateObject("WScript.Shell")
raiz = CreateObject("Scripting.FileSystemObject").GetParentFolderName(CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName))
sh.CurrentDirectory = raiz
extra = ""
If WScript.Arguments.Count > 0 Then extra = " " & WScript.Arguments(0)
sh.Run """" & raiz & "\.tools\node-v22.11.0-win-x64\node.exe"" strumenti\aggiorna.mjs --pubblica --log" & extra, 0, True
