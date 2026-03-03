import Foundation

enum AuthFlowEvent {
    case loginRequested
    case phoneLoginRequested
    case otpSent
    case otpVerified(hasCompleteProfile: Bool)
    case restart
}

enum AuthFlowCoordinator {
    static let initialRoute: NativeRouteId = .authPhoneLogin

    static let nativeOwnedRoutes: [NativeRouteId] = [
        .authLogin,
        .authPhoneLogin,
        .authOtpVerification,
        .authProfileCompletion,
    ]

    static func nextRoute(from current: NativeRouteId, event: AuthFlowEvent) -> NativeRouteId {
        switch (current, event) {
        case (_, .restart):
            return initialRoute
        case (_, .loginRequested):
            return .authLogin
        case (_, .phoneLoginRequested):
            return .authPhoneLogin
        case (.authLogin, .otpSent), (.authPhoneLogin, .otpSent):
            return .authOtpVerification
        case (.authOtpVerification, .otpVerified(let hasCompleteProfile)):
            return hasCompleteProfile ? .tabsHome : .authProfileCompletion
        case (.authProfileCompletion, .otpVerified):
            return .tabsHome
        default:
            return current
        }
    }
}
