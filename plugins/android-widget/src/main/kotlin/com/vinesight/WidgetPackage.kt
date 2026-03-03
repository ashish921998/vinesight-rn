package com.vinesight

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone
import org.json.JSONObject

/**
 * React Native Package for Android Widget Management
 */
class WidgetPackage : ReactPackage {

  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
    return listOf(WidgetBridgeModule(reactContext))
  }

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
    return emptyList()
  }
}

/**
 * React Native module that matches the JS WidgetBridge contract.
 */
class WidgetBridgeModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String {
    return "WidgetBridge"
  }

  @ReactMethod
  fun updateWidget(payloadJson: String, promise: Promise) {
    val context = reactApplicationContext
    val widgetIds = getWidgetIds(context)

    try {
      widgetIds.forEach { widgetId ->
        WeatherWidgetManager.saveWidgetStatus(context, widgetId, WeatherWidgetManager.WeatherWidgetStatus.LOADING)
        WeatherWidgetProvider.requestUpdate(context, widgetId)
      }

      val payload = JSONObject(payloadJson)
      val weather = payload.optJSONObject("weather") ?: run {
        android.util.Log.w("WidgetBridge", "No 'weather' key in payload, using payload root")
        payload
      }
      val current = weather.optJSONObject("current")

      val widgetData = WeatherWidgetManager.WeatherWidgetData(
        temperature = current?.optDouble("temperature", 0.0) ?: 0.0,
        condition = current?.optString("condition", "Unknown") ?: "Unknown",
        humidity = current?.optDouble("humidity", 0.0) ?: 0.0,
        windSpeed = current?.optDouble("windSpeed", 0.0) ?: 0.0,
        location = weather.optString("farmName", ""),
        lastUpdated = normalizeTimestamp(weather.opt("lastUpdated")),
        status = WeatherWidgetManager.WeatherWidgetStatus.READY
      )

      widgetIds.forEach { widgetId ->
        WeatherWidgetManager.saveWidgetData(context, widgetId, widgetData)
        WeatherWidgetProvider.requestUpdate(context, widgetId)
      }

      val response = Arguments.createMap().apply {
        putBoolean("success", true)
        putInt("updatedWidgetCount", widgetIds.size)
      }
      promise.resolve(response)
    } catch (e: Exception) {
      widgetIds.forEach { widgetId ->
        WeatherWidgetManager.saveWidgetStatus(context, widgetId, WeatherWidgetManager.WeatherWidgetStatus.ERROR)
        WeatherWidgetProvider.requestUpdate(context, widgetId)
      }
      promise.reject("UPDATE_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun saveWidgetConfig(configJson: String, promise: Promise) {
    try {
      getPrefs(reactApplicationContext).edit().putString(WIDGET_CONFIG_KEY, configJson).apply()
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("SAVE_CONFIG_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun loadWidgetConfig(promise: Promise) {
    try {
      val configJson = getPrefs(reactApplicationContext).getString(WIDGET_CONFIG_KEY, null)
      promise.resolve(configJson)
    } catch (e: Exception) {
      promise.reject("LOAD_CONFIG_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun reloadAllWidgets(promise: Promise) {
    try {
      WeatherWidgetProvider.requestUpdate(reactApplicationContext)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("RELOAD_ERROR", e.message, e)
    }
  }

  private fun getPrefs(context: Context) =
    context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

  private fun getWidgetIds(context: Context): List<Int> {
    val appWidgetManager = AppWidgetManager.getInstance(context)
    val componentName = ComponentName(context, WeatherWidgetProvider::class.java)
    val activeWidgetIds = appWidgetManager.getAppWidgetIds(componentName).toSet()
    val storedWidgetIds = WeatherWidgetManager.getAllWidgetIds(context).toSet()
    return (activeWidgetIds + storedWidgetIds).toList()
  }

  private fun normalizeTimestamp(value: Any?): Long {
    val now = System.currentTimeMillis()
    return when (value) {
      is Number -> {
        val ts = value.toLong()
        if (ts in 1_000_000_000L..9_999_999_999L) ts * 1000 else ts
      }
      is String -> {
        val trimmed = value.trim()
        trimmed.toLongOrNull()?.let { ts ->
          return if (ts in 1_000_000_000L..9_999_999_999L) ts * 1000 else ts
        }
        parseIsoTimestamp(trimmed) ?: now
      }
      else -> now
    }
  }

  private fun parseIsoTimestamp(value: String): Long? {
    val patterns = listOf(
      "yyyy-MM-dd'T'HH:mm:ss.SSSX",
      "yyyy-MM-dd'T'HH:mm:ssX",
      "yyyy-MM-dd'T'HH:mm:ss.SSS",
      "yyyy-MM-dd'T'HH:mm:ss"
    )
    for (pattern in patterns) {
      try {
        val formatter = SimpleDateFormat(pattern, Locale.US).apply {
          isLenient = true
          if (!pattern.endsWith("X")) {
            timeZone = TimeZone.getTimeZone("UTC")
          }
        }
        val parsed = formatter.parse(value)
        if (parsed != null) return parsed.time
      } catch (_: Exception) {
        // Try the next pattern.
      }
    }
    return null
  }

  companion object {
    private const val PREFS_NAME = "com.vinesight.widget.prefs"
    private const val WIDGET_CONFIG_KEY = "widget_config"
  }
}
