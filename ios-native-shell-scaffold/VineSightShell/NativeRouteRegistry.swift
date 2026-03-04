import Foundation

enum NativeRouteId: String, CaseIterable {
    case authLogin = "auth.login"
    case authPhoneLogin = "auth.phone_login"
    case authOtpVerification = "auth.otp_verification"
    case authProfileCompletion = "auth.profile_completion"
    case onboarding = "onboarding"
    case tabsHome = "tabs.home"
    case tabsFarms = "tabs.farms"
    case tabsTools = "tabs.tools"
    case tabsWorkers = "tabs.workers"
    case tabsSettings = "tabs.settings"
}

enum NativeTabId: String, CaseIterable {
    case home
    case farms
    case tools
    case workers
    case settings
}

struct NativeShellRegistry {
    static let tabs: [NativeTabId] = NativeTabId.allCases
    static let routes: [NativeRouteId] = NativeRouteId.allCases
}
