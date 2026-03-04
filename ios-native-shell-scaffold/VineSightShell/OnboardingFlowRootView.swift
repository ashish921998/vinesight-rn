import SwiftUI

struct OnboardingFlowRootView: View {
    @StateObject private var viewModel = OnboardingFlowViewModel()

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            switch viewModel.step {
            case .language:
                OnboardingLanguageStep(
                    preferredLanguageCode: $viewModel.preferredLanguageCode,
                    onNext: viewModel.next,
                    onSkip: viewModel.skipToComplete
                )
            case .welcome:
                OnboardingWelcomeStep(onNext: viewModel.next, onPrevious: viewModel.previous)
            case .features:
                OnboardingFeaturesStep(onNext: viewModel.next, onPrevious: viewModel.previous)
            case .preferences:
                OnboardingPreferencesStep(onNext: viewModel.next, onPrevious: viewModel.previous)
            case .notifications:
                OnboardingNotificationsStep(
                    notificationsEnabled: $viewModel.notificationsEnabled,
                    onComplete: viewModel.complete,
                    onPrevious: viewModel.previous
                )
            case .complete:
                OnboardingCompleteStep(onRestart: viewModel.reset)
            }
        }
        .padding(24)
    }
}

private struct OnboardingLanguageStep: View {
    @Binding var preferredLanguageCode: String
    let onNext: () -> Void
    let onSkip: () -> Void

    var body: some View {
        Text("Choose Language")
            .font(.title2.bold())
        Picker("Language", selection: $preferredLanguageCode) {
            Text("English").tag("en")
            Text("Marathi").tag("mr")
            Text("Hindi").tag("hi")
        }
        .pickerStyle(.segmented)
        Button("Continue") { onNext() }
            .buttonStyle(.borderedProminent)
        Button("Skip onboarding") { onSkip() }
            .buttonStyle(.bordered)
    }
}

private struct OnboardingWelcomeStep: View {
    let onNext: () -> Void
    let onPrevious: () -> Void

    var body: some View {
        Text("Welcome")
            .font(.title2.bold())
        Text("VineSight helps you track farm operations, tasks, and insights.")
            .foregroundStyle(.secondary)
        HStack {
            Button("Back") { onPrevious() }
            Button("Next") { onNext() }
                .buttonStyle(.borderedProminent)
        }
    }
}

private struct OnboardingFeaturesStep: View {
    let onNext: () -> Void
    let onPrevious: () -> Void

    var body: some View {
        Text("Core Features")
            .font(.title2.bold())
        Text("Logs, reports, worker tracking, and assistant workflows.")
            .foregroundStyle(.secondary)
        HStack {
            Button("Back") { onPrevious() }
            Button("Next") { onNext() }
                .buttonStyle(.borderedProminent)
        }
    }
}

private struct OnboardingPreferencesStep: View {
    let onNext: () -> Void
    let onPrevious: () -> Void

    var body: some View {
        Text("Preferences")
            .font(.title2.bold())
        Text("Set defaults for units, reminders, and quick entry.")
            .foregroundStyle(.secondary)
        HStack {
            Button("Back") { onPrevious() }
            Button("Next") { onNext() }
                .buttonStyle(.borderedProminent)
        }
    }
}

private struct OnboardingNotificationsStep: View {
    @Binding var notificationsEnabled: Bool
    let onComplete: () -> Void
    let onPrevious: () -> Void

    var body: some View {
        Text("Notifications")
            .font(.title2.bold())
        Toggle("Enable reminders", isOn: $notificationsEnabled)
        HStack {
            Button("Back") { onPrevious() }
            Button("Finish") { onComplete() }
                .buttonStyle(.borderedProminent)
        }
    }
}

private struct OnboardingCompleteStep: View {
    let onRestart: () -> Void

    var body: some View {
        Text("Onboarding Complete")
            .font(.title2.bold())
        Text("User can now transition into tabs shell.")
            .foregroundStyle(.secondary)
        Button("Restart onboarding") { onRestart() }
            .buttonStyle(.bordered)
    }
}

#Preview {
    OnboardingFlowRootView()
}
