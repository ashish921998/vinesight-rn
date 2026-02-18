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
    val appWidgetManager = AppWidgetManager.getInstance(context)
    val widgetIds = getWidgetIds(context)

    try {
      widgetIds.forEach { widgetId ->
        WeatherWidgetManager.saveWidgetStatus(context, widgetId, WeatherWidgetManager.WeatherWidgetStatus.LOADING)
        WeatherWidgetProvider.updateWidget(context, appWidgetManager, widgetId)
      }

      val payload = JSONObject(payloadJson)
      val weather = payload.optJSONObject("weather") ?: payload
      val current = weather.optJSONObject("current")

      val widgetData = WeatherWidgetManager.WeatherWidgetData(
        temperature = current?.optDouble("temperature", 0.0) ?: 0.0,
        condition = current?.optString("condition", "Unknown") ?: "Unknown",
        humidity = current?.optDouble("humidity", 0.0) ?: 0.0,
        windSpeed = current?.optDouble("windSpeed", 0.0) ?: 0.0,
        location = weather.optString("farmName", ""),
        lastUpdated = weather.optLong("lastUpdated", System.currentTimeMillis()),
        status = WeatherWidgetManager.WeatherWidgetStatus.READY
      )

      widgetIds.forEach { widgetId ->
        WeatherWidgetManager.saveWidgetData(context, widgetId, widgetData)
        WeatherWidgetProvider.updateWidget(context, appWidgetManager, widgetId)
      }

      val response = Arguments.createMap().apply {
        putBoolean("success", true)
        putInt("updatedWidgetCount", widgetIds.size)
      }
      promise.resolve(response)
    } catch (e: Exception) {
      widgetIds.forEach { widgetId ->
        WeatherWidgetManager.saveWidgetStatus(context, widgetId, WeatherWidgetManager.WeatherWidgetStatus.ERROR)
        WeatherWidgetProvider.updateWidget(context, appWidgetManager, widgetId)
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
      val context = reactApplicationContext
      val appWidgetManager = AppWidgetManager.getInstance(context)
      val componentName = ComponentName(context, WeatherWidgetProvider::class.java)
      val widgetIds = appWidgetManager.getAppWidgetIds(componentName)

      widgetIds.forEach { widgetId ->
        WeatherWidgetProvider.updateWidget(context, appWidgetManager, widgetId)
      }

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

  companion object {
    private const val PREFS_NAME = "com.vinesight.widget.prefs"
    private const val WIDGET_CONFIG_KEY = "widget_config"
  }
}
