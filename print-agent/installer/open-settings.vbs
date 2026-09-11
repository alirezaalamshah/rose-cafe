' Opens the printer settings page: starts a temporary local server using the
' bundled node.exe with no console window, then opens the user's default
' browser. Launched from the "Print Settings" desktop shortcut.
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

installDir = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
nodeExe = installDir & "\node-runtime\node.exe"
configServerJs = installDir & "\app\config-server.js"

shell.CurrentDirectory = installDir & "\app"
shell.Run """" & nodeExe & """ """ & configServerJs & """", 0, False
