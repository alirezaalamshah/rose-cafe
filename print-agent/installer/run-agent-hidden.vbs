' Runs the print agent using the bundled node.exe with no visible console
' window. Called by Task Scheduler on Windows startup.
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

installDir = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
nodeExe = installDir & "\node-runtime\node.exe"
indexJs = installDir & "\app\index.js"

shell.CurrentDirectory = installDir & "\app"
shell.Run """" & nodeExe & """ """ & indexJs & """", 0, False
