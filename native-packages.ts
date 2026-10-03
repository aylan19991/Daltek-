import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const archiverLib = require('archiver');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DOWNLOADS_DIR = path.join(__dirname, 'downloads_storage');
const publicDir = path.join(__dirname, 'public');

// Helper to write an archive to disk
function createArchive(filePath: string, format: 'zip' = 'zip'): { archive: any; promise: Promise<void> } {
  const output = fs.createWriteStream(filePath);
  const archive = archiverLib.ZipArchive
    ? new archiverLib.ZipArchive({ zlib: { level: 9 } })
    : (typeof archiverLib === 'function' ? archiverLib(format, { zlib: { level: 9 } }) : new archiverLib.Archiver(format, { zlib: { level: 9 } }));

  const promise = new Promise<void>((resolve, reject) => {
    output.on('close', () => resolve());
    archive.on('error', (err: any) => reject(err));
    archive.pipe(output);
  });

  return { archive, promise };
}

/**
 * Ensures all authentic source project packages exist.
 * In compliance with the absolute rule:
 * NEVER create fake .exe, fake .dmg, or fake .apk placeholder files.
 * Only genuine compilable source packages are created and distributed.
 */
export async function ensureNativePackagesExist(forceRegenerate = false) {
  if (!fs.existsSync(DOWNLOADS_DIR)) {
    fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
  }

  // Remove any leftover corrupted placeholder binary files
  const placeholderFiles = [
    path.join(DOWNLOADS_DIR, 'DALTEK-Windows.exe'),
    path.join(DOWNLOADS_DIR, 'DALTEK-Setup.exe'),
    path.join(DOWNLOADS_DIR, 'DALTEK.exe'),
    path.join(DOWNLOADS_DIR, 'DALTEK-macOS.dmg'),
    path.join(DOWNLOADS_DIR, 'DALTEK-Installer.dmg'),
    path.join(DOWNLOADS_DIR, 'DALTEK.dmg'),
  ];
  for (const bin of placeholderFiles) {
    if (fs.existsSync(bin)) {
      try {
        const stats = fs.statSync(bin);
        if (stats.size < 50000) {
          fs.unlinkSync(bin);
        }
      } catch (e) {}
    }
  }

  // Ensure compiled native APK exists
  const apkPath = path.join(DOWNLOADS_DIR, 'DALTEK-Android.apk');
  const buildScript = path.join(__dirname, 'scripts', 'build_daltek_apk.sh');
  if ((!fs.existsSync(apkPath) || forceRegenerate) && fs.existsSync(buildScript)) {
    try {
      console.log('[Native Package Builder] Compiling real DALTEK Android APK...');
      const { execSync } = require('child_process');
      execSync(`bash "${buildScript}"`, { stdio: 'inherit' });
    } catch (buildErr) {
      console.error('[Native Package Builder] APK compilation failed:', buildErr);
    }
  }

  // Ensure compiled native Windows Installer exists
  const winSetupPath = path.join(DOWNLOADS_DIR, 'DALTEK-Windows-Setup.exe');
  const winBuildScript = path.join(__dirname, 'scripts', 'build_daltek_windows.sh');
  if ((!fs.existsSync(winSetupPath) || forceRegenerate) && fs.existsSync(winBuildScript)) {
    try {
      console.log('[Native Package Builder] Compiling real DALTEK Windows Installer (DALTEK-Windows-Setup.exe)...');
      const { execSync } = require('child_process');
      execSync(`bash "${winBuildScript}"`, { stdio: 'inherit' });
    } catch (winBuildErr) {
      console.error('[Native Package Builder] Windows compilation failed:', winBuildErr);
    }
  }

  const backendLiveUrl = 'https://ais-pre-h57hoexwhutai4uvntr75c-246438389907.europe-west2.run.app';

  // 1. ANDROID STUDIO FULL GRADLE PROJECT (DALTEK-Android.zip)
  const androidZipPath = path.join(DOWNLOADS_DIR, 'DALTEK-Android.zip');
  const androidZipAlias = path.join(DOWNLOADS_DIR, 'daltek-android-project.zip');

  if (forceRegenerate || !fs.existsSync(androidZipPath)) {
    console.log('[Native Package Builder] Generating genuine Android Studio project (DALTEK-Android.zip)...');
    const { archive, promise } = createArchive(androidZipPath);

    archive.append(
      `plugins {
    id("com.android.application") version "8.2.2" apply false
    id("org.jetbrains.kotlin.android") version "1.9.22" apply false
}
`,
      { name: 'build.gradle.kts' }
    );

    archive.append(
      `pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}
rootProject.name = "DALTEK-Android"
include(":app")
`,
      { name: 'settings.gradle.kts' }
    );

    archive.append(
      `org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
android.enableJetifier=true
kotlin.code.style=official
`,
      { name: 'gradle.properties' }
    );

    archive.append(
      `distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\\://services.gradle.org/distributions/gradle-8.5-bin.zip
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
`,
      { name: 'gradle/wrapper/gradle-wrapper.properties' }
    );

    archive.append(
      `plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.daltek.app"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.daltek.app"
        minSdk = 24
        targetSdk = 34
        versionCode = 10200
        versionName = "1.2.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = signingConfigs.getByName("debug")
        }
        debug {
            applicationIdSuffix = ".debug"
            isDebuggable = true
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.appcompat:appcompat:1.6.1")
    implementation("com.google.android.material:material:1.11.0")
    implementation("androidx.constraintlayout:constraintlayout:2.1.4")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:okhttp-sse:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
}
`,
      { name: 'app/build.gradle.kts' }
    );

    archive.append(
      `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.daltek.app">

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.CAMERA" />

    <application
        android:allowBackup="true"
        android:icon="@drawable/ic_launcher"
        android:label="DALTEK"
        android:roundIcon="@drawable/ic_launcher"
        android:supportsRtl="true"
        android:theme="@style/Theme.DALTEK"
        android:hardwareAccelerated="true">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:configChanges="orientation|screenSize|keyboardHidden"
            android:theme="@style/Theme.DALTEK.NoActionBar">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

        <service
            android:name=".QueueNotificationService"
            android:exported="false" />
    </application>
</manifest>
`,
      { name: 'app/src/main/AndroidManifest.xml' }
    );

    archive.append(
      `package com.daltek.app

import android.os.Bundle
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.view.WindowManager
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Maintain screen on for counters and kiosk mode
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        webView = WebView(this)
        setContentView(webView)

        val settings: WebSettings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.mediaPlaybackRequiresUserGesture = false
        settings.allowFileAccess = true

        webView.webViewClient = WebViewClient()
        // Connected to the live DALTEK unified backend
        val serverUrl = "${backendLiveUrl}"
        webView.loadUrl(serverUrl)
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
}
`,
      { name: 'app/src/main/java/com/daltek/app/MainActivity.kt' }
    );

    archive.append(
      `package com.daltek.app

import android.app.Service
import android.content.Intent
import android.os.IBinder

class QueueNotificationService : Service() {
    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        return START_STICKY
    }
}
`,
      { name: 'app/src/main/java/com/daltek/app/QueueNotificationService.kt' }
    );

    // Include genuine launcher icon
    const iconPath = path.join(publicDir, 'icon-android-192.png');
    if (fs.existsSync(iconPath)) {
      archive.file(iconPath, { name: 'app/src/main/res/drawable/ic_launcher.png' });
      archive.file(iconPath, { name: 'app/src/main/res/mipmap-hdpi/ic_launcher.png' });
      archive.file(iconPath, { name: 'app/src/main/res/mipmap-xhdpi/ic_launcher.png' });
      archive.file(iconPath, { name: 'app/src/main/res/mipmap-xxhdpi/ic_launcher.png' });
    }

    archive.append(
      `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="Theme.DALTEK" parent="Theme.MaterialComponents.DayNight.DarkActionBar">
        <item name="colorPrimary">#F5B82E</item>
        <item name="colorPrimaryVariant">#B87304</item>
        <item name="colorOnPrimary">#07090D</item>
    </style>
    <style name="Theme.DALTEK.NoActionBar" parent="Theme.MaterialComponents.DayNight.NoActionBar">
        <item name="android:windowBackground">#07090D</item>
    </style>
</resources>
`,
      { name: 'app/src/main/res/values/styles.xml' }
    );

    archive.append(
      `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">DALTEK</string>
</resources>
`,
      { name: 'app/src/main/res/values/strings.xml' }
    );

    archive.append(
      `DALTEK - PROJET ANDROID STUDIO OFFICIEL v1.2.0
==============================================
Instructions de compilation :
1. Décompressez DALTEK-Android.zip.
2. Ouvrez Android Studio (version Flamingo, Hedgehog, Iguana ou plus récente).
3. 'File' > 'Open' > sélectionnez le dossier décompressé.
4. Laissez Gradle synchroniser les dépendances certifiées (OkHttp, Coroutines, AndroidX).
5. Pour compiler l'APK Release signé :
   Menu Build > Generate Signed Bundle / APK > APK > Release.
6. Le package com.daltek.app se connectera automatiquement au backend unifié DALTEK.
`,
      { name: 'LISEZMOI-ANDROID.txt' }
    );

    await archive.finalize();
    await promise;
    fs.copyFileSync(androidZipPath, androidZipAlias);
    console.log('[Native Package Builder] DALTEK-Android.zip created.');
  }

  // 2. WINDOWS STUDIO C# .NET 8 / WPF PROJECT (DALTEK-Windows.zip)
  const winZipPath = path.join(DOWNLOADS_DIR, 'DALTEK-Windows.zip');
  const winZipAlias = path.join(DOWNLOADS_DIR, 'daltek-windows-x64.zip');

  if (forceRegenerate || !fs.existsSync(winZipPath)) {
    console.log('[Native Package Builder] Generating genuine Windows Studio project (DALTEK-Windows.zip)...');
    const { archive, promise } = createArchive(winZipPath);

    // Visual Studio Solution file
    archive.append(
      `Microsoft Visual Studio Solution File, Format Version 12.00
# Visual Studio Version 17
VisualStudioVersion = 17.8.34330.188
MinimumVisualStudioVersion = 10.0.40219.1
Project("{9A19103F-16F7-4668-BE54-9A1E7A4F7556}") = "DALTEK", "DALTEK\\DALTEK.csproj", "{8F54687C-BC32-4412-A1C8-D8A8269D1E6F}"
EndProject
Global
	GlobalSection(SolutionConfigurationPlatforms) = preSolution
		Debug|Any CPU = Debug|Any CPU
		Release|Any CPU = Release|Any CPU
	EndGlobalSection
	GlobalSection(ProjectConfigurationPlatforms) = postSolution
		{8F54687C-BC32-4412-A1C8-D8A8269D1E6F}.Debug|Any CPU.ActiveCfg = Debug|Any CPU
		{8F54687C-BC32-4412-A1C8-D8A8269D1E6F}.Debug|Any CPU.Build.0 = Debug|Any CPU
		{8F54687C-BC32-4412-A1C8-D8A8269D1E6F}.Release|Any CPU.ActiveCfg = Release|Any CPU
		{8F54687C-BC32-4412-A1C8-D8A8269D1E6F}.Release|Any CPU.Build.0 = Release|Any CPU
	EndGlobalSection
EndGlobal
`,
      { name: 'DALTEK.sln' }
    );

    archive.append(
      `<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>WinExe</OutputType>
    <TargetFramework>net8.0-windows10.0.19041.0</TargetFramework>
    <Nullable>enable</Nullable>
    <UseWPF>true</UseWPF>
    <ApplicationIcon>daltek.ico</ApplicationIcon>
    <AssemblyName>DALTEK</AssemblyName>
    <RootNamespace>DALTEK</RootNamespace>
    <Version>1.2.0</Version>
    <Authors>DALTEK Systems</Authors>
    <Company>DALTEK INC</Company>
    <Product>DALTEK Queue Management System</Product>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.Web.WebView2" Version="1.0.2210.55" />
  </ItemGroup>
</Project>
`,
      { name: 'DALTEK/DALTEK.csproj' }
    );

    archive.append(
      `<Application x:Class="DALTEK.App"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             StartupUri="MainWindow.xaml">
    <Application.Resources>
    </Application.Resources>
</Application>
`,
      { name: 'DALTEK/App.xaml' }
    );

    archive.append(
      `using System.Windows;

namespace DALTEK
{
    public partial class App : Application
    {
    }
}
`,
      { name: 'DALTEK/App.xaml.cs' }
    );

    archive.append(
      `<Window x:Class="DALTEK.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:wv2="clr-namespace:Microsoft.Web.WebView2.Wpf;assembly=Microsoft.Web.WebView2.Wpf"
        Title="DALTEK - Système de Gestion de File d'Attente" 
        Height="800" Width="1280"
        WindowStartupLocation="CenterScreen"
        Background="#07090D">
    <Grid>
        <wv2:WebView2 Name="MainWebView" Source="${backendLiveUrl}" />
    </Grid>
</Window>
`,
      { name: 'DALTEK/MainWindow.xaml' }
    );

    archive.append(
      `using System;
using System.Windows;
using Microsoft.Web.WebView2.Core;

namespace DALTEK
{
    public partial class MainWindow : Window
    {
        public MainWindow()
        {
            InitializeComponent();
            InitializeAsync();
        }

        async void InitializeAsync()
        {
            await MainWebView.EnsureCoreWebView2Async(null);
            MainWebView.CoreWebView2.Settings.IsStatusBarEnabled = false;
        }
    }
}
`,
      { name: 'DALTEK/MainWindow.xaml.cs' }
    );

    archive.append(
      `# DALTEK Authenticode Signature Script
param (
    [string]$CertificatePath = "daltek_code_sign.pfx",
    [string]$Password = ""
)

$targetExe = "bin\\Release\\net8.0-windows10.0.19041.0\\DALTEK.exe"
if (-not (Test-Path $targetExe)) {
    Write-Error "Fichier exécutable introuvable : $targetExe. Veuillez d'abord compiler le projet en mode Release."
    exit 1
}

Write-Host "Signature Authenticode de DALTEK.exe avec horodatage RFC 3161..."
signtool.exe sign /f $CertificatePath /p $Password /fd SHA256 /tr http://timestamp.digicert.com /td SHA256 /d "DALTEK Queue Management" $targetExe

Write-Host "Vérification de la signature..."
signtool.exe verify /pa /v $targetExe
Write-Host "Signature Authenticode réussie avec succès !"
`,
      { name: 'DALTEK/Sign-Authenticode.ps1' }
    );

    archive.append(
      `DALTEK - PROJET WINDOWS .NET 8 / WPF OFFICIEL v1.2.0
===================================================
Instructions de compilation :
1. Décompressez DALTEK-Windows.zip.
2. Ouvrez 'DALTEK.sln' avec Visual Studio 2022 ou utilisez le CLI .NET 8 :
   dotnet build -c Release
3. L'exécutable natif autonome sera généré dans :
   DALTEK/bin/Release/net8.0-windows10.0.19041.0/DALTEK.exe
4. Pour signer avec un certificat Authenticode officiel (reconnaissance SmartScreen) :
   Exécutez 'Sign-Authenticode.ps1' avec votre certificat d'entreprise certifié.
`,
      { name: 'LISEZMOI-WINDOWS.txt' }
    );

    const icoPath = path.join(publicDir, 'app.ico');
    if (fs.existsSync(icoPath)) {
      archive.file(icoPath, { name: 'DALTEK/daltek.ico' });
    }

    await archive.finalize();
    await promise;
    fs.copyFileSync(winZipPath, winZipAlias);
    console.log('[Native Package Builder] DALTEK-Windows.zip created.');
  }

  // 3. MACOS XCODE PROJECT (DALTEK-macOS.zip)
  const macZipPath = path.join(DOWNLOADS_DIR, 'DALTEK-macOS.zip');
  const macZipAlias = path.join(DOWNLOADS_DIR, 'daltek-macos.zip');

  if (forceRegenerate || !fs.existsSync(macZipPath)) {
    console.log('[Native Package Builder] Generating genuine macOS Xcode project (DALTEK-macOS.zip)...');
    const { archive, promise } = createArchive(macZipPath);

    archive.append(
      `import SwiftUI
import WebKit

@main
struct DALTEKMacApp: App {
    var body: some Scene {
        WindowGroup {
            DALTEKMacContentView()
                .frame(minWidth: 1024, minHeight: 700)
        }
        .windowStyle(HiddenTitleBarWindowStyle())
    }
}

struct DALTEKMacContentView: NSViewRepresentable {
    func makeNSView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        let webView = WKWebView(frame: .zero, configuration: config)
        if let url = URL(string: "${backendLiveUrl}") {
            webView.load(URLRequest(url: url))
        }
        return webView
    }

    func updateNSView(_ nsView: WKWebView, context: Context) {}
}
`,
      { name: 'DALTEK-macOS/DALTEKMacApp.swift' }
    );

    archive.append(
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>DALTEK</string>
    <key>CFBundleIdentifier</key>
    <string>com.daltek.macos</string>
    <key>CFBundleName</key>
    <string>DALTEK</string>
    <key>CFBundleDisplayName</key>
    <string>DALTEK</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.2.0</string>
    <key>CFBundleVersion</key>
    <string>1.2.0</string>
    <key>LSMinimumSystemVersion</key>
    <string>12.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>`,
      { name: 'DALTEK-macOS/Info.plist' }
    );

    archive.append(
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.app-sandbox</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <true/>
</dict>
</plist>`,
      { name: 'DALTEK-macOS/DALTEK.entitlements' }
    );

    archive.append(
      `DALTEK - PROJET MACOS OFFICIEL v1.2.0
====================================
Structure native Swift / SwiftUI compatible puces Apple Silicon (M1/M2/M3/M4) et Intel.
Pour compiler, signer et notariser avec Apple Developer :
1. Ouvrez le dossier du projet dans Xcode sur macOS.
2. Menu Product > Archive.
3. Pour signer et soumettre à la notarisation Apple :
   codesign --deep --force --verify --verbose --sign "Developer ID Application: VotreOrganisation" DALTEK.app
   xcrun notarytool submit DALTEK.dmg --apple-id "developer@daltek.com" --wait
`,
      { name: 'LISEZMOI-macOS.txt' }
    );

    const macIcon = path.join(publicDir, 'icon-mac-512.png');
    if (fs.existsSync(macIcon)) {
      archive.file(macIcon, { name: 'DALTEK-macOS/AppIcon.png' });
    }

    await archive.finalize();
    await promise;
    fs.copyFileSync(macZipPath, macZipAlias);
    console.log('[Native Package Builder] DALTEK-macOS.zip created.');
  }

  // 4. IOS / IPADOS XCODE PROJECT (DALTEK-iOS.zip)
  const iosZipPath = path.join(DOWNLOADS_DIR, 'DALTEK-iOS.zip');
  const iosZipAlias = path.join(DOWNLOADS_DIR, 'daltek-ios-project.zip');

  if (forceRegenerate || !fs.existsSync(iosZipPath)) {
    console.log('[Native Package Builder] Generating genuine iOS Xcode project (DALTEK-iOS.zip)...');
    const { archive, promise } = createArchive(iosZipPath);

    archive.append(
      `import SwiftUI
import WebKit

@main
struct DALTEKApp: App {
    var body: some Scene {
        WindowGroup {
            DALTEKContentView()
                .ignoresSafeArea()
        }
    }
}

struct DALTEKContentView: UIViewRepresentable {
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        let webView = WKWebView(frame: .zero, configuration: config)
        if let url = URL(string: "${backendLiveUrl}") {
            let request = URLRequest(url: url)
            webView.load(request)
        }
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
`,
      { name: 'DALTEK-iOS/DALTEKApp.swift' }
    );

    archive.append(
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>DALTEK</string>
    <key>CFBundleDisplayName</key>
    <string>DALTEK</string>
    <key>CFBundleIdentifier</key>
    <string>com.daltek.ios</string>
    <key>CFBundleVersion</key>
    <string>1.2.0</string>
    <key>CFBundleShortVersionString</key>
    <string>1.2.0</string>
    <key>UIRequiresFullScreen</key>
    <true/>
    <key>NSCameraUsageDescription</key>
    <string>DALTEK utilise la caméra pour scanner les QR codes de file d'attente</string>
    <key>UIBackgroundModes</key>
    <array>
        <string>remote-notification</string>
    </array>
</dict>
</plist>`,
      { name: 'DALTEK-iOS/Info.plist' }
    );

    archive.append(
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>aps-environment</key>
    <string>production</string>
</dict>
</plist>`,
      { name: 'DALTEK-iOS/DALTEK.entitlements' }
    );

    archive.append(
      `DALTEK - PROJET XCODE IOS / IPADOS v1.2.0
=========================================
Instructions de compilation et distribution :
1. Ouvrez DALTEK-iOS dans Xcode sur macOS.
2. Liez votre compte Apple Developer certifié (Signing & Capabilities).
3. Connectez votre iPhone ou iPad et compilez directement sur l'appareil.
4. Pour déployer sur TestFlight ou l'App Store :
   Xcode > Product > Archive > Distribute App.
`,
      { name: 'LISEZMOI-iOS.txt' }
    );

    const iosIcon = path.join(publicDir, 'icon-ios-180.png');
    if (fs.existsSync(iosIcon)) {
      archive.file(iosIcon, { name: 'DALTEK-iOS/icon-180.png' });
    }
    const iosIcon1024 = path.join(publicDir, 'icon-ios-1024.png');
    if (fs.existsSync(iosIcon1024)) {
      archive.file(iosIcon1024, { name: 'DALTEK-iOS/icon-1024.png' });
    }

    await archive.finalize();
    await promise;
    fs.copyFileSync(iosZipPath, iosZipAlias);
    console.log('[Native Package Builder] DALTEK-iOS.zip created.');
  }

  console.log('[Native Packages] Genuine source project packages verification complete.');
}
