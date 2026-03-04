import Foundation

enum BootstrapAuthState {
    case loading
    case unauthenticated
    case profileIncomplete
    case authenticated
}

struct BootstrapSnapshot {
    let isLoading: Bool
    let isAuthenticated: Bool
    let needsProfileCompletion: Bool
    let hasProfileName: Bool
    let isProfileLoading: Bool
}

enum BootstrapRouter {
    static func resolve(_ snapshot: BootstrapSnapshot) -> NativeRouteId? {
        if snapshot.isLoading || (snapshot.isAuthenticated && snapshot.isProfileLoading) {
            return nil
        }
        if !snapshot.isAuthenticated {
            return .authPhoneLogin
        }
        if snapshot.needsProfileCompletion || !snapshot.hasProfileName {
            return .authProfileCompletion
        }
        return .tabsHome
    }
}
