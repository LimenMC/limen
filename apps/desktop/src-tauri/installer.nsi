!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "nsDialogs.nsh"

; Installer settings
Name "Limen"
OutFile "Limen-Setup.exe"
InstallDir "$PROGRAMFILES64\Limen"
InstallDirRegKey HKLM "Software\Limen" "Install_Dir"
RequestExecutionLevel admin

; Modern UI Configuration
!define MUI_ABORTWARNING
!define MUI_ICON "icons\icon.ico"
!define MUI_UNICON "icons\icon.ico"

; Custom UI with modern design
!define MUI_UI_HEADERIMAGE_RIGHT
!define MUI_HEADERIMAGE
!define MUI_HEADERIMAGE_BITMAP "installer\header.bmp"
!define MUI_HEADERIMAGE_UNBITMAP "installer\header.bmp"

; Welcome/Finish page images
!define MUI_WELCOMEFINISHPAGE_BITMAP "installer\welcome.bmp"
!define MUI_UNWELCOMEFINISHPAGE_BITMAP "installer\welcome.bmp"

; Custom colors - Dark theme with blue accent
!define MUI_BGCOLOR "0a0a0a"
!define MUI_TEXTCOLOR "FFFFFF"

; Custom page settings
!define MUI_WELCOMEPAGE_TITLE "Welcome to Limen"
!define MUI_WELCOMEPAGE_TITLE_3LINES
!define MUI_WELCOMEPAGE_TEXT "The modern Minecraft launcher$\r$\n$\r$\nSupports Forge, Fabric, Quilt, and NeoForge with a beautiful interface.$\r$\n$\r$\n$\r$\nClick Next to begin installation."

; Directory page
!define MUI_DIRECTORYPAGE_TEXT_TOP "Setup will install Limen in the following folder. To install in a different folder, click Browse and select another folder."
!define MUI_DIRECTORYPAGE_TEXT_DESTINATION "Destination Folder"

; Install page
!define MUI_INSTFILESPAGE_COLORS "FFFFFF 0a0a0a"
!define MUI_INSTFILESPAGE_PROGRESSBAR "smooth"

; Finish page
!define MUI_FINISHPAGE_TITLE "Installation Complete"
!define MUI_FINISHPAGE_TITLE_3LINES
!define MUI_FINISHPAGE_TEXT "Limen has been installed on your computer.$\r$\n$\r$\nYou can now launch Limen and start managing your Minecraft mods.$\r$\n$\r$\nClick Finish to close Setup."
!define MUI_FINISHPAGE_RUN "$INSTDIR\Limen.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Launch Limen now"
!define MUI_FINISHPAGE_LINK "Visit limen.app"
!define MUI_FINISHPAGE_LINK_LOCATION "https://limen.app"
!define MUI_FINISHPAGE_LINK_COLOR "3b82f6"

; Uninstaller
!define MUI_UNCONFIRMPAGE_TEXT_TOP "Setup will uninstall Limen from your computer."

; Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "LICENSE"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

; Uninstaller pages
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

; Languages
!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "Turkish"
!insertmacro MUI_LANGUAGE "German"
!insertmacro MUI_LANGUAGE "SimpChinese"

; Version Information
VIProductVersion "0.1.0.0"
VIAddVersionKey "ProductName" "Limen"
VIAddVersionKey "CompanyName" "Limen Team"
VIAddVersionKey "FileDescription" "Limen - Modern Minecraft Launcher"
VIAddVersionKey "FileVersion" "0.1.0"
VIAddVersionKey "ProductVersion" "0.1.0"
VIAddVersionKey "LegalCopyright" "© 2026 Limen Team"

; Custom functions for modern UI
Function .onInit
  ; Set custom font
  SetFont "Segoe UI" 9
  
  ; Check if already installed
  ReadRegStr $R0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Limen" "UninstallString"
  StrCmp $R0 "" done
  
  MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION \
  "Limen is already installed. $\n$\nClick OK to remove the previous version or Cancel to cancel this upgrade." \
  IDOK uninst
  Abort
  
uninst:
  ClearErrors
  ExecWait '$R0 _?=$INSTDIR'
  
done:
FunctionEnd

; Installer Section
Section "Install" SecInstall
  SetOutPath "$INSTDIR"
  
  ; Set overwrite on
  SetOverwrite on
  
  ; Copy files
  File /r "dist\*.*"
  
  ; Create shortcuts with custom icons
  CreateDirectory "$SMPROGRAMS\Limen"
  CreateShortcut "$SMPROGRAMS\Limen\Limen.lnk" "$INSTDIR\Limen.exe" "" "$INSTDIR\Limen.exe" 0 SW_SHOWNORMAL "" "Launch Limen"
  CreateShortcut "$SMPROGRAMS\Limen\Uninstall Limen.lnk" "$INSTDIR\Uninstall.exe" "" "$INSTDIR\Uninstall.exe" 0 SW_SHOWNORMAL "" "Uninstall Limen"
  CreateShortcut "$DESKTOP\Limen.lnk" "$INSTDIR\Limen.exe" "" "$INSTDIR\Limen.exe" 0 SW_SHOWNORMAL "" "Launch Limen"
  
  ; Write registry keys
  WriteRegStr HKLM "Software\Limen" "Install_Dir" "$INSTDIR"
  WriteRegStr HKLM "Software\Limen" "Version" "0.1.0"
  
  ; Add to Windows Programs and Features
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Limen" "DisplayName" "Limen"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Limen" "DisplayIcon" "$INSTDIR\Limen.exe,0"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Limen" "DisplayVersion" "0.1.0"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Limen" "Publisher" "Limen Team"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Limen" "URLInfoAbout" "https://limen.app"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Limen" "HelpLink" "https://limen.app/support"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Limen" "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Limen" "QuietUninstallString" "$INSTDIR\Uninstall.exe /S"
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Limen" "NoModify" 1
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Limen" "NoRepair" 1
  
  ; Calculate and write install size
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Limen" "EstimatedSize" "$0"
  
  ; Create uninstaller
  WriteUninstaller "$INSTDIR\Uninstall.exe"
SectionEnd

; Uninstaller Section
Section "Uninstall"
  ; Remove files and directories
  Delete "$INSTDIR\Limen.exe"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir /r "$INSTDIR"
  
  ; Remove shortcuts
  Delete "$DESKTOP\Limen.lnk"
  Delete "$SMPROGRAMS\Limen\Limen.lnk"
  Delete "$SMPROGRAMS\Limen\Uninstall Limen.lnk"
  RMDir "$SMPROGRAMS\Limen"
  
  ; Remove registry keys
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\Limen"
  DeleteRegKey HKLM "Software\Limen"
  
  ; Remove user data (optional - ask user)
  MessageBox MB_YESNO "Do you want to remove all Limen user data and settings?" IDNO skip_userdata
  RMDir /r "$APPDATA\Limen"
  
skip_userdata:
SectionEnd

; Section descriptions
!insertmacro MUI_FUNCTION_DESCRIPTION_BEGIN
  !insertmacro MUI_DESCRIPTION_TEXT ${SecInstall} "Install Limen Minecraft Launcher"
!insertmacro MUI_FUNCTION_DESCRIPTION_END
