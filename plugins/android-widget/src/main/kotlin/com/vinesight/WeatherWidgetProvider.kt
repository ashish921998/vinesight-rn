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
        // GlanceAppWidgetReceiver.onUpdate already schedules a Glance update;
        // calling requestUpdate here too would render every widget twice.
        super.onUpdate(context, appWidgetManager, appWidgetIds)
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
            // Fire-and-forget; guard the body so a failure in any suspend call
            // (updateAll/update/getGlanceIds) can't surface as an unhandled
            // coroutine exception and crash the host process.
            CoroutineScope(Dispatchers.Default).launch {
                try {
                    val glanceWidget = WeatherGlanceWidget()
                    if (appWidgetId == null) {
                        glanceWidget.updateAll(context)
                        return@launch
                    }

                    val glanceManager = GlanceAppWidgetManager(context)
                    // getGlanceIds expects the GlanceAppWidget subclass, not the receiver.
                    val matchingGlanceId = glanceManager
                        .getGlanceIds(WeatherGlanceWidget::class.java)
                        .firstOrNull { glanceManager.getAppWidgetId(it) == appWidgetId }

                    if (matchingGlanceId != null) {
                        glanceWidget.update(context, matchingGlanceId)
                    } else {
                        glanceWidget.updateAll(context)
                    }
                } catch (t: Throwable) {
                    android.util.Log.e("WeatherWidgetProvider", "Widget update failed", t)
                }
            }
        }
    }
}
