package com.vinesight.shell

enum class OnboardingStepId {
    LANGUAGE,
    WELCOME,
    FEATURES,
    PREFERENCES,
    NOTIFICATIONS,
    COMPLETE,
}

sealed interface OnboardingFlowEvent {
    data object Next : OnboardingFlowEvent
    data object Previous : OnboardingFlowEvent
    data object Complete : OnboardingFlowEvent
    data object Reset : OnboardingFlowEvent
    data object SkipToComplete : OnboardingFlowEvent
}

enum class OnboardingEntryRoute(val routeId: String) {
    ONBOARDING("onboarding"),
    TABS_HOME("tabs.home"),
    AUTH_PHONE_LOGIN("auth.phone_login"),
}

data class OnboardingSnapshot(
    val hasHydrated: Boolean,
    val isAuthenticated: Boolean,
    val isOnboardingComplete: Boolean,
)

object OnboardingFlowCoordinator {
    private val steps: List<OnboardingStepId> = OnboardingStepId.entries

    fun resolveEntryRoute(snapshot: OnboardingSnapshot): OnboardingEntryRoute {
        if (!snapshot.hasHydrated) return OnboardingEntryRoute.ONBOARDING
        if (!snapshot.isAuthenticated) return OnboardingEntryRoute.AUTH_PHONE_LOGIN
        return if (snapshot.isOnboardingComplete) {
            OnboardingEntryRoute.TABS_HOME
        } else {
            OnboardingEntryRoute.ONBOARDING
        }
    }

    fun nextStep(current: OnboardingStepId, event: OnboardingFlowEvent): OnboardingStepId {
        return when (event) {
            OnboardingFlowEvent.Next -> {
                val index = steps.indexOf(current)
                if (index in 0 until steps.lastIndex) steps[index + 1] else current
            }

            OnboardingFlowEvent.Previous -> {
                val index = steps.indexOf(current)
                if (index > 0) steps[index - 1] else current
            }

            OnboardingFlowEvent.Complete,
            OnboardingFlowEvent.SkipToComplete -> OnboardingStepId.COMPLETE

            OnboardingFlowEvent.Reset -> OnboardingStepId.LANGUAGE
        }
    }
}
