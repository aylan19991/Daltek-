#!/bin/bash
set -e

echo "=========================================================="
echo "    DALTEK ANDROID NATIVE APK COMPILATION PIPELINE        "
echo "=========================================================="

export PATH="/usr/lib/jvm/java-17-openjdk-amd64/bin:$PATH"
export ANDROID_JAR="/opt/android-sdk/platforms/android-34/android.jar"
export D8_JAR="/opt/android-sdk/d8.jar"

PROJECT_ROOT="/tmp/daltek_android_build"
SRC_ROOT="/app/applet"
OUTPUT_DIR="/app/applet/downloads_storage"
PUBLIC_DIR="/app/applet/public"

mkdir -p "$OUTPUT_DIR"
mkdir -p "$PUBLIC_DIR"
rm -rf "$PROJECT_ROOT"
mkdir -p "$PROJECT_ROOT"

cd "$PROJECT_ROOT"
mkdir -p app/src/main/java/com/daltek/app
mkdir -p app/src/main/res/values
mkdir -p app/src/main/res/drawable
mkdir -p app/src/main/res/mipmap-mdpi
mkdir -p app/src/main/res/mipmap-hdpi
mkdir -p app/src/main/res/mipmap-xhdpi
mkdir -p app/src/main/res/mipmap-xxhdpi
mkdir -p app/src/main/res/mipmap-xxxhdpi
mkdir -p app/src/main/res/layout
mkdir -p build/gen
mkdir -p build/classes
mkdir -p build/apk

# 1. Copy App Icons
echo "[1/7] Preparing Assets & Icons..."
cp "$PUBLIC_DIR/icon-android-192.png" app/src/main/res/drawable/ic_launcher.png
cp "$PUBLIC_DIR/icon-android-192.png" app/src/main/res/mipmap-mdpi/ic_launcher.png
cp "$PUBLIC_DIR/icon-android-192.png" app/src/main/res/mipmap-hdpi/ic_launcher.png
cp "$PUBLIC_DIR/icon-android-512.png" app/src/main/res/mipmap-xhdpi/ic_launcher.png
cp "$PUBLIC_DIR/icon-android-512.png" app/src/main/res/mipmap-xxhdpi/ic_launcher.png
cp "$PUBLIC_DIR/icon-android-512.png" app/src/main/res/mipmap-xxxhdpi/ic_launcher.png

# 2. Write Android XML Resources
echo "[2/7] Generating Android XML Resources..."
cat << 'EOF' > app/src/main/res/values/strings.xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <string name="app_name">DALTEK</string>
    <string name="channel_name">Notifications DALTEK</string>
    <string name="channel_description">Alertes de ticket et notifications de file d\'attente</string>
    <string name="ticket_called_title">DALTEK - Ticket appelé !</string>
    <string name="offline_title">Connexion perdue</string>
    <string name="offline_message">Impossible de joindre le serveur DALTEK. Vérifiez votre connexion internet.</string>
    <string name="retry_button">Réessayer</string>
</resources>
EOF

cat << 'EOF' > app/src/main/res/values/colors.xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="daltek_gold">#F5B82E</color>
    <color name="daltek_gold_dark">#B87304</color>
    <color name="daltek_background">#07090D</color>
    <color name="daltek_card">#0F131A</color>
    <color name="daltek_text">#FFFFFF</color>
    <color name="daltek_text_muted">#8A94A6</color>
</resources>
EOF

cat << 'EOF' > app/src/main/res/values/styles.xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="Theme.DALTEK" parent="@android:style/Theme.DeviceDefault.NoActionBar">
        <item name="android:windowBackground">@color/daltek_background</item>
        <item name="android:statusBarColor">@color/daltek_background</item>
        <item name="android:navigationBarColor">@color/daltek_background</item>
    </style>
    <style name="Theme.DALTEK.NoActionBar" parent="Theme.DALTEK">
        <item name="android:windowActionBar">false</item>
        <item name="android:windowNoTitle">true</item>
    </style>
</resources>
EOF

cat << 'EOF' > app/src/main/res/layout/activity_main.xml
<?xml version="1.0" encoding="utf-8"?>
<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@color/daltek_background">

    <WebView
        android:id="@+id/webview"
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:visibility="visible" />

    <ProgressBar
        android:id="@+id/progressBar"
        style="?android:attr/progressBarStyleLarge"
        android:layout_width="64dp"
        android:layout_height="64dp"
        android:layout_gravity="center"
        android:indeterminateTint="@color/daltek_gold"
        android:visibility="visible" />

    <LinearLayout
        android:id="@+id/offlineLayout"
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:gravity="center"
        android:orientation="vertical"
        android:padding="24dp"
        android:visibility="gone">

        <ImageView
            android:layout_width="80dp"
            android:layout_height="80dp"
            android:src="@drawable/ic_launcher"
            android:contentDescription="@string/app_name" />

        <TextView
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_marginTop="16dp"
            android:text="@string/offline_title"
            android:textColor="@color/daltek_gold"
            android:textSize="20sp"
            android:textStyle="bold" />

        <TextView
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_marginTop="8dp"
            android:gravity="center"
            android:text="@string/offline_message"
            android:textColor="@color/daltek_text_muted"
            android:textSize="14sp" />

        <Button
            android:id="@+id/btnRetry"
            android:layout_width="wrap_content"
            android:layout_height="wrap_content"
            android:layout_marginTop="20dp"
            android:backgroundTint="@color/daltek_gold"
            android:text="@string/retry_button"
            android:textColor="@color/daltek_background" />
    </LinearLayout>
</FrameLayout>
EOF

cat << 'EOF' > app/src/main/AndroidManifest.xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.daltek.app"
    android:versionCode="10200"
    android:versionName="1.2.0">

    <uses-sdk
        android:minSdkVersion="24"
        android:targetSdkVersion="34" />

    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />

    <application
        android:name="com.daltek.app.DaltekApp"
        android:allowBackup="true"
        android:icon="@mipmap/ic_launcher"
        android:roundIcon="@mipmap/ic_launcher"
        android:label="@string/app_name"
        android:supportsRtl="true"
        android:theme="@style/Theme.DALTEK"
        android:hardwareAccelerated="true">

        <activity
            android:name="com.daltek.app.MainActivity"
            android:exported="true"
            android:configChanges="orientation|screenSize|keyboardHidden|screenLayout"
            android:windowSoftInputMode="adjustResize"
            android:theme="@style/Theme.DALTEK.NoActionBar">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
            <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="https" android:host="ais-pre-h57hoexwhutai4uvntr75c-246438389907.europe-west2.run.app" />
            </intent-filter>
        </activity>

    </application>
</manifest>
EOF

# 3. Write Native Java Sources
echo "[3/7] Generating Native Java Sources..."
cat << 'EOF' > app/src/main/java/com/daltek/app/DaltekApp.java
package com.daltek.app;

import android.app.Application;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;

public class DaltekApp extends Application {
    public static final String CHANNEL_ID = "daltek_queue_channel";

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            CharSequence name = getString(R.string.channel_name);
            String description = getString(R.string.channel_description);
            int importance = NotificationManager.IMPORTANCE_HIGH;
            NotificationChannel channel = new NotificationChannel(CHANNEL_ID, name, importance);
            channel.setDescription(description);
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 300, 200, 300, 200, 500});

            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }
}
EOF

cat << 'EOF' > app/src/main/java/com/daltek/app/DaltekNativeBridge.java
package com.daltek.app;

import android.content.Context;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.webkit.JavascriptInterface;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;

public class DaltekNativeBridge {
    private final MainActivity activity;

    public DaltekNativeBridge(MainActivity activity) {
        this.activity = activity;
    }

    @JavascriptInterface
    public boolean isNativeApp() {
        return true;
    }

    @JavascriptInterface
    public String getAppVersion() {
        return "1.2.0";
    }

    @JavascriptInterface
    public void vibrate(long milliseconds) {
        Vibrator vibrator = (Vibrator) activity.getSystemService(Context.VIBRATOR_SERVICE);
        if (vibrator != null && vibrator.hasVibrator()) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createOneShot(milliseconds > 0 ? milliseconds : 300, VibrationEffect.DEFAULT_AMPLITUDE));
            } else {
                vibrator.vibrate(milliseconds > 0 ? milliseconds : 300);
            }
        }
    }

    @JavascriptInterface
    public void notifyTicketCalled(final String ticketNumber, final String counterName) {
        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                vibrate(500);
                NotificationManager manager = (NotificationManager) activity.getSystemService(Context.NOTIFICATION_SERVICE);
                if (manager == null) return;

                Intent intent = new Intent(activity, MainActivity.class);
                intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                PendingIntent pendingIntent = PendingIntent.getActivity(
                    activity, 0, intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0)
                );

                android.app.Notification.Builder builder;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    builder = new android.app.Notification.Builder(activity, DaltekApp.CHANNEL_ID);
                } else {
                    builder = new android.app.Notification.Builder(activity);
                }

                String content = "Ticket #" + ticketNumber + " au guichet: " + (counterName != null ? counterName : "Principal");
                builder.setContentTitle(activity.getString(R.string.ticket_called_title))
                       .setContentText(content)
                       .setSmallIcon(R.drawable.ic_launcher)
                       .setContentIntent(pendingIntent)
                       .setAutoCancel(true);

                manager.notify(102, builder.build());
            }
        });
    }

    @JavascriptInterface
    public void keepScreenOn(final boolean keepOn) {
        activity.runOnUiThread(new Runnable() {
            @Override
            public void run() {
                if (keepOn) {
                    activity.getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                } else {
                    activity.getWindow().clearFlags(android.view.WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                }
            }
        });
    }
}
EOF

cat << 'EOF' > app/src/main/java/com/daltek/app/MainActivity.java
package com.daltek.app;

import android.app.Activity;
import android.graphics.Bitmap;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;

public class MainActivity extends Activity {
    private static final String SERVER_URL = "https://ais-pre-h57hoexwhutai4uvntr75c-246438389907.europe-west2.run.app";
    
    private WebView webView;
    private ProgressBar progressBar;
    private LinearLayout offlineLayout;
    private Button btnRetry;
    private boolean isError = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        // Keep screen on for TV display / staff counter convenience
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        webView = findViewById(R.id.webview);
        progressBar = findViewById(R.id.progressBar);
        offlineLayout = findViewById(R.id.offlineLayout);
        btnRetry = findViewById(R.id.btnRetry);

        configureWebView();

        btnRetry.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                isError = false;
                offlineLayout.setVisibility(View.GONE);
                progressBar.setVisibility(View.VISIBLE);
                webView.setVisibility(View.VISIBLE);
                webView.loadUrl(SERVER_URL);
            }
        });

        webView.loadUrl(SERVER_URL);
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);

        // Add Native JavaScript Interface Bridge
        webView.addJavascriptInterface(new DaltekNativeBridge(this), "DaltekAndroid");

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (newProgress >= 90) {
                    progressBar.setVisibility(View.GONE);
                } else if (!isError) {
                    progressBar.setVisibility(View.VISIBLE);
                }
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                isError = false;
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                if (!isError) {
                    progressBar.setVisibility(View.GONE);
                    offlineLayout.setVisibility(View.GONE);
                    webView.setVisibility(View.VISIBLE);
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    isError = true;
                    progressBar.setVisibility(View.GONE);
                    webView.setVisibility(View.GONE);
                    offlineLayout.setVisibility(View.VISIBLE);
                }
            }
        });
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
EOF

# 4. Compile Resources with AAPT
echo "[4/7] Compiling Android Resources with AAPT..."
aapt package -f -m \
    -J build/gen \
    -M app/src/main/AndroidManifest.xml \
    -S app/src/main/res \
    -I "$ANDROID_JAR"

# 5. Compile Java Sources to Bytecode
echo "[5/7] Compiling Java classes with javac..."
javac -source 1.8 -target 1.8 \
    -bootclasspath "$ANDROID_JAR" \
    -cp "$ANDROID_JAR:build/gen" \
    -d build/classes \
    build/gen/com/daltek/app/R.java \
    app/src/main/java/com/daltek/app/DaltekApp.java \
    app/src/main/java/com/daltek/app/DaltekNativeBridge.java \
    app/src/main/java/com/daltek/app/MainActivity.java

# 6. Translate Java bytecode to Dalvik DEX using official Google D8
echo "[6/7] Generating classes.dex with Google D8..."
java -cp "$D8_JAR" com.android.tools.r8.D8 \
    --release \
    --min-api 24 \
    --output build/apk \
    --lib "$ANDROID_JAR" \
    $(find build/classes -name "*.class")

# 7. Package, Align and Sign APK
echo "[7/7] Packaging, Aligning and Signing APK..."
# Create raw APK with resources and manifest
aapt package -f \
    -M app/src/main/AndroidManifest.xml \
    -S app/src/main/res \
    -I "$ANDROID_JAR" \
    -F build/apk/unaligned.apk

# Add classes.dex into the APK
cd build/apk
aapt add unaligned.apk classes.dex
cd "$PROJECT_ROOT"

# Generate Release Keystore
keytool -genkeypair -v \
    -keystore build/daltek-release.keystore \
    -alias daltek-release \
    -keyalg RSA \
    -keysize 2048 \
    -validity 10000 \
    -storepass daltek2026 \
    -keypass daltek2026 \
    -dname "CN=DALTEK Systems, OU=Mobile, O=DALTEK, L=Paris, ST=IDF, C=FR"

# Sign with JAR signing (v1 scheme)
jarsigner -keystore build/daltek-release.keystore \
    -storepass daltek2026 \
    -keypass daltek2026 \
    build/apk/unaligned.apk daltek-release

# Zipalign 4-byte boundary
zipalign -p -f -v 4 build/apk/unaligned.apk build/apk/aligned.apk

# Sign APK with apksigner (v2 + v3 signature schemes)
apksigner sign \
    --ks build/daltek-release.keystore \
    --ks-key-alias daltek-release \
    --ks-pass pass:daltek2026 \
    --key-pass pass:daltek2026 \
    --out "$OUTPUT_DIR/DALTEK-Android.apk" \
    build/apk/aligned.apk

# Verify signature
echo "=========================================================="
echo "    VERIFYING APK SIGNATURE & INTEGRITY WITH APKSIGNER    "
echo "=========================================================="
apksigner verify --verbose "$OUTPUT_DIR/DALTEK-Android.apk"

# Copy also to public folder for direct static serving
cp "$OUTPUT_DIR/DALTEK-Android.apk" "$PUBLIC_DIR/DALTEK-Android.apk"
cp "$OUTPUT_DIR/DALTEK-Android.apk" "$OUTPUT_DIR/daltek-android.apk"

echo "=========================================================="
echo "    APK BUILD SUCCESSFUL!                                 "
echo "=========================================================="
ls -lh "$OUTPUT_DIR/DALTEK-Android.apk"
aapt dump badging "$OUTPUT_DIR/DALTEK-Android.apk" | head -n 12
