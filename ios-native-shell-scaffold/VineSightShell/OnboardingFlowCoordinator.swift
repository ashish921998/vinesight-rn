import Foundation

enum OnboardingStepId: String, CaseIterable {
    case language
    case welcome
    case features
    case preferences
    case notifications
    case complete
}

enum OnboardingFlowEvent {
    case next
    case previous
    case complete
    case reset
    case skipToComplete
}

enum OnboardingEntryRoute: String {
    case onboarding
    case tabsHome = "tabs.home"
    case authPhoneLogin = "auth.phone_login"
}

struct OnboardingSnapshot {
    let hasHydrated: Bool
    let isAuthenticated: Bool
    let isOnboardingComplete: Bool
}

enum OnboardingFlowCoordinator {
    static let steps: [OnboardingStepId] = OnboardingStepId.allCases

    static func resolveEntryRoute(_ snapshot: OnboardingSnapshot) -> OnboardingEntryRoute {
        if !snapshot.hasHydrated {
            return .onboarding
        }

        if !snapshot.isAuthenticated {
            return .authPhoneLogin
        }

        return snapshot.isOnboardingComplete ? .tabsHome : .onboarding
    }

    static func nextStep(from current: OnboardingStepId, event: OnboardingFlowEvent) -> OnboardingStepId {
        switch event {
        case .next:
            if let index = steps.firstIndex(of: current), index < steps.count - 1 {
                return steps[index + 1]
            }
            return current
        case .previous:
            if let index = steps.firstIndex(of: current), index > 0 {
                return steps[index - 1]
            }
            return current
        case .complete, .skipToComplete:
            return .complete
        case .reset:
            return .language
        }
    }
}
