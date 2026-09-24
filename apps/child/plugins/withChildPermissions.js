const fs = require("fs");
const path = require("path");

const {
  withAndroidManifest,
  withMainApplication,
  withDangerousMod,
  withAppBuildGradle,
} = require("@expo/config-plugins");

const APP_PKG_PATH = "fund/fastforward/lighthouse/child";

// ── 1. Manifest: declare the two stub services so the OS lists them as toggleable.
function addServices(androidManifest) {
  const app = androidManifest.manifest.application[0];
  app.service = app.service || [];

  const already = (name) => app.service.some((s) => s.$?.["android:name"] === name);

  if (!already(".NotificationCaptureService")) {
    app.service.push({
      $: {
        "android:name": ".NotificationCaptureService",
        "android:exported": "true",
        "android:label": "Lighthouse",
        "android:permission": "android.permission.BIND_NOTIFICATION_LISTENER_SERVICE",
      },
      "intent-filter": [
        {
          action: [
            { $: { "android:name": "android.service.notification.NotificationListenerService" } },
          ],
        },
      ],
    });
  }

  if (!already(".ContentAccessibilityService")) {
    app.service.push({
      $: {
        "android:name": ".ContentAccessibilityService",
        "android:exported": "true",
        "android:label": "Lighthouse",
        "android:permission": "android.permission.BIND_ACCESSIBILITY_SERVICE",
      },
      "intent-filter": [
        { action: [{ $: { "android:name": "android.accessibilityservice.AccessibilityService" } }] },
      ],
      "meta-data": [
        {
          $: {
            "android:name": "android.accessibilityservice",
            "android:resource": "@xml/accessibility_service_config",
          },
        },
      ],
    });
  }

  // Always-on background loop (capture → classify → send). foregroundServiceType
  // = specialUse: a continuous parental content-safety monitor doesn't fit
  // dataSync/camera/location/etc.; the subtype property is the Play justification.
  if (!already(".LighthouseMonitorService")) {
    app.service.push({
      $: {
        "android:name": ".LighthouseMonitorService",
        "android:exported": "false",
        "android:foregroundServiceType": "specialUse",
      },
      property: [
        {
          $: {
            "android:name": "android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE",
            "android:value":
              "Continuous on-device content-safety monitoring for child protection, with parental consent.",
          },
        },
      ],
    });
  }
  // Boot receiver: resume the monitor service after a reboot, hands-off (no JS).
  app.receiver = app.receiver || [];
  if (!app.receiver.some((r) => r.$?.["android:name"] === ".BootReceiver")) {
    app.receiver.push({
      $: {
        "android:name": ".BootReceiver",
        "android:exported": "true",
        "android:enabled": "true",
      },
      "intent-filter": [
        {
          action: [
            { $: { "android:name": "android.intent.action.BOOT_COMPLETED" } },
            { $: { "android:name": "android.intent.action.QUICKBOOT_POWERON" } },
          ],
        },
      ],
    });
  }
  return androidManifest;
}

// ── Manifest permissions for the foreground service + its notification + boot.
function addPermissions(androidManifest) {
  const manifest = androidManifest.manifest;
  manifest["uses-permission"] = manifest["uses-permission"] || [];
  const have = (n) => manifest["uses-permission"].some((p) => p.$?.["android:name"] === n);
  for (const perm of [
    "android.permission.FOREGROUND_SERVICE",
    "android.permission.FOREGROUND_SERVICE_SPECIAL_USE",
    "android.permission.POST_NOTIFICATIONS",
    "android.permission.RECEIVE_BOOT_COMPLETED",
    // Protective overlay (scoped blocking): draw over other apps. Granted via the
    // wizard's overlay step (Settings.canDrawOverlays); never drawn before granted.
    "android.permission.SYSTEM_ALERT_WINDOW",
  ]) {
    if (!have(perm)) manifest["uses-permission"].push({ $: { "android:name": perm } });
  }
  return androidManifest;
}

// ── Gradle: sign release builds with the Play upload key when credentials.json
// (downloaded via `eas credentials -p android`) sits in apps/child.
function addReleaseSigning(contents) {
  if (contents.includes("uploadCreds")) return contents;
  return contents
    .replace(
      /signingConfigs\s*\{\s*debug\s*\{/,
      `def uploadCreds = null
    def credsFile = rootProject.file('../credentials.json')
    if (credsFile.exists()) {
        uploadCreds = new groovy.json.JsonSlurper().parse(credsFile).android.keystore
    }
    signingConfigs {
        release {
            if (uploadCreds != null) {
                storeFile rootProject.file('../' + uploadCreds.keystorePath)
                storePassword uploadCreds.keystorePassword
                keyAlias uploadCreds.keyAlias
                keyPassword uploadCreds.keyPassword
            } else {
                storeFile file('debug.keystore')
                storePassword 'android'
                keyAlias 'androiddebugkey'
                keyPassword 'android'
            }
        }
        debug {`,
    )
    .replace(/release\s*\{\s*(?:\/\/[^\n]*\n\s*)*signingConfig signingConfigs\.debug/, "release {\n            signingConfig signingConfigs.release");
}

// ── Gradle: EncryptedSharedPreferences (config) + WorkManager (keep-alive worker).
function addNativeDeps(contents) {
  let out = contents;
  if (!out.includes("androidx.security:security-crypto")) {
    out = out.replace(
      /dependencies\s*\{/,
      'dependencies {\n    implementation("androidx.security:security-crypto:1.1.0-alpha06")',
    );
  }
  if (!out.includes("com.google.mlkit:text-recognition")) {
    out = out.replace(
      /dependencies\s*\{/,
      'dependencies {\n    implementation("com.google.mlkit:text-recognition:16.0.1")',
    );
  }
  if (!out.includes("com.microsoft.onnxruntime:onnxruntime-android")) {
    out = out.replace(
      /dependencies\s*\{/,
      'dependencies {\n    implementation("com.microsoft.onnxruntime:onnxruntime-android:1.30.0")',
    );
  }
  if (!out.includes("androidx.work:work-runtime")) {
    out = out.replace(
      /dependencies\s*\{/,
      'dependencies {\n    implementation("androidx.work:work-runtime-ktx:2.9.1")',
    );
  }
  return out;
}

// ── 2. Copy native sources into the generated app module.
function copyNativeSources(projectRoot, platformRoot) {
  const src = path.join(projectRoot, "native-src");
  const javaDir = path.join(platformRoot, "app/src/main/java", APP_PKG_PATH);
  const xmlDir = path.join(platformRoot, "app/src/main/res/xml");
  const valuesDir = path.join(platformRoot, "app/src/main/res/values");
  const assetsDir = path.join(platformRoot, "app/src/main/assets");
  fs.mkdirSync(javaDir, { recursive: true });
  fs.mkdirSync(xmlDir, { recursive: true });
  fs.mkdirSync(valuesDir, { recursive: true });
  fs.mkdirSync(assetsDir, { recursive: true });

  // Bundled default lexicon (the classifier's offline fallback before its first
  // sync). It's a GENERATED artifact — regenerate with `npm run db:export-lexicon`
  // in apps/api so the bundle matches the live published DB lexicon.
  fs.copyFileSync(
    path.join(projectRoot, "src/native/lexicon.json"),
    path.join(assetsDir, "lexicon.json"),
  );

  for (const model of ["nsfw.onnx", "textmodel.bin"]) {
    const src = path.join(projectRoot, "models", model);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(assetsDir, model));
  }

  for (const f of [
    "DeviceTier.kt",
    "VisionEngine.kt",
    "OcrEngine.kt",
    "NsfwClassifier.kt",
    "SignalBuffer.kt",
    "TextModel.kt",
    "NotificationCaptureService.kt",
    "ContentAccessibilityService.kt",
    "CaptureBuffer.kt",
    "LighthouseRegistry.kt",
    "LighthouseClassifier.kt",
    "OverlayManager.kt",
    "BackgroundConfig.kt",
    "SignalUploader.kt",
    "PermissionReader.kt",
    "LighthouseMonitorService.kt",
    "KeepAliveWorker.kt",
    "BootReceiver.kt",
    "LogScrub.kt",
    "LighthousePermissionsModule.kt",
    "LighthousePermissionsPackage.kt",
  ]) {
    fs.copyFileSync(path.join(src, f), path.join(javaDir, f));
  }
  fs.copyFileSync(
    path.join(src, "accessibility_service_config.xml"),
    path.join(xmlDir, "accessibility_service_config.xml"),
  );
  fs.copyFileSync(
    path.join(src, "lighthouse_strings.xml"),
    path.join(valuesDir, "lighthouse_strings.xml"),
  );
}

// ── 3. Register the ReactPackage in MainApplication.
function registerPackage(contents) {
  if (contents.includes("LighthousePermissionsPackage()")) return contents;
  return contents.replace(
    "// add(MyReactNativePackage())",
    "add(LighthousePermissionsPackage())",
  );
}

const withChildPermissions = (config) => {
  config = withAndroidManifest(config, (c) => {
    c.modResults = addServices(c.modResults);
    c.modResults = addPermissions(c.modResults);
    return c;
  });

  config = withAppBuildGradle(config, (c) => {
    if (c.modResults.language === "groovy") {
      c.modResults.contents = addReleaseSigning(addNativeDeps(c.modResults.contents));
    }
    return c;
  });

  config = withDangerousMod(config, [
    "android",
    (c) => {
      copyNativeSources(c.modRequest.projectRoot, c.modRequest.platformProjectRoot);
      return c;
    },
  ]);

  config = withMainApplication(config, (c) => {
    c.modResults.contents = registerPackage(c.modResults.contents);
    return c;
  });

  return config;
};

module.exports = withChildPermissions;
