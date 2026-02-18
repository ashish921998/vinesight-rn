import WidgetKit
import SwiftUI

struct VineyardWidgetEntryView: View {
    var entry: Provider.Entry
    @Environment(\.widgetFamily) var family
    
    var body: some View {
        switch family {
        case .systemLarge:
            LargeWidgetView(entry: entry)
        default:
            LargeWidgetView(entry: entry) // Default to large
        }
    }
}

struct LargeWidgetView: View {
    let entry: Provider.Entry
    
    var body: some View {
        VStack(spacing: 12) {
            // Header with farm name
            if let farmName = entry.config?.selectedFarmName ?? entry.weather?.farmName {
                HStack {
                    Image(systemName: "leaf.fill")
                        .foregroundColor(.green)
                    Text(farmName)
                        .font(.headline)
                        .fontWeight(.semibold)
                    Spacer()
                }
            }
            
            if let weather = entry.weather {
                // Current weather section
                HStack(alignment: .center, spacing: 16) {
                    // Weather icon and temp
                    VStack(alignment: .leading, spacing: 4) {
                        Image(systemName: iconName(for: weather.current.icon))
                            .font(.system(size: 44))
                            .foregroundColor(.orange)
                        
                        Text("\(Int(weather.current.temperature))°")
                            .font(.system(size: 36, weight: .bold))
                        
                        Text(weather.current.condition)
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                    }
                    
                    Spacer()
                    
                    // Weather details
                    VStack(alignment: .trailing, spacing: 8) {
                        HStack {
                            Image(systemName: "humidity.fill")
                                .foregroundColor(.blue)
                            Text("\(Int(weather.current.humidity))%")
                                .font(.subheadline)
                        }
                        
                        HStack {
                            Image(systemName: "wind")
                                .foregroundColor(.gray)
                            Text("\(Int(weather.current.windSpeed)) km/h")
                                .font(.subheadline)
                        }
                    }
                }
                
                Divider()
                
                // 3-day forecast
                HStack(spacing: 20) {
                    ForEach(weather.forecast.prefix(3), id: \.day) { day in
                        VStack(spacing: 6) {
                            Text(day.day)
                                .font(.caption)
                                .fontWeight(.medium)
                            
                            Image(systemName: iconName(for: day.icon))
                                .font(.title3)
                                .foregroundColor(.orange)
                            
                            Text("\(Int(day.high))°")
                                .font(.subheadline)
                                .fontWeight(.semibold)
                            
                            Text("\(Int(day.low))°")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                        .frame(maxWidth: .infinity)
                    }
                }
                
                Spacer()
                
                // Last updated timestamp
                if entry.isStale {
                    HStack {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundColor(.orange)
                            .font(.caption)
                        Text("widget.data_outdated")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                        Spacer()
                    }
                } else {
                    HStack {
                        Spacer()
                        Text("widget.updated_prefix \(formattedDate(weather.lastUpdated))")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }
            } else {
                // No data state
                VStack(spacing: 12) {
                    Image(systemName: "cloud.sun.fill")
                        .font(.system(size: 48))
                        .foregroundColor(.gray)
                    
                    Text("widget.unable_to_load")
                        .font(.headline)
                        .foregroundColor(.secondary)
                    
                    Text("widget.open_app_to_sync")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                }
                .frame(maxHeight: .infinity)
            }
        }
        .padding()
        .widgetURL(URL(string: "vinesight://weather?farmId=\(entry.config?.selectedFarmId ?? entry.weather?.farmId ?? 0)"))
    }
    
    private func iconName(for condition: String) -> String {
        switch condition.lowercased() {
        case let c where c.contains("sun") || c.contains("clear"):
            return "sun.max.fill"
        case let c where c.contains("partly") || c.contains("partly-cloudy"):
            return "cloud.sun.fill"
        case let c where c.contains("cloud") && !c.contains("sun"):
            return "cloud.fill"
        case let c where c.contains("rain"):
            return "cloud.rain.fill"
        case let c where c.contains("storm") || c.contains("thunder"):
            return "cloud.bolt.fill"
        case let c where c.contains("snow"):
            return "snowflake"
        default:
            return "sun.max.fill"
        }
    }
    
    private func formattedDate(_ timestamp: TimeInterval) -> String {
        // JS sends Date.now() in milliseconds; convert to seconds for Date
        let seconds = timestamp > 1_000_000_000_000 ? timestamp / 1000.0 : timestamp
        let date = Date(timeIntervalSince1970: seconds)
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .short
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}

@main
struct VineyardWidget: Widget {
    let kind: String = "VineyardWidget"
    
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: Provider()) { entry in
            VineyardWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("widget.configuration_display_name")
        .description("widget.configuration_description")
        .supportedFamilies([.systemLarge])
    }
}

struct VineyardWidget_Previews: PreviewProvider {
    static var previews: some View {
        VineyardWidgetEntryView(
            entry: SimpleEntry(
                date: Date(),
                weather: WeatherData(
                    farmId: 1,
                    farmName: "San Jose Vineyard",
                    current: WeatherData.CurrentWeather(
                        temperature: 72,
                        condition: "Partly Cloudy",
                        humidity: 65,
                        windSpeed: 12,
                        icon: "partly-cloudy"
                    ),
                    forecast: [
                        WeatherData.ForecastDay(day: "Tue", high: 75, low: 60, condition: "Sunny", icon: "sunny"),
                        WeatherData.ForecastDay(day: "Wed", high: 68, low: 58, condition: "Rainy", icon: "rainy"),
                        WeatherData.ForecastDay(day: "Thu", high: 78, low: 62, condition: "Sunny", icon: "sunny")
                    ],
                    lastUpdated: Date().timeIntervalSince1970
                ),
                config: nil,
                isStale: false
            )
        )
        .previewContext(WidgetPreviewContext(family: .systemLarge))
    }
}
