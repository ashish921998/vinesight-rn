package com.vinesight

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.glance.GlanceModifier
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetManager
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Column
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.padding
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import androidx.glance.unit.ColorProvider
import androidx.glance.unit.dp
import kotlin.math.roundToInt

/**
 * Compose-powered widget content using Glance.
 */
class WeatherGlanceWidget : GlanceAppWidget() {
    override suspend fun provideGlance(context: Context, id: androidx.glance.GlanceId) {
        val manager = GlanceAppWidgetManager(context)
        val appWidgetId = manager.getAppWidgetId(id)
        val widgetData = WeatherWidgetManager.getWidgetData(context, appWidgetId)

        provideContent {
            WeatherWidgetContent(widgetData)
        }
    }
}

@Composable
private fun WeatherWidgetContent(widgetData: WeatherWidgetManager.WeatherWidgetData?) {
    val titleColor = ColorProvider(day = 0xFFFFFFFF.toInt(), night = 0xFFFFFFFF.toInt())
    val bodyColor = ColorProvider(day = 0xFFE5E7EB.toInt(), night = 0xFFD1D5DB.toInt())

    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .background(ColorProvider(day = 0xFF1F2937.toInt(), night = 0xFF111827.toInt()))
            .padding(16.dp),
        horizontalAlignment = Alignment.Start,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = "VineSight",
            style = TextStyle(color = titleColor, fontWeight = FontWeight.Bold)
        )

        val lines = when {
            widgetData == null -> listOf("No weather data")
            widgetData.status == WeatherWidgetManager.WeatherWidgetStatus.LOADING -> listOf("Loading weather...")
            widgetData.status == WeatherWidgetManager.WeatherWidgetStatus.ERROR -> listOf("Unable to load weather")
            else -> {
                val summary = "${widgetData.temperature.roundToInt()}° ${widgetData.condition}"
                val humidity = "Humidity: ${widgetData.humidity.roundToInt()}%"
                if (widgetData.location.isNotEmpty()) {
                    listOf(summary, widgetData.location, humidity)
                } else {
                    listOf(summary, humidity)
                }
            }
        }

        lines.forEach { line ->
            Text(
                text = line,
                modifier = GlanceModifier.fillMaxWidth().padding(top = 6.dp),
                style = TextStyle(color = bodyColor)
            )
        }
    }
}
