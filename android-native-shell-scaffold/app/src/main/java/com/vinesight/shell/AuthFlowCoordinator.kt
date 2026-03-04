package com.vinesight.shell

sealed interface AuthFlowEvent {
    data object LoginRequested : AuthFlowEvent
    data object PhoneLoginRequested : AuthFlowEvent
    data object OtpSent : AuthFlowEvent
    data class OtpVerified(val hasCompleteProfile: Boolean) : AuthFlowEvent
    data object Restart : AuthFlowEvent
}

object AuthFlowCoordinator {
    val initialRoute: NativeRouteId = NativeRouteId.AUTH_PHONE_LOGIN

    val nativeOwnedRoutes: List<NativeRouteId> = listOf(
        NativeRouteId.AUTH_LOGIN,
        NativeRouteId.AUTH_PHONE_LOGIN,
        NativeRouteId.AUTH_OTP_VERIFICATION,
        NativeRouteId.AUTH_PROFILE_COMPLETION,
    )

    fun nextRoute(current: NativeRouteId, event: AuthFlowEvent): NativeRouteId {
        return when (event) {
            AuthFlowEvent.Restart -> initialRoute
            AuthFlowEvent.LoginRequested -> NativeRouteId.AUTH_LOGIN
            AuthFlowEvent.PhoneLoginRequested -> NativeRouteId.AUTH_PHONE_LOGIN
            AuthFlowEvent.OtpSent -> {
                if (current == NativeRouteId.AUTH_LOGIN || current == NativeRouteId.AUTH_PHONE_LOGIN) {
                    NativeRouteId.AUTH_OTP_VERIFICATION
                } else {
                    current
                }
            }

            is AuthFlowEvent.OtpVerified -> {
                when {
                    current == NativeRouteId.AUTH_OTP_VERIFICATION && event.hasCompleteProfile ->
                        NativeRouteId.TABS_HOME
                    current == NativeRouteId.AUTH_OTP_VERIFICATION ->
                        NativeRouteId.AUTH_PROFILE_COMPLETION
                    current == NativeRouteId.AUTH_PROFILE_COMPLETION ->
                        NativeRouteId.TABS_HOME
                    else -> current
                }
            }
        }
    }
}
