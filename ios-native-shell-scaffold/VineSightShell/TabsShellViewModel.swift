import Foundation
import SwiftUI

@MainActor
final class TabsShellViewModel: ObservableObject {
    @Published private(set) var currentRoute: NativeRouteId = .tabsHome

    var selectedTab: NativeTabSelection {
        TabsFlowCoordinator.resolveTab(from: currentRoute)
    }

    func select(tab: NativeTabSelection) {
        currentRoute = TabsFlowCoordinator.nextRoute(current: currentRoute, event: .select(tab: tab))
    }

    func resetHome() {
        currentRoute = TabsFlowCoordinator.nextRoute(current: currentRoute, event: .resetHome)
    }
}
