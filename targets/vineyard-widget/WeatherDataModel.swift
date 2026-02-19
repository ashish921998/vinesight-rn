import WidgetKit
import SwiftUI

struct WeatherData: Codable {
    let farmId: Int
    let farmName: String
    let current: CurrentWeather
    let forecast: [ForecastDay]
    let lastUpdated: TimeInterval
    
    struct CurrentWeather: Codable {
        let temperature: Double
        let condition: String
        let humidity: Double
        let windSpeed: Double
        let icon: String
    }
    
    struct ForecastDay: Codable {
        let day: String
        let high: Double
        let low: Double
        let condition: String
        let icon: String
    }
}

struct WidgetConfig: Codable {
    let selectedFarmId: Int
    let selectedFarmName: String
}

struct WidgetDataPayload: Codable {
    let weather: WeatherData?
    let config: WidgetConfig?
}

struct SimpleEntry: TimelineEntry {
    let date: Date
    let weather: WeatherData?
    let config: WidgetConfig?
    let isStale: Bool
}
