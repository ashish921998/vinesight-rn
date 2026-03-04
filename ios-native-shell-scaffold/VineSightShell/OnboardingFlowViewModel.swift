import Foundation
import SwiftUI

@MainActor
final class OnboardingFlowViewModel: ObservableObject {
    @Published private(set) var step: OnboardingStepId = .language
    @Published var preferredLanguageCode: String = "en"
    @Published var notificationsEnabled: Bool = true

    func next() {
        step = OnboardingFlowCoordinator.nextStep(from: step, event: .next)
    }

    func previous() {
        step = OnboardingFlowCoordinator.nextStep(from: step, event: .previous)
    }

    func complete() {
        step = OnboardingFlowCoordinator.nextStep(from: step, event: .complete)
    }

    func skipToComplete() {
        step = OnboardingFlowCoordinator.nextStep(from: step, event: .skipToComplete)
    }

    func reset() {
        step = OnboardingFlowCoordinator.nextStep(from: step, event: .reset)
    }
}
