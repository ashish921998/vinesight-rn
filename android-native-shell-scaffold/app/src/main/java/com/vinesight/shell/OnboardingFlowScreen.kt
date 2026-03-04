package com.vinesight.shell

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun OnboardingFlowScreen(
    viewModel: OnboardingFlowViewModel,
    modifier: Modifier = Modifier,
) {
    val step by viewModel.step.collectAsState()
    val preferredLanguageCode by viewModel.preferredLanguageCode.collectAsState()
    val notificationsEnabled by viewModel.notificationsEnabled.collectAsState()

    Column(
        modifier = modifier.padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        when (step) {
            OnboardingStepId.LANGUAGE -> LanguageStep(
                preferredLanguageCode = preferredLanguageCode,
                onSelectLanguage = viewModel::updatePreferredLanguageCode,
                onNext = viewModel::next,
                onSkip = viewModel::skipToComplete,
            )

            OnboardingStepId.WELCOME -> InfoStep(
                title = "Welcome",
                description = "VineSight helps you track farm operations, tasks, and insights.",
                onNext = viewModel::next,
                onPrevious = viewModel::previous,
            )

            OnboardingStepId.FEATURES -> InfoStep(
                title = "Core Features",
                description = "Logs, reports, worker tracking, and assistant workflows.",
                onNext = viewModel::next,
                onPrevious = viewModel::previous,
            )

            OnboardingStepId.PREFERENCES -> InfoStep(
                title = "Preferences",
                description = "Set defaults for units, reminders, and quick entry.",
                onNext = viewModel::next,
                onPrevious = viewModel::previous,
            )

            OnboardingStepId.NOTIFICATIONS -> NotificationsStep(
                notificationsEnabled = notificationsEnabled,
                onNotificationsChanged = viewModel::updateNotificationsEnabled,
                onComplete = viewModel::complete,
                onPrevious = viewModel::previous,
            )

            OnboardingStepId.COMPLETE -> CompleteStep(onRestart = viewModel::reset)
        }
    }
}

@Composable
private fun LanguageStep(
    preferredLanguageCode: String,
    onSelectLanguage: (String) -> Unit,
    onNext: () -> Unit,
    onSkip: () -> Unit,
) {
    Text("Choose Language", style = MaterialTheme.typography.headlineSmall)
    Text("Current: $preferredLanguageCode")
    Button(onClick = { onSelectLanguage("en") }, modifier = Modifier.fillMaxWidth()) { Text("English") }
    Button(onClick = { onSelectLanguage("mr") }, modifier = Modifier.fillMaxWidth()) { Text("Marathi") }
    Button(onClick = { onSelectLanguage("hi") }, modifier = Modifier.fillMaxWidth()) { Text("Hindi") }
    Button(onClick = onNext, modifier = Modifier.fillMaxWidth()) { Text("Continue") }
    Button(onClick = onSkip, modifier = Modifier.fillMaxWidth()) { Text("Skip onboarding") }
}

@Composable
private fun InfoStep(
    title: String,
    description: String,
    onNext: () -> Unit,
    onPrevious: () -> Unit,
) {
    Text(title, style = MaterialTheme.typography.headlineSmall)
    Text(description)
    Button(onClick = onPrevious, modifier = Modifier.fillMaxWidth()) { Text("Back") }
    Button(onClick = onNext, modifier = Modifier.fillMaxWidth()) { Text("Next") }
}

@Composable
private fun NotificationsStep(
    notificationsEnabled: Boolean,
    onNotificationsChanged: (Boolean) -> Unit,
    onComplete: () -> Unit,
    onPrevious: () -> Unit,
) {
    Text("Notifications", style = MaterialTheme.typography.headlineSmall)
    Switch(checked = notificationsEnabled, onCheckedChange = onNotificationsChanged)
    Button(onClick = onPrevious, modifier = Modifier.fillMaxWidth()) { Text("Back") }
    Button(onClick = onComplete, modifier = Modifier.fillMaxWidth()) { Text("Finish") }
}

@Composable
private fun CompleteStep(onRestart: () -> Unit) {
    Text("Onboarding Complete", style = MaterialTheme.typography.headlineSmall)
    Text("User can now transition into tabs shell.")
    Button(onClick = onRestart, modifier = Modifier.fillMaxWidth()) { Text("Restart onboarding") }
}
