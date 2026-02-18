import WidgetKit
import SwiftUI

struct Provider: TimelineProvider {
    typealias Entry = SimpleEntry
    let appGroupID = "group.com.vinesight.app"
    
    func placeholder(in context: Context) -> SimpleEntry {
        SimpleEntry(
            date: Date(),
            weather: sampleWeatherData(),
            config: WidgetConfig(selectedFarmId: 1, selectedFarmName: "Sample Farm"),
            isStale: false
        )
    }
    
    func getSnapshot(in context: Context, completion: @escaping (SimpleEntry) -> Void) {
        let entry = loadWidgetData()
        completion(entry)
    }
    
    func getTimeline(in context: Context, completion: @escaping (Timeline<SimpleEntry>) -> Void) {
        let entry = loadWidgetData()

        // Update every 15 minutes (widgets have limits on update frequency)
        guard let nextUpdateDate = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) else {
            completion(Timeline(entries: [entry], policy: .atEnd))
            return
        }
        let timeline = Timeline(entries: [entry], policy: .after(nextUpdateDate))

        completion(timeline)
    }
    
    private func loadWidgetData() -> SimpleEntry {
        guard let defaults = UserDefaults(suiteName: appGroupID) else {
            return errorEntry(message: "Unable to Load")
        }
        
        // Load weather data and (new) config from payload
        var weather: WeatherData? = nil
        var config: WidgetConfig? = nil
        if let data = defaults.data(forKey: "widgetData") {
            if let decoded = try? JSONDecoder().decode(WidgetDataPayload.self, from: data) {
                weather = decoded.weather
                config = decoded.config
            } else if let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                      let configObject = root["config"],
                      let configData = try? JSONSerialization.data(withJSONObject: configObject),
                      let extractedConfig = try? JSONDecoder().decode(WidgetConfig.self, from: configData) {
                // Fallback: keep reading config even if WeatherData payload shape drifts.
                config = extractedConfig
            }
        }
        
        // Backward compatibility: if payload has no config, read legacy key
        if config == nil,
           let configData = defaults.data(forKey: "widgetConfig"),
           let decodedConfig = try? JSONDecoder().decode(WidgetConfig.self, from: configData) {
            config = decodedConfig
        }
        
        // Check if data is stale (older than 24 hours)
        // Nil weather is considered stale so the widget can show a warning/placeholder state.
        // JS sends Date.now() in milliseconds; convert to seconds for comparison
        let isStale: Bool
        if let lastUpdated = weather?.lastUpdated {
            let lastUpdatedSec = lastUpdated > 1_000_000_000_000 ? lastUpdated / 1000.0 : lastUpdated
            let twentyFourHoursAgo = Date().addingTimeInterval(-24 * 60 * 60).timeIntervalSince1970
            isStale = lastUpdatedSec < twentyFourHoursAgo
        } else {
            isStale = true
        }
        
        return SimpleEntry(
            date: Date(),
            weather: weather,
            config: config,
            isStale: isStale
        )
    }
    
    private func errorEntry(message: String) -> SimpleEntry {
        SimpleEntry(
            date: Date(),
            weather: nil,
            config: nil,
            isStale: true
        )
    }
    
    private func sampleWeatherData() -> WeatherData {
        WeatherData(
            farmId: 1,
            farmName: "Vineyard",
            current: WeatherData.CurrentWeather(
                temperature: 72,
                condition: "Sunny",
                humidity: 65,
                windSpeed: 12,
                icon: "sun.max.fill"
            ),
            forecast: [
                WeatherData.ForecastDay(day: "Mon", high: 75, low: 60, condition: "Sunny", icon: "sun.max.fill"),
                WeatherData.ForecastDay(day: "Tue", high: 73, low: 58, condition: "Partly Cloudy", icon: "cloud.sun.fill"),
                WeatherData.ForecastDay(day: "Wed", high: 70, low: 55, condition: "Cloudy", icon: "cloud.fill")
            ],
            lastUpdated: Date().timeIntervalSince1970
        )
    }
}
