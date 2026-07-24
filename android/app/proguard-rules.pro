# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Keep all Capacitor Plugins (essential for reflection loading)
-keep public class * extends com.getcapacitor.Plugin { *; }

# Keep all custom classes in the project package (background tasks, services, helpers, etc.)
-keep class com.paradigm.ifs.** { *; }

# Keep SQLCipher / SQLite database classes (used by @capacitor-community/sqlite)
-keep class net.sqlcipher.** { *; }
-keep class net.sqlcipher.database.** { *; }
-keep class org.sqlite.** { *; }

# WebView and JavaScript Interface rules
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Preserve the line number information and source file names for crash reporting
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile
