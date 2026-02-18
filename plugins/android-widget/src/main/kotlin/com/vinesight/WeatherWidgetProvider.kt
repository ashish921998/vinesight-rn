package com.vinesight

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import com.vinesight.app.R
import kotlin.math.roundToInt

/**
 * Weather Widget Provider for Home Screen Widgets
 * 
 * This class handles widget lifecycle events:
 * - onUpdate: Called when widget needs to be updated
 * - onEnabled: Called when first widget instance is added
 * - onDisabled: Called when last widget instance is removed
 */
class WeatherWidgetProvider : AppWidgetProvider() {
    
    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        // Update each widget instance
        for (appWidgetId in appWidgetIds) {
            updateWidget(context, appWidgetManager, appWidgetId)
        }
    }
    
    override fun onEnabled(context: Context) {
        // Called when the first widget instance is created
        super.onEnabled(context)
    }
    
    override fun onDisabled(context: Context) {
        // Called when the last widget instance is removed
        super.onDisabled(context)
    }

    override fun onDeleted(context: Context, appWidgetIds: IntArray) {
        super.onDeleted(context, appWidgetIds)
        appWidgetIds.forEach { widgetId ->
            WeatherWidgetManager.clearWidgetData(context, widgetId)
        }
    }
    
    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        
        // Handle custom actions for widget updates
        when (intent.action) {
            ACTION_UPDATE_WIDGET -> {
                val appWidgetId = intent.getIntExtra(
                    AppWidgetManager.EXTRA_APPWIDGET_ID,
                    AppWidgetManager.INVALID_APPWIDGET_ID
                )
                if (appWidgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
                    val appWidgetManager = AppWidgetManager.getInstance(context)
                    updateWidget(context, appWidgetManager, appWidgetId)
                } else {
                    android.util.Log.w("WeatherWidgetProvider", "Received UPDATE_WIDGET action without valid appWidgetId")
                }
            }
        }
    }
    
    companion object {
        const val ACTION_UPDATE_WIDGET = "com.vinesight.UPDATE_WIDGET"
        
        fun updateWidget(
            context: Context,
            appWidgetManager: AppWidgetManager,
            appWidgetId: Int
        ) {
            // Get stored widget data
            val widgetData = WeatherWidgetManager.getWidgetData(context, appWidgetId)
            
            // Create remote views for the widget layout
            val views = RemoteViews(context.packageName, R.layout.widget_weather)
            
            // Update widget text with weather data
            if (widgetData != null) {
                val lines = mutableListOf<String>()
                lines.add("${widgetData.temperature.roundToInt()}° ${widgetData.condition}")
                if (widgetData.location.isNotEmpty()) {
                    lines.add(widgetData.location)
                }
                lines.add("Humidity: ${widgetData.humidity.roundToInt()}%")
                val displayText = lines.joinToString("\n")
                views.setTextViewText(
                    R.id.widget_text,
                    displayText
                )
            } else {
                views.setTextViewText(
                    R.id.widget_text,
                    "No weather data"
                )
            }
            
            // Update the widget
            appWidgetManager.updateAppWidget(appWidgetId, views)
        }
    }
}
