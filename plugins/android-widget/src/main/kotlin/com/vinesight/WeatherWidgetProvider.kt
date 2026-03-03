package com.vinesight

import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.update
import androidx.glance.appwidget.updateAll
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * Weather Widget Provider for Home Screen Widgets.
 *
 * This receiver delegates rendering to Jetpack Compose (Glance).
 */
class WeatherWidgetProvider : GlanceAppWidgetReceiver() {
    override val glanceAppWidget = WeatherGlanceWidget()

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        super.onUpdate(context, appWidgetManager, appWidgetIds)
        requestUpdate(context)
    }

    override fun onDeleted(context: Context, appWidgetIds: IntArray) {
        super.onDeleted(context, appWidgetIds)
        appWidgetIds.forEach { widgetId ->
            WeatherWidgetManager.clearWidgetData(context, widgetId)
        }
    }

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)

        when (intent.action) {
            ACTION_UPDATE_WIDGET -> {
                val appWidgetId = intent.getIntExtra(
                    AppWidgetManager.EXTRA_APPWIDGET_ID,
                    AppWidgetManager.INVALID_APPWIDGET_ID
                )
                if (appWidgetId != AppWidgetManager.INVALID_APPWIDGET_ID) {
                    requestUpdate(context, appWidgetId)
                } else {
                    android.util.Log.w(
                        "WeatherWidgetProvider",
                        "Received UPDATE_WIDGET action without valid appWidgetId"
                    )
                }
            }
        }
    }

    companion object {
        const val ACTION_UPDATE_WIDGET = "com.vinesight.UPDATE_WIDGET"

        fun requestUpdate(context: Context, appWidgetId: Int? = null) {
            CoroutineScope(Dispatchers.Default).launch {
                val glanceWidget = WeatherGlanceWidget()
                if (appWidgetId == null) {
                    glanceWidget.updateAll(context)
                    return@launch
                }

                val glanceManager = GlanceAppWidgetManager(context)
                val matchingGlanceId = glanceManager
                    .getGlanceIds(WeatherWidgetProvider::class.java)
                    .firstOrNull { glanceManager.getAppWidgetId(it) == appWidgetId }

                if (matchingGlanceId != null) {
                    glanceWidget.update(context, matchingGlanceId)
                } else {
                    glanceWidget.updateAll(context)
                }
            }
        }
    }
}
