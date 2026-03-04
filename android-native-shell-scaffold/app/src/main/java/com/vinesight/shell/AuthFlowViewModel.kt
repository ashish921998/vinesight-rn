package com.vinesight.shell

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class AuthFlowViewModel {
    private val _route = MutableStateFlow(AuthFlowCoordinator.initialRoute)
    val route: StateFlow<NativeRouteId> = _route.asStateFlow()

    private val _phoneNumber = MutableStateFlow("")
    val phoneNumber: StateFlow<String> = _phoneNumber.asStateFlow()

    private val _otpCode = MutableStateFlow("")
    val otpCode: StateFlow<String> = _otpCode.asStateFlow()

    private val _profileName = MutableStateFlow("")
    val profileName: StateFlow<String> = _profileName.asStateFlow()

    fun updatePhoneNumber(value: String) {
        _phoneNumber.value = value
    }

    fun updateOtpCode(value: String) {
        _otpCode.value = value
    }

    fun updateProfileName(value: String) {
        _profileName.value = value
    }

    fun restart() {
        dispatch(AuthFlowEvent.Restart)
    }

    fun showEmailLogin() {
        dispatch(AuthFlowEvent.LoginRequested)
    }

    fun showPhoneLogin() {
        dispatch(AuthFlowEvent.PhoneLoginRequested)
    }

    fun submitEntry() {
        dispatch(AuthFlowEvent.OtpSent)
    }

    fun verifyOtp(hasCompleteProfile: Boolean) {
        dispatch(AuthFlowEvent.OtpVerified(hasCompleteProfile = hasCompleteProfile))
    }

    private fun dispatch(event: AuthFlowEvent) {
        _route.value = AuthFlowCoordinator.nextRoute(_route.value, event)
    }
}
