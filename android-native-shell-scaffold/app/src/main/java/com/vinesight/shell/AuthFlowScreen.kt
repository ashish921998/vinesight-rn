package com.vinesight.shell

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp

@Composable
fun AuthFlowScreen(
    viewModel: AuthFlowViewModel,
    modifier: Modifier = Modifier,
) {
    val route by viewModel.route.collectAsState()
    val phoneNumber by viewModel.phoneNumber.collectAsState()
    val otpCode by viewModel.otpCode.collectAsState()
    val profileName by viewModel.profileName.collectAsState()

    Column(
        modifier = modifier.padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        when (route) {
            NativeRouteId.AUTH_LOGIN -> AuthLoginScreen(
                onContinue = viewModel::submitEntry,
                onSwitchToPhone = viewModel::showPhoneLogin,
            )

            NativeRouteId.AUTH_PHONE_LOGIN -> AuthPhoneLoginScreen(
                phoneNumber = phoneNumber,
                onPhoneNumberChanged = viewModel::updatePhoneNumber,
                onContinue = viewModel::submitEntry,
                onSwitchToEmail = viewModel::showEmailLogin,
            )

            NativeRouteId.AUTH_OTP_VERIFICATION -> AuthOtpVerificationScreen(
                otpCode = otpCode,
                onOtpChanged = viewModel::updateOtpCode,
                onBack = viewModel::showPhoneLogin,
                onVerifyWithProfile = { viewModel.verifyOtp(hasCompleteProfile = false) },
                onVerifyToHome = { viewModel.verifyOtp(hasCompleteProfile = true) },
            )

            NativeRouteId.AUTH_PROFILE_COMPLETION -> AuthProfileCompletionScreen(
                profileName = profileName,
                onProfileNameChanged = viewModel::updateProfileName,
                onSubmitProfile = { viewModel.verifyOtp(hasCompleteProfile = true) },
            )

            NativeRouteId.TABS_HOME -> AuthCompletionScreen(onRestart = viewModel::restart)
            else -> UnsupportedAuthRoute(route = route)
        }
    }
}

@Composable
private fun AuthLoginScreen(
    onContinue: () -> Unit,
    onSwitchToPhone: () -> Unit,
) {
    Text("Welcome to VineSight", style = MaterialTheme.typography.headlineSmall)
    Text("Use your account credentials to continue.")
    Button(onClick = onContinue, modifier = Modifier.fillMaxWidth()) {
        Text("Continue")
    }
    Button(onClick = onSwitchToPhone, modifier = Modifier.fillMaxWidth()) {
        Text("Use phone login")
    }
}

@Composable
private fun AuthPhoneLoginScreen(
    phoneNumber: String,
    onPhoneNumberChanged: (String) -> Unit,
    onContinue: () -> Unit,
    onSwitchToEmail: () -> Unit,
) {
    Text("Phone Login", style = MaterialTheme.typography.headlineSmall)
    OutlinedTextField(
        value = phoneNumber,
        onValueChange = onPhoneNumberChanged,
        label = { Text("Phone number") },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
        modifier = Modifier.fillMaxWidth(),
    )
    Button(onClick = onContinue, modifier = Modifier.fillMaxWidth()) {
        Text("Send OTP")
    }
    Button(onClick = onSwitchToEmail, modifier = Modifier.fillMaxWidth()) {
        Text("Use email login")
    }
}

@Composable
private fun AuthOtpVerificationScreen(
    otpCode: String,
    onOtpChanged: (String) -> Unit,
    onBack: () -> Unit,
    onVerifyWithProfile: () -> Unit,
    onVerifyToHome: () -> Unit,
) {
    Text("Verify OTP", style = MaterialTheme.typography.headlineSmall)
    OutlinedTextField(
        value = otpCode,
        onValueChange = onOtpChanged,
        label = { Text("6-digit code") },
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
        modifier = Modifier.fillMaxWidth(),
    )
    Button(onClick = onVerifyWithProfile, modifier = Modifier.fillMaxWidth()) {
        Text("Verify and continue")
    }
    Button(onClick = onVerifyToHome, modifier = Modifier.fillMaxWidth()) {
        Text("Verify and go to home")
    }
    Button(onClick = onBack, modifier = Modifier.fillMaxWidth()) {
        Text("Back")
    }
}

@Composable
private fun AuthProfileCompletionScreen(
    profileName: String,
    onProfileNameChanged: (String) -> Unit,
    onSubmitProfile: () -> Unit,
) {
    Text("Complete Profile", style = MaterialTheme.typography.headlineSmall)
    OutlinedTextField(
        value = profileName,
        onValueChange = onProfileNameChanged,
        label = { Text("Display name") },
        modifier = Modifier.fillMaxWidth(),
    )
    Button(onClick = onSubmitProfile, modifier = Modifier.fillMaxWidth()) {
        Text("Save and enter app")
    }
}

@Composable
private fun AuthCompletionScreen(onRestart: () -> Unit) {
    Text("Native auth flow complete", style = MaterialTheme.typography.headlineSmall)
    Text("Route now points to tabs shell.")
    Button(onClick = onRestart, modifier = Modifier.fillMaxWidth()) {
        Text("Restart auth flow")
    }
}

@Composable
private fun UnsupportedAuthRoute(route: NativeRouteId) {
    Text("Unsupported route in auth shell", style = MaterialTheme.typography.titleMedium)
    Text(route.raw)
}
