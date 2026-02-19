package com.vinesight

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONObject

/**
 * Widget Manager for handling widget data storage and operations
 * 
 * This class provides:
 * - Storing/retrieving widget data from SharedPreferences
 * - Managing widget update schedules
 * - Widget configuration management
 */
object WeatherWidgetManager {
    
    private const val PREFS_NAME = "com.vinesight.widget.prefs"
    private const val UPDATES_ENABLED_KEY = "updates_enabled"

    enum class WeatherWidgetStatus {
        LOADING,
        ERROR,
        READY
    }
    
    /**
     * Data class representing weather information for the widget
     */
    data class WeatherWidgetData(
        val temperature: Double,
        val condition: String,
        val humidity: Double,
        val windSpeed: Double,
        val location: String,
        val lastUpdated: Long,
        val status: WeatherWidgetStatus = WeatherWidgetStatus.READY
    )
    
    /**
     * Save widget data to SharedPreferences
     */
    fun saveWidgetData(context: Context, widgetId: Int, data: WeatherWidgetData) {
        val prefs = getPrefs(context)
        val json = JSONObject().apply {
            put("temperature", data.temperature)
            put("condition", data.condition)
            put("humidity", data.humidity)
            put("windSpeed", data.windSpeed)
            put("location", data.location)
            put("lastUpdated", data.lastUpdated)
            put("status", data.status.name)
        }
        prefs.edit().putString("widget_$widgetId", json.toString()).apply()
    }
    
    /**
     * Get widget data from SharedPreferences
     */
    fun getWidgetData(context: Context, widgetId: Int): WeatherWidgetData? {
        val prefs = getPrefs(context)
        val jsonString = prefs.getString("widget_$widgetId", null) ?: return null
        
        return try {
            val json = JSONObject(jsonString)
            WeatherWidgetData(
                temperature = json.optDouble("temperature", 0.0),
                condition = json.optString("condition", ""),
                humidity = json.optDouble("humidity", 0.0),
                windSpeed = json.optDouble("windSpeed", 0.0),
                location = json.optString("location", ""),
                lastUpdated = json.optLong("lastUpdated", 0L),
                status = WeatherWidgetStatus.values().firstOrNull {
                    it.name == json.optString("status", WeatherWidgetStatus.READY.name)
                } ?: WeatherWidgetStatus.READY
            )
        } catch (e: Exception) {
            android.util.Log.e("WeatherWidgetManager", "Failed to parse widget data for ID $widgetId", e)
            null
        }
    }

    fun saveWidgetStatus(context: Context, widgetId: Int, status: WeatherWidgetStatus) {
        val existing = getWidgetData(context, widgetId)
        val base = existing ?: WeatherWidgetData(
            temperature = 0.0,
            condition = "",
            humidity = 0.0,
            windSpeed = 0.0,
            location = "",
            lastUpdated = System.currentTimeMillis(),
            status = status
        )
        saveWidgetData(context, widgetId, base.copy(status = status, lastUpdated = System.currentTimeMillis()))
    }
    
    /**
     * Clear widget data
     */
    fun clearWidgetData(context: Context, widgetId: Int) {
        val prefs = getPrefs(context)
        prefs.edit().remove("widget_$widgetId").apply()
    }
    
    /**
     * Get all widget IDs with stored data
     */
    fun getAllWidgetIds(context: Context): List<Int> {
        val prefs = getPrefs(context)
        val allKeys = prefs.all.keys
        return allKeys
            .filter { it.startsWith("widget_") }
            .mapNotNull { it.removePrefix("widget_").toIntOrNull() }
    }
    
    /**
     * Check if updates are enabled
     */
    fun isUpdatesEnabled(context: Context): Boolean {
        val prefs = getPrefs(context)
        return prefs.getBoolean(UPDATES_ENABLED_KEY, true)
    }
    
    /**
     * Enable or disable widget updates
     */
    fun setUpdatesEnabled(context: Context, enabled: Boolean) {
        val prefs = getPrefs(context)
        prefs.edit().putBoolean(UPDATES_ENABLED_KEY, enabled).apply()
    }
    
    /**
     * Get SharedPreferences instance
     */
    private fun getPrefs(context: Context): SharedPreferences {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }
}
