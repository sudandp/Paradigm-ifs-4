# Optimization passes & general settings
-optimizationpasses 5
-dontusemixedcaseclassnames
-dontskipnonpubliclibraryclasses
-verbose

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

# ----------------------------------------------------
# Database & Cryptography (SQLCipher & SQLite)
# ----------------------------------------------------
-keep class net.sqlcipher.** { *; }
-keep class net.sqlcipher.database.** { *; }
-keep class org.sqlite.** { *; }

# ----------------------------------------------------
# Firebase & Play Services
# ----------------------------------------------------
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }

