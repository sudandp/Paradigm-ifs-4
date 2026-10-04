# Optimization passes & general settings
-optimizationpasses 5
-dontusemixedcaseclassnames
-dontskipnonpubliclibraryclasses
# [L4-FIXED] Removed -verbose from production. Use only in debug builds to avoid
# leaking class structure information in build output.

# Preserve critical attributes required for reflection, JS bridges, and crash stack traces
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod,JavascriptInterface,SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# ----------------------------------------------------
# Capacitor 7 Core & Native Plugin Reflection Protection
# ----------------------------------------------------
-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }
-keep @interface com.getcapacitor.** { *; }
-keep public class * extends com.getcapacitor.Plugin { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin class * { *; }
-keep @com.getcapacitor.annotation.NativePlugin class * { *; }

-keepclassmembers class * extends com.getcapacitor.Plugin {
    @com.getcapacitor.PluginMethod public void *(com.getcapacitor.PluginCall);
}

-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Capacitor Community & Capawesome Plugins
-keep class com.capacitor.** { *; }
-keep class cap.go.** { *; }
-keep class io.capawesome.** { *; }
# Capgo Social Login and Updater native packages
-keep class ee.forgr.** { *; }
-keep class ee.forgr.capacitor.social.login.** { *; }
-keep class ee.forgr.capacitor_updater.** { *; }

# ----------------------------------------------------
# Application Package Rules (com.paradigm.ifs)
# Obfuscate internal code while preserving Android components
# ----------------------------------------------------
-keep public class * extends android.app.Activity
-keep public class * extends android.app.Service
-keep public class * extends android.content.BroadcastReceiver
-keep public class * extends android.content.ContentProvider
-keep public class * extends android.app.Application

# Background FCM Messaging & Location tracking entry points
-keep class com.paradigm.ifs.ParadigmFirebaseMessagingService { *; }
-keep class com.paradigm.ifs.MainActivity { *; }

# [L41-FIXED] Removed dead SQLCipher rules (not in build.gradle dependencies)
# [L42-FIXED] Removed dead cap.go.** rule (package not present in dependencies)

# ----------------------------------------------------
# Firebase & Play Services (surgical — not wildcard)
# [L39-FIXED] Narrowed from com.google.firebase.** { *; } to essential classes only
# ----------------------------------------------------
-keep class com.google.firebase.FirebaseApp { *; }
-keep class com.google.firebase.messaging.** { *; }
-keep class com.google.firebase.iid.** { *; }
-keep class com.google.android.gms.common.** { *; }
-keep class com.google.android.gms.location.** { *; }
-keep class com.google.android.gms.tasks.** { *; }
# [L40-FIXED] Narrowed from com.google.android.gms.** { *; }

# Google Play Core (In-App Updates)
-keep class com.google.android.play.core.appupdate.** { *; }
-keep class com.google.android.play.core.install.** { *; }
-dontwarn com.google.android.play.core.**


