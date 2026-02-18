package com.vinesight

import android.appwidget.AppWidgetManager
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.NativeModule
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.uimanager.ViewManager

/**
 * React Native Package for Android Widget Management
 *
 * This package registers the WidgetModule to React Native.
 */
class WidgetPackage : ReactPackage {

  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
    return listOf(WidgetModule(reactContext))
  }

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
    return emptyList()
  }
}

/**
 * React Native Module for Android Widget Management
 *
 * This module exposes methods to React Native for:
 * - Updating widget data
 * - Getting widget configuration
 * - Enabling/disabling widgets
 */
class WidgetModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String {
    return "VinesightWidgetModule"
  }

  /**
   * Update widget with new data
   *
   * @param widgetId The ID of the widget to update
   * @param weatherData Weather data map containing temperature, conditions, etc.
   * @param promise Promise to resolve/reject the operation
   */
  @ReactMethod
  fun updateWeatherWidget(widgetId: Int, weatherData: ReadableMap, promise: Promise) {
    try {
      val context = getReactApplicationContext()

      // Parse weather data from React Native map
      val temperature = weatherData.getDouble("temperature")
      val condition = weatherData.getString("condition") ?: "Unknown"
      val humidity = weatherData.getDouble("humidity")
      val windSpeed = weatherData.getDouble("windSpeed")
      val location = weatherData.getString("location") ?: ""

      // Create widget data object
      val widgetData = WeatherWidgetManager.WeatherWidgetData(
        temperature = temperature,
        condition = condition,
        humidity = humidity,
        windSpeed = windSpeed,
        location = location,
        lastUpdated = System.currentTimeMillis()
      )

      // Store widget data
      WeatherWidgetManager.saveWidgetData(context, widgetId, widgetData)

      // Update the widget on home screen
      WeatherWidgetProvider.updateWidget(
        context,
        AppWidgetManager.getInstance(context),
        widgetId
      )

      // Return success
      val response = Arguments.createMap().apply {
        putBoolean("success", true)
        putInt("widgetId", widgetId)
      }
      promise.resolve(response)

    } catch (e: Exception) {
      promise.reject("UPDATE_ERROR", e.message)
    }
  }

  /**
   * Get current widget data
   *
   * @param widgetId The ID of the widget
   * @param promise Promise to resolve/reject the operation
   */
  @ReactMethod
  fun getWidgetData(widgetId: Int, promise: Promise) {
    try {
      val context = getReactApplicationContext()
      val widgetData = WeatherWidgetManager.getWidgetData(context, widgetId)

      if (widgetData != null) {
        val response = Arguments.createMap().apply {
          putDouble("temperature", widgetData.temperature)
          putString("condition", widgetData.condition)
          putDouble("humidity", widgetData.humidity)
          putDouble("windSpeed", widgetData.windSpeed)
          putString("location", widgetData.location)
          putDouble("lastUpdated", widgetData.lastUpdated.toDouble())
        }
        promise.resolve(response)
      } else {
        promise.resolve(null)
      }

    } catch (e: Exception) {
      promise.reject("GET_DATA_ERROR", e.message)
    }
  }

  /**
   * Clear widget data
   *
   * @param widgetId The ID of the widget to clear
   * @param promise Promise to resolve/reject the operation
   */
  @ReactMethod
  fun clearWidgetData(widgetId: Int, promise: Promise) {
    try {
      val context = getReactApplicationContext()
      WeatherWidgetManager.clearWidgetData(context, widgetId)
      promise.resolve(null)

    } catch (e: Exception) {
      promise.reject("CLEAR_ERROR", e.message)
    }
  }

  /**
   * Enable or disable widget auto-updates
   *
   * @param enabled Whether to enable updates
   * @param promise Promise to resolve/reject the operation
   */
  @ReactMethod
  fun setWidgetUpdatesEnabled(enabled: Boolean, promise: Promise) {
    try {
      val context = getReactApplicationContext()
      WeatherWidgetManager.setUpdatesEnabled(context, enabled)
      promise.resolve(null)

    } catch (e: Exception) {
      promise.reject("SET_ENABLED_ERROR", e.message)
    }
  }
}
