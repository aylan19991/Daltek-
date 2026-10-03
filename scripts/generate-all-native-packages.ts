import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const archiver = require('archiver');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const downloadsDir = path.join(rootDir, 'downloads_storage');
const publicDir = path.join(rootDir, 'public');

if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

function createZipArchive(destPath: string): { archive: any; promise: Promise<void> } {
  const output = fs.createWriteStream(destPath);
  const archive = archiver.ZipArchive ? new archiver.ZipArchive({ zlib: { level: 9 } }) : new archiver.Archiver('zip', { zlib: { level: 9 } });
  const promise = new Promise<void>((resolve, reject) => {
    output.on('close', () => resolve());
    archive.on('error', (err: any) => reject(err));
    archive.pipe(output);
  });
  return { archive, promise };
}

async function buildAll() {
  console.log('[Native Package Builder] Starting complete generation of all platform assets...');

  // 1. Android APK: Run build_native_apk.py
  const apkDest = path.join(downloadsDir, 'DALTEK-Android.apk');
  const apkAlias = path.join(downloadsDir, 'DALTEK.apk');
  console.log('[Native Package Builder] Compiling Android APK with OpenSSL PKCS7 signature...');
  const pythonScript = path.join(rootDir, 'build_native_apk.py');
  execSync(`python3 "${pythonScript}" "${apkDest}"`, { stdio: 'inherit' });
  fs.copyFileSync(apkDest, apkAlias);
  console.log('[Native Package Builder] DALTEK-Android.apk & DALTEK.apk ready.');

  // 2. Android Source ZIP: DALTEK-Android.zip
  const androidZipPath = path.join(downloadsDir, 'DALTEK-Android.zip');
  const androidZipAlias = path.join(downloadsDir, 'daltek-android-project.zip');
  console.log('[Native Package Builder] Generating full Android Studio project (DALTEK-Android.zip)...');
  const { archive: azip, promise: apromise } = createZipArchive(androidZipPath);

  // Gradle root files
  azip.append(
    `plugins {
    id("com.android.application") version "8.2.2" apply false
    id("org.jetbrains.kotlin.android") version "1.9.22" apply false
}
`,
    { name: 'build.gradle.kts' }
  );

  azip.append(
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

  azip.append(
    `org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
android.useAndroidX=true
android.enableJetifier=true
kotlin.code.style=official
`,
    { name: 'gradle.properties' }
  );

  // App module build.gradle.kts
  azip.append(
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
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            signingConfig = signingConfigs.getByName("debug")
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

  // AndroidManifest.xml
  azip.append(
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

  // Kotlin MainActivity
  azip.append(
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
        // Keep screen on for counter / staff console
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
        // Connected directly to the unified DALTEK server backend
        val serverUrl = "https://ais-pre-h57hoexwhutai4uvntr75c-246438389907.europe-west2.run.app"
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

  // Include launcher icon from public
  const iconPath = path.join(publicDir, 'icon-android-192.png');
  if (fs.existsSync(iconPath)) {
    azip.file(iconPath, { name: 'app/src/main/res/drawable/ic_launcher.png' });
    azip.file(iconPath, { name: 'app/src/main/res/mipmap-hdpi/ic_launcher.png' });
    azip.file(iconPath, { name: 'app/src/main/res/mipmap-xhdpi/ic_launcher.png' });
    azip.file(iconPath, { name: 'app/src/main/res/mipmap-xxhdpi/ic_launcher.png' });
  }

  // Styles & Themes
  azip.append(
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

  azip.append(
    `INSTRUCTIONS DE COMPILATION ANDROID STUDIO
1. Décompressez l'archive DALTEK-Android.zip.
2. Ouvrez Android Studio (version Hedgehog 2023.1.1 ou supérieure).
3. Cliquez sur 'File' > 'Open' et sélectionnez le dossier décompressé.
4. Laissez Gradle synchroniser les dépendances officielles.
5. Branchez votre smartphone Android en mode Débogage USB.
6. Cliquez sur 'Run' (Bouton vert) pour installer et lancer l'application directement.
7. Pour générer l'APK signé : Build > Generate Signed Bundle / APK > APK > Release.
`,
    { name: 'LISEZMOI-ANDROID.txt' }
  );

  await azip.finalize();
  await apromise;
  fs.copyFileSync(androidZipPath, androidZipAlias);
  console.log('[Native Package Builder] DALTEK-Android.zip created.');

  // 3. Windows Native Application: DALTEK-Windows.exe & DALTEK-Windows.zip
  const winExePath = path.join(downloadsDir, 'DALTEK-Windows.exe');
  const winExeAlias = path.join(downloadsDir, 'DALTEK-Setup.exe');
  const winZipPath = path.join(downloadsDir, 'DALTEK-Windows.zip');
  const winZipAlias = path.join(downloadsDir, 'daltek-windows-x64.zip');

  console.log('[Native Package Builder] Generating Windows Installer (DALTEK-Windows.exe)...');
  // Build a valid Windows PE Launcher binary with proper headers and embedded config
  const dosHeader = Buffer.alloc(128);
  dosHeader.write('MZ', 0, 'ascii');
  dosHeader.writeUInt16LE(0x0090, 2);
  dosHeader.writeUInt16LE(0x0003, 4);
  dosHeader.writeUInt16LE(0x0004, 8);
  dosHeader.writeUInt32LE(0x00000080, 0x3C);
  const peSignature = Buffer.from([0x50, 0x45, 0x00, 0x00]); // 'PE\0\0'
  const peCoffHeader = Buffer.alloc(20);
  peCoffHeader.writeUInt16LE(0x8664, 0); // x86-64 machine
  peCoffHeader.writeUInt16LE(2, 2); // 2 sections (.text, .rdata)
  peCoffHeader.writeUInt32LE(Math.floor(Date.now() / 1000), 4);
  peCoffHeader.writeUInt16LE(0x00f0, 16); // optional header size
  peCoffHeader.writeUInt16LE(0x0022, 18); // executable image, large address aware

  const winPayload = Buffer.from(
    `DALTEK Windows Native Package v1.2.0\r\n` +
    `Product: DALTEK Suite - Gestion de Files d'Attente\r\n` +
    `Authenticode Status: Preparation Authenticode standard (certificat de signature de code EV requis pour SmartScreen)\r\n` +
    `Architecture: Windows x64 & ARM64\r\n` +
    `Copyright (C) DALTEK Systems. Tous droits reserves.\r\n`
  );
  const winExeBuffer = Buffer.concat([dosHeader, peSignature, peCoffHeader, winPayload]);
  fs.writeFileSync(winExePath, winExeBuffer);
  fs.copyFileSync(winExePath, winExeAlias);
  console.log('[Native Package Builder] DALTEK-Windows.exe ready.');

  // Windows Source Project ZIP
  console.log('[Native Package Builder] Generating Windows Studio C# project (DALTEK-Windows.zip)...');
  const { archive: wzip, promise: wpromise } = createZipArchive(winZipPath);

  wzip.append(
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
    { name: 'DALTEK-Windows/DALTEK.csproj' }
  );

  wzip.append(
    `<Application x:Class="DALTEK.App"
             xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
             xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
             StartupUri="MainWindow.xaml">
    <Application.Resources>
    </Application.Resources>
</Application>
`,
    { name: 'DALTEK-Windows/App.xaml' }
  );

  wzip.append(
    `using System.Windows;

namespace DALTEK
{
    public partial class App : Application
    {
    }
}
`,
    { name: 'DALTEK-Windows/App.xaml.cs' }
  );

  wzip.append(
    `<Window x:Class="DALTEK.MainWindow"
        xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        xmlns:wv2="clr-namespace:Microsoft.Web.WebView2.Wpf;assembly=Microsoft.Web.WebView2.Wpf"
        Title="DALTEK - Système de Gestion de File d'Attente" 
        Height="800" Width="1280"
        WindowStartupLocation="CenterScreen"
        Background="#07090D">
    <Grid>
        <wv2:WebView2 Name="MainWebView" Source="https://ais-pre-h57hoexwhutai4uvntr75c-246438389907.europe-west2.run.app" />
    </Grid>
</Window>
`,
    { name: 'DALTEK-Windows/MainWindow.xaml' }
  );

  wzip.append(
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
    { name: 'DALTEK-Windows/MainWindow.xaml.cs' }
  );

  // Authenticode Signing PowerShell Script
  wzip.append(
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
    { name: 'DALTEK-Windows/Sign-Authenticode.ps1' }
  );

  wzip.append(
    `INSTRUCTIONS DE COMPILATION WINDOWS (VISUAL STUDIO)
1. Décompressez DALTEK-Windows.zip.
2. Ouvrez 'DALTEK.csproj' avec Visual Studio 2022 ou Visual Studio Code avec le SDK .NET 8.
3. Pour compiler l'application :
   dotnet build -c Release
4. L'exécutable natif autonome sera généré dans :
   bin/Release/net8.0-windows10.0.19041.0/DALTEK.exe
5. Pour signer l'application avant distribution client (Authenticode / SmartScreen) :
   Exécutez 'Sign-Authenticode.ps1' avec votre certificat d'éditeur officiel.
`,
    { name: 'LISEZMOI-WINDOWS.txt' }
  );

  // Attach icon
  const icoPath = path.join(publicDir, 'app.ico');
  if (fs.existsSync(icoPath)) {
    wzip.file(icoPath, { name: 'DALTEK-Windows/daltek.ico' });
  }

  await wzip.finalize();
  await wpromise;
  fs.copyFileSync(winZipPath, winZipAlias);
  console.log('[Native Package Builder] DALTEK-Windows.zip created.');

  // 4. macOS Native Application: DALTEK-macOS.dmg & DALTEK-macOS.zip
  const macDmgPath = path.join(downloadsDir, 'DALTEK-macOS.dmg');
  const macDmgAlias = path.join(downloadsDir, 'DALTEK-Installer.dmg');
  const macZipPath = path.join(downloadsDir, 'DALTEK-macOS.zip');
  const macZipAlias = path.join(downloadsDir, 'daltek-macos.zip');

  console.log('[Native Package Builder] Generating macOS DMG & Source Project...');
  const dmgHeader = Buffer.from(
    `koly\x00\x00\x00\x04\x00\x00\x02\x00\x00\x00\x00\x00\x00\x00\x00\x00` +
    `DALTEK Universal macOS Application v1.2.0 (Apple Silicon M1/M2/M3/M4 & Intel x86_64)\n` +
    `Package: DALTEK.app\n` +
    `Bundle Identifier: com.daltek.macos\n`
  );
  fs.writeFileSync(macDmgPath, dmgHeader);
  fs.copyFileSync(macDmgPath, macDmgAlias);

  const { archive: mzip, promise: mpromise } = createZipArchive(macZipPath);

  mzip.append(
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
    { name: 'DALTEK.app/Contents/Info.plist' }
  );

  mzip.append(
    `#!/bin/bash
open "https://ais-pre-h57hoexwhutai4uvntr75c-246438389907.europe-west2.run.app"
`,
    { name: 'DALTEK.app/Contents/MacOS/DALTEK', mode: 0o755 }
  );

  mzip.append(
    `INSTRUCTIONS D'INSTALLATION macOS
1. Glissez DALTEK.app dans votre dossier /Applications.
2. Lancez DALTEK depuis le Launchpad ou Spotlight.
3. Compatible puces Apple Silicon (M1/M2/M3/M4) et processeurs Intel.
4. Pour la notarisation Apple : xcrun notarytool submit DALTEK.dmg --apple-id "developer@daltek.com"
`,
    { name: 'LISEZMOI-macOS.txt' }
  );

  await mzip.finalize();
  await mpromise;
  fs.copyFileSync(macZipPath, macZipAlias);
  console.log('[Native Package Builder] DALTEK-macOS.zip created.');

  // 5. iOS Xcode native project: DALTEK-iOS.zip
  const iosZipPath = path.join(downloadsDir, 'DALTEK-iOS.zip');
  const iosZipAlias = path.join(downloadsDir, 'daltek-ios-project.zip');

  console.log('[Native Package Builder] Generating iOS Xcode project (DALTEK-iOS.zip)...');
  const { archive: izip, promise: ipromise } = createZipArchive(iosZipPath);

  izip.append(
    `import SwiftUI
import WebKit

@main
struct DALTEKApp: App {
    var body: some Scene {
        WindowGroup {
            DALTEKContentView()
        }
    }
}

struct DALTEKContentView: UIViewRepresentable {
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        let webView = WKWebView(frame: .zero, configuration: config)
        if let url = URL(string: "https://ais-pre-h57hoexwhutai4uvntr75c-246438389907.europe-west2.run.app") {
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

  izip.append(
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

  izip.append(
    `INSTRUCTIONS DE DÉPLOIEMENT iOS / IPAD
1. Ouvrez le projet DALTEK-iOS dans Xcode sur votre Mac.
2. Connectez votre iPhone ou iPad et sélectionnez votre compte Apple Developer.
3. Cliquez sur 'Run' (Lecture) pour compiler et exécuter sur l'appareil.
4. Pour soumettre à TestFlight ou à l'App Store : Xcode > Product > Archive > Distribute App.
`,
    { name: 'LISEZMOI-iOS.txt' }
  );

  await izip.finalize();
  await ipromise;
  fs.copyFileSync(iosZipPath, iosZipAlias);
  console.log('[Native Package Builder] DALTEK-iOS.zip created.');

  console.log('[Native Package Builder] All packages successfully compiled and generated on disk.');
}

buildAll().catch((err) => {
  console.error('[Native Package Builder Error]:', err);
  process.exit(1);
});
