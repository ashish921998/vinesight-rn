import SwiftUI

struct AuthFlowRootView: View {
    @StateObject private var viewModel = AuthFlowViewModel()

    var body: some View {
        Group {
            switch viewModel.route {
            case .authLogin:
                AuthLoginView(
                    onSwitchToPhone: viewModel.showPhoneLogin,
                    onContinue: viewModel.submitEntry
                )
            case .authPhoneLogin:
                AuthPhoneLoginView(
                    phoneNumber: $viewModel.phoneNumber,
                    onSwitchToEmail: viewModel.showEmailLogin,
                    onContinue: viewModel.submitEntry
                )
            case .authOtpVerification:
                AuthOtpVerificationView(
                    otpCode: $viewModel.otpCode,
                    onBackToPhone: viewModel.showPhoneLogin,
                    onSubmitOtp: {
                        // Profile completion is driven by backend flags in production.
                        viewModel.verifyOtp(hasCompleteProfile: false)
                    },
                    onSubmitOtpAndSkipProfile: {
                        viewModel.verifyOtp(hasCompleteProfile: true)
                    }
                )
            case .authProfileCompletion:
                AuthProfileCompletionView(
                    profileName: $viewModel.profileName,
                    onSubmitProfile: {
                        viewModel.verifyOtp(hasCompleteProfile: true)
                    }
                )
            case .tabsHome:
                AuthCompletionView(onRestart: viewModel.restart)
            default:
                AuthUnsupportedRouteView(route: viewModel.route)
            }
        }
        .padding(24)
    }
}

private struct AuthLoginView: View {
    let onSwitchToPhone: () -> Void
    let onContinue: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Welcome to VineSight")
                .font(.title2.bold())
            Text("Use your account credentials to continue.")
                .foregroundStyle(.secondary)
            Button("Continue") { onContinue() }
                .buttonStyle(.borderedProminent)
            Button("Use phone login") { onSwitchToPhone() }
                .buttonStyle(.bordered)
        }
    }
}

private struct AuthPhoneLoginView: View {
    @Binding var phoneNumber: String
    let onSwitchToEmail: () -> Void
    let onContinue: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Phone Login")
                .font(.title2.bold())
            TextField("Phone number", text: $phoneNumber)
                .textInputAutocapitalization(.never)
                .keyboardType(.phonePad)
                .textFieldStyle(.roundedBorder)
            Button("Send OTP") { onContinue() }
                .buttonStyle(.borderedProminent)
            Button("Use email login") { onSwitchToEmail() }
                .buttonStyle(.bordered)
        }
    }
}

private struct AuthOtpVerificationView: View {
    @Binding var otpCode: String
    let onBackToPhone: () -> Void
    let onSubmitOtp: () -> Void
    let onSubmitOtpAndSkipProfile: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Verify OTP")
                .font(.title2.bold())
            TextField("6-digit code", text: $otpCode)
                .keyboardType(.numberPad)
                .textFieldStyle(.roundedBorder)
            Button("Verify and continue") { onSubmitOtp() }
                .buttonStyle(.borderedProminent)
            Button("Verify and go to home") { onSubmitOtpAndSkipProfile() }
                .buttonStyle(.bordered)
            Button("Back") { onBackToPhone() }
                .buttonStyle(.borderless)
        }
    }
}

private struct AuthProfileCompletionView: View {
    @Binding var profileName: String
    let onSubmitProfile: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Complete Profile")
                .font(.title2.bold())
            TextField("Display name", text: $profileName)
                .textInputAutocapitalization(.words)
                .textFieldStyle(.roundedBorder)
            Button("Save and enter app") { onSubmitProfile() }
                .buttonStyle(.borderedProminent)
        }
    }
}

private struct AuthCompletionView: View {
    let onRestart: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Native auth flow complete")
                .font(.title2.bold())
            Text("Route now points to tabs shell.")
                .foregroundStyle(.secondary)
            Button("Restart auth flow") { onRestart() }
                .buttonStyle(.bordered)
        }
    }
}

private struct AuthUnsupportedRouteView: View {
    let route: NativeRouteId

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Unsupported route in auth shell")
                .font(.headline)
            Text(route.rawValue)
                .font(.footnote.monospaced())
                .foregroundStyle(.secondary)
        }
    }
}

#Preview {
    AuthFlowRootView()
}
