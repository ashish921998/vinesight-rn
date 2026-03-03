import Foundation

enum NativeTabSelection: String, CaseIterable {
    case home
    case farms
    case tools
    case workers
    case settings
}

enum TabsFlowEvent {
    case select(tab: NativeTabSelection)
    case resetHome
}

enum TabsFlowCoordinator {
    static let defaultTab: NativeTabSelection = .home

    static func routeId(for tab: NativeTabSelection) -> NativeRouteId {
        switch tab {
        case .home: return .tabsHome
        case .farms: return .tabsFarms
        case .tools: return .tabsTools
        case .workers: return .tabsWorkers
        case .settings: return .tabsSettings
        }
    }

    static func resolveTab(from routeId: NativeRouteId) -> NativeTabSelection {
        switch routeId {
        case .tabsFarms: return .farms
        case .tabsTools: return .tools
        case .tabsWorkers: return .workers
        case .tabsSettings: return .settings
        default: return .home
        }
    }

    static func nextRoute(current: NativeRouteId, event: TabsFlowEvent) -> NativeRouteId {
        switch event {
        case .select(let tab):
            return routeId(for: tab)
        case .resetHome:
            return .tabsHome
        }
    }
}
