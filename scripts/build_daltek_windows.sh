#!/bin/bash
set -e

echo "=========================================================="
echo "    DALTEK WINDOWS NATIVE APP & INSTALLER PIPELINE        "
echo "=========================================================="

PROJECT_ROOT="/tmp/daltek_windows_build"
SRC_ROOT="/app/applet"
OUTPUT_DIR="/app/applet/downloads_storage"
PUBLIC_DIR="/app/applet/public"
LIVE_BACKEND_URL="https://ais-pre-h57hoexwhutai4uvntr75c-246438389907.europe-west2.run.app"

mkdir -p "$OUTPUT_DIR"
mkdir -p "$PUBLIC_DIR"
rm -rf "$PROJECT_ROOT"
mkdir -p "$PROJECT_ROOT"

cd "$PROJECT_ROOT"
mkdir -p build/bin
mkdir -p build/res

# 1. Generate Multi-Resolution Windows .ico icon from DALTEK logo
echo "[1/6] Generating Windows high-resolution icon (daltek.ico)..."
LOGO_PNG="$PUBLIC_DIR/daltek-logo.png"
if [ ! -f "$LOGO_PNG" ]; then
    LOGO_PNG="$SRC_ROOT/public/icon-android-512.png"
fi

convert "$LOGO_PNG" -resize 256x256 build/res/icon256.png
convert "$LOGO_PNG" -resize 128x128 build/res/icon128.png
convert "$LOGO_PNG" -resize 64x64 build/res/icon64.png
convert "$LOGO_PNG" -resize 48x48 build/res/icon48.png
convert "$LOGO_PNG" -resize 32x32 build/res/icon32.png
convert "$LOGO_PNG" -resize 16x16 build/res/icon16.png

icotool -c -o build/res/daltek.ico \
    build/res/icon16.png \
    build/res/icon32.png \
    build/res/icon48.png \
    build/res/icon64.png \
    build/res/icon128.png \
    build/res/icon256.png

cp build/res/daltek.ico "$PUBLIC_DIR/daltek.ico"

# 2. Write Windows Resource Script & Manifest
echo "[2/6] Creating Windows Resource Script (.rc)..."
cat << 'EOF' > build/res/resource.rc
#include <windows.h>

IDI_APP_ICON ICON "daltek.ico"

1 VERSIONINFO
FILEVERSION     1,2,0,0
PRODUCTVERSION  1,2,0,0
FILEFLAGSMASK   VS_FFI_FILEFLAGSMASK
FILEFLAGS       0
FILEOS          VOS_NT_WINDOWS32
FILETYPE        VFT_APP
FILESUBTYPE     VFT2_UNKNOWN
BEGIN
    BLOCK "StringFileInfo"
    BEGIN
        BLOCK "040904b0"
        BEGIN
            VALUE "CompanyName",      "DALTEK Systems"
            VALUE "FileDescription",  "DALTEK Queue Management Client"
            VALUE "FileVersion",      "1.2.0.0"
            VALUE "InternalName",     "DALTEK"
            VALUE "LegalCopyright",   "Copyright (C) 2026 DALTEK INC. All rights reserved."
            VALUE "OriginalFilename", "DALTEK.exe"
            VALUE "ProductName",      "DALTEK"
            VALUE "ProductVersion",   "1.2.0.0"
        END
    END
    BLOCK "VarFileInfo"
    BEGIN
        VALUE "Translation", 0x409, 1200
    END
END

// DPI Awareness and Modern Controls Manifest
1 24 "app.manifest"
EOF

cat << 'EOF' > build/res/app.manifest
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0" xmlns:asmv3="urn:schemas-microsoft-com:asm.v3">
  <assemblyIdentity version="1.2.0.0" processorArchitecture="*" name="DALTEK.Systems.App" type="win32"/>
  <description>DALTEK Queue Management System</description>
  <dependency>
    <dependentAssembly>
      <assemblyIdentity type="win32" name="Microsoft.Windows.Common-Controls" version="6.0.0.0" processorArchitecture="*" publicKeyToken="6595b64144ccf1df" language="*"/>
    </dependentAssembly>
  </dependency>
  <compatibility xmlns="urn:schemas-microsoft-com:compatibility.v1">
    <application>
      <!-- Windows 10 & Windows 11 -->
      <supportedOS Id="{8e0f7a12-bfb3-4fe8-b9a5-48fd50a15a9a}"/>
      <!-- Windows 8.1 -->
      <supportedOS Id="{1f676c76-80e1-4239-95bb-83d0f6d0da78}"/>
    </application>
  </compatibility>
  <asmv3:application>
    <asmv3:windowsSettings>
      <dpiAware xmlns="http://schemas.microsoft.com/SMI/2005/WindowsSettings">true/pm</dpiAware>
      <dpiAwareness xmlns="http://schemas.microsoft.com/SMI/2016/WindowsSettings">PerMonitorV2, PerMonitor</dpiAwareness>
    </asmv3:windowsSettings>
  </asmv3:application>
</assembly>
EOF

cd build/res
x86_64-w64-mingw32-windres resource.rc -O coff -o resource.res
cd "$PROJECT_ROOT"

# 3. Write C++ Native Windows Host Application
echo "[3/6] Compiling DALTEK.exe native 64-bit Windows binary..."
cat << 'EOF' > build/main.cpp
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <shellapi.h>
#include <string>
#include <vector>

const wchar_t* DALTEK_APP_TITLE = L"DALTEK — Système de Gestion de File d'Attente";
const wchar_t* DALTEK_BACKEND_URL = L"https://ais-pre-h57hoexwhutai4uvntr75c-246438389907.europe-west2.run.app";

// Helper to launch Microsoft Edge in standalone Application Mode (PWA kiosk shell)
bool LaunchAppMode(const std::wstring& targetUrl) {
    // 1. Try Microsoft Edge (Standard on Windows 10 & 11)
    std::wstring edgeArgs = L"--app=" + targetUrl + L" --window-size=1280,800 --enable-features=OverlayScrollbar";
    
    // Check Program Files for Edge
    wchar_t progFiles[MAX_PATH];
    if (GetEnvironmentVariableW(L"ProgramFiles(x86)", progFiles, MAX_PATH) > 0) {
        std::wstring edgePath = std::wstring(progFiles) + L"\\Microsoft\\Edge\\Application\\msedge.exe";
        HINSTANCE hInst = ShellExecuteW(NULL, L"open", edgePath.c_str(), edgeArgs.c_str(), NULL, SW_SHOWNORMAL);
        if ((INT_PTR)hInst > 32) return true;
    }
    
    if (GetEnvironmentVariableW(L"ProgramFiles", progFiles, MAX_PATH) > 0) {
        std::wstring edgePath = std::wstring(progFiles) + L"\\Microsoft\\Edge\\Application\\msedge.exe";
        HINSTANCE hInst = ShellExecuteW(NULL, L"open", edgePath.c_str(), edgeArgs.c_str(), NULL, SW_SHOWNORMAL);
        if ((INT_PTR)hInst > 32) return true;
    }

    // 2. Direct msedge execution via PATH
    HINSTANCE hInst = ShellExecuteW(NULL, L"open", L"msedge.exe", edgeArgs.c_str(), NULL, SW_SHOWNORMAL);
    if ((INT_PTR)hInst > 32) return true;

    // 3. Fallback: Default system browser
    HINSTANCE hInstBrowser = ShellExecuteW(NULL, L"open", targetUrl.c_str(), NULL, NULL, SW_SHOWNORMAL);
    return ((INT_PTR)hInstBrowser > 32);
}

int WINAPI wWinMain(HINSTANCE hInstance, HINSTANCE hPrevInstance, PWSTR pCmdLine, int nCmdShow) {
    // Enable Visual Styles & Dark mode awareness
    SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);

    // Prevent multiple unnecessary instances or launch immediately
    std::wstring url = DALTEK_BACKEND_URL;
    if (pCmdLine && wcslen(pCmdLine) > 0) {
        // If query parameters or tab route passed
        std::wstring cmd(pCmdLine);
        if (cmd.find(L"http") == 0) {
            url = cmd;
        }
    }

    if (!LaunchAppMode(url)) {
        MessageBoxW(NULL, 
            L"Impossible de lancer DALTEK. Vérifiez votre connexion Internet.", 
            DALTEK_APP_TITLE, 
            MB_ICONERROR | MB_OK);
        return 1;
    }

    return 0;
}
EOF

x86_64-w64-mingw32-g++-posix -O3 -mwindows -municode \
    -static -static-libgcc -static-libstdc++ \
    build/main.cpp build/res/resource.res \
    -o build/bin/DALTEK.exe \
    -lkernel32 -luser32 -lshell32 -lole32 -lshlwapi

x86_64-w64-mingw32-strip build/bin/DALTEK.exe
echo "DALTEK.exe compiled successfully! Size: $(ls -lh build/bin/DALTEK.exe | awk '{print $5}')"

# 4. Generate WiX MSI Installer (DALTEK-Windows.msi)
echo "[4/6] Generating Native Windows Installer Package (DALTEK-Windows.msi)..."
mkdir -p build/msi_build
cp build/bin/DALTEK.exe build/msi_build/
cp build/res/daltek.ico build/msi_build/

cat << 'EOF' > build/msi_build/daltek.wxs
<?xml version="1.0" encoding="utf-8"?>
<Wix xmlns="http://schemas.microsoft.com/wix/2006/wi">
  <Product Id="*" 
           Name="DALTEK" 
           Language="1036" 
           Version="1.2.0" 
           Manufacturer="DALTEK Systems" 
           UpgradeCode="4C687C2E-BC32-4412-A1C8-D8A8269D1E6F">
    
    <Package Description="Système de Gestion de File d'Attente DALTEK"
             Comments="Package d'installation officiel DALTEK Windows"
             Manufacturer="DALTEK Systems"
             InstallerVersion="200"
             Compressed="yes"
             InstallScope="perUser" />

    <Media Id="1" Cabinet="daltek.cab" EmbedCab="yes" />

    <Directory Id="TARGETDIR" Name="SourceDir">
      <Directory Id="LocalAppDataFolder">
        <Directory Id="ProgramsFolder" Name="Programs">
          <Directory Id="INSTALLFOLDER" Name="DALTEK">
            <Component Id="MainExecutable" Guid="8F54687C-BC32-4412-A1C8-D8A8269D1E6F">
              <File Id="DALTEKEXE" Source="DALTEK.exe" KeyPath="yes">
                <Shortcut Id="ApplicationStartMenuShortcut" 
                          Directory="ProgramMenuDir" 
                          Name="DALTEK" 
                          Description="Système de Gestion de File DALTEK"
                          WorkingDirectory="INSTALLFOLDER" 
                          Icon="DALTEKIcon.ico" 
                          IconIndex="0" 
                          Advertise="yes" />
                <Shortcut Id="ApplicationDesktopShortcut" 
                          Directory="DesktopFolder" 
                          Name="DALTEK" 
                          Description="Système de Gestion de File DALTEK"
                          WorkingDirectory="INSTALLFOLDER" 
                          Icon="DALTEKIcon.ico" 
                          IconIndex="0" 
                          Advertise="yes" />
              </File>
              <RemoveFolder Id="INSTALLFOLDER" On="uninstall" />
            </Component>
          </Directory>
        </Directory>
      </Directory>
      <Directory Id="ProgramMenuFolder">
        <Directory Id="ProgramMenuDir" Name="DALTEK">
          <Component Id="ProgramMenuDirComp" Guid="A2B4C6D8-1E3F-4567-89AB-CDEF01234567">
            <RemoveFolder Id="ProgramMenuDir" On="uninstall" />
            <RegistryValue Root="HKCU" Key="Software\DALTEK\Uninstall" Type="integer" Value="1" KeyPath="yes" />
          </Component>
        </Directory>
      </Directory>
      <Directory Id="DesktopFolder" Name="Desktop" />
    </Directory>

    <Icon Id="DALTEKIcon.ico" SourceFile="daltek.ico" />
    <Property Id="ARPPRODUCTICON" Value="DALTEKIcon.ico" />
    <Property Id="ARPHELPLINK" Value="https://daltek.app" />

    <Feature Id="Complete" Level="1">
      <ComponentRef Id="MainExecutable" />
      <ComponentRef Id="ProgramMenuDirComp" />
    </Feature>
  </Product>
</Wix>
EOF

cd build/msi_build
wixl -v -a x64 -o "${PROJECT_ROOT}/build/bin/DALTEK-Windows.msi" daltek.wxs
cd "$PROJECT_ROOT"

# 5. Generate NSIS Installer (DALTEK-Windows-Setup.exe) with 64-bit awareness
echo "[5/6] Generating Windows NSIS Installer (DALTEK-Windows-Setup.exe)..."
cat << 'EOF' > build/installer.nsi
Unicode True
SetCompressor /SOLID lzma

!define APPNAME "DALTEK"
!define COMPANYNAME "DALTEK Systems"
!define DESCRIPTION "Système de Gestion de File d'Attente DALTEK"
!define VERSIONMAJOR 1
!define VERSIONMINOR 2
!define VERSIONBUILD 0
!define APP_EXE "DALTEK.exe"

Name "${APPNAME}"
OutFile "bin/DALTEK-Windows-Setup.exe"
InstallDir "$LOCALAPPDATA\Programs\DALTEK"
InstallDirRegKey HKCU "Software\DALTEK" "Install_Dir"
RequestExecutionLevel user

VIProductVersion "1.2.0.0"
VIAddVersionKey "ProductName" "${APPNAME}"
VIAddVersionKey "CompanyName" "${COMPANYNAME}"
VIAddVersionKey "LegalCopyright" "Copyright (C) 2026 DALTEK INC"
VIAddVersionKey "FileDescription" "${DESCRIPTION}"
VIAddVersionKey "FileVersion" "1.2.0.0"

!include "MUI2.nsh"
!include "FileFunc.nsh"
!include "x64.nsh"
!include "LogicLib.nsh"

# Custom Modern Interface Theme (DALTEK Dark & Gold)
!define MUI_ICON "res/daltek.ico"
!define MUI_UNICON "res/daltek.ico"
!define MUI_ABORTWARNING

# Installer Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES

# Finish Page
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APP_EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "Lancer DALTEK maintenant"
!insertmacro MUI_PAGE_FINISH

# Uninstaller Pages
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "French"

Function .onInit
    ${If} ${RunningX64}
        SetRegView 64
    ${EndIf}
FunctionEnd

Function un.onInit
    ${If} ${RunningX64}
        SetRegView 64
    ${EndIf}
FunctionEnd

Section "DALTEK (requis)" SecMain
    SectionIn RO

    SetOutPath "$INSTDIR"
    File "bin/DALTEK.exe"
    File "res/daltek.ico"

    # Write Uninstaller
    WriteUninstaller "$INSTDIR\Uninstall.exe"

    # Create Shortcuts in Start Menu
    CreateDirectory "$SMPROGRAMS\DALTEK"
    CreateShortcut "$SMPROGRAMS\DALTEK\DALTEK.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\daltek.ico" 0
    CreateShortcut "$SMPROGRAMS\DALTEK\Désinstaller DALTEK.lnk" "$INSTDIR\Uninstall.exe" "" "" 0

    # Create Desktop Shortcut
    CreateShortcut "$DESKTOP\DALTEK.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\daltek.ico" 0

    # Write Registry for Windows Apps & Features
    WriteRegStr HKCU "Software\DALTEK" "Install_Dir" "$INSTDIR"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DALTEK" "DisplayName" "DALTEK - Gestion de File"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DALTEK" "DisplayIcon" "$INSTDIR\daltek.ico"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DALTEK" "DisplayVersion" "1.2.0"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DALTEK" "Publisher" "DALTEK Systems"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DALTEK" "UninstallString" "$INSTDIR\Uninstall.exe"
    WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DALTEK" "NoModify" 1
    WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DALTEK" "NoRepair" 1
SectionEnd

Section "Uninstall"
    # Remove files
    Delete "$INSTDIR\DALTEK.exe"
    Delete "$INSTDIR\daltek.ico"
    Delete "$INSTDIR\Uninstall.exe"
    RMDir "$INSTDIR"

    # Remove Shortcuts
    Delete "$SMPROGRAMS\DALTEK\DALTEK.lnk"
    Delete "$SMPROGRAMS\DALTEK\Désinstaller DALTEK.lnk"
    RMDir "$SMPROGRAMS\DALTEK"
    Delete "$DESKTOP\DALTEK.lnk"

    # Remove Registry Keys
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\DALTEK"
    DeleteRegKey HKCU "Software\DALTEK"
SectionEnd
EOF

cd "$PROJECT_ROOT/build"
makensis installer.nsi
cd "$PROJECT_ROOT"

# 6. Copy Binaries to Storage and Public directories
echo "[6/6] Deploying Windows binaries to download paths..."
cp build/bin/DALTEK-Windows-Setup.exe "$OUTPUT_DIR/DALTEK-Windows-Setup.exe"
cp build/bin/DALTEK-Windows-Setup.exe "$OUTPUT_DIR/DALTEK-Windows.exe"
cp build/bin/DALTEK-Windows-Setup.exe "$PUBLIC_DIR/DALTEK-Windows-Setup.exe"

cp build/bin/DALTEK-Windows.msi "$OUTPUT_DIR/DALTEK-Windows.msi"
cp build/bin/DALTEK-Windows.msi "$PUBLIC_DIR/DALTEK-Windows.msi"

cp build/bin/DALTEK.exe "$OUTPUT_DIR/DALTEK-Standalone.exe"
cp build/bin/DALTEK.exe "$PUBLIC_DIR/DALTEK.exe"

echo "=========================================================="
echo "    WINDOWS BUILD SUCCESSFUL!                             "
echo "=========================================================="
ls -lh "$OUTPUT_DIR/DALTEK-Windows-Setup.exe"
ls -lh "$OUTPUT_DIR/DALTEK-Windows.msi"
ls -lh "$OUTPUT_DIR/DALTEK-Standalone.exe"
file "$OUTPUT_DIR/DALTEK-Windows-Setup.exe"
file "$OUTPUT_DIR/DALTEK-Windows.msi"
file "$OUTPUT_DIR/DALTEK-Standalone.exe"
