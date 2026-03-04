package com.vinesight.shell

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class OnboardingFlowViewModel {
    private val _step = MutableStateFlow(OnboardingStepId.LANGUAGE)
    val step: StateFlow<OnboardingStepId> = _step.asStateFlow()

    private val _preferredLanguageCode = MutableStateFlow("en")
    val preferredLanguageCode: StateFlow<String> = _preferredLanguageCode.asStateFlow()

    private val _notificationsEnabled = MutableStateFlow(true)
    val notificationsEnabled: StateFlow<Boolean> = _notificationsEnabled.asStateFlow()

    fun updatePreferredLanguageCode(value: String) {
        _preferredLanguageCode.value = value
    }

    fun updateNotificationsEnabled(value: Boolean) {
        _notificationsEnabled.value = value
    }

    fun next() {
        dispatch(OnboardingFlowEvent.Next)
    }

    fun previous() {
        dispatch(OnboardingFlowEvent.Previous)
    }

    fun complete() {
        dispatch(OnboardingFlowEvent.Complete)
    }

    fun reset() {
        dispatch(OnboardingFlowEvent.Reset)
    }

    fun skipToComplete() {
        dispatch(OnboardingFlowEvent.SkipToComplete)
    }

    private fun dispatch(event: OnboardingFlowEvent) {
        _step.value = OnboardingFlowCoordinator.nextStep(_step.value, event)
    }
}
