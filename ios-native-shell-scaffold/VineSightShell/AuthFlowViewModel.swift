import Foundation
import SwiftUI

@MainActor
final class AuthFlowViewModel: ObservableObject {
    @Published private(set) var route: NativeRouteId = AuthFlowCoordinator.initialRoute
    @Published var phoneNumber: String = ""
    @Published var otpCode: String = ""
    @Published var profileName: String = ""

    func restart() {
        route = AuthFlowCoordinator.nextRoute(from: route, event: .restart)
    }

    func showEmailLogin() {
        route = AuthFlowCoordinator.nextRoute(from: route, event: .loginRequested)
    }

    func showPhoneLogin() {
        route = AuthFlowCoordinator.nextRoute(from: route, event: .phoneLoginRequested)
    }

    func submitEntry() {
        route = AuthFlowCoordinator.nextRoute(from: route, event: .otpSent)
    }

    func verifyOtp(hasCompleteProfile: Bool) {
        route = AuthFlowCoordinator.nextRoute(
            from: route,
            event: .otpVerified(hasCompleteProfile: hasCompleteProfile)
        )
    }

    var shouldRenderTabsShell: Bool {
        route == .tabsHome
    }
}
