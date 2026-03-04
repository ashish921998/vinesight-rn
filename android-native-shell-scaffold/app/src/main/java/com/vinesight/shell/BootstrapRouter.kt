package com.vinesight.shell

data class BootstrapSnapshot(
    val isLoading: Boolean,
    val isAuthenticated: Boolean,
    val needsProfileCompletion: Boolean,
    val hasProfileName: Boolean,
    val isProfileLoading: Boolean,
)

object BootstrapRouter {
    fun resolve(snapshot: BootstrapSnapshot): NativeRouteId? {
        if (snapshot.isLoading || (snapshot.isAuthenticated && snapshot.isProfileLoading)) {
            return null
        }
        if (!snapshot.isAuthenticated) {
            return NativeRouteId.AUTH_PHONE_LOGIN
        }
        if (snapshot.needsProfileCompletion || !snapshot.hasProfileName) {
            return NativeRouteId.AUTH_PROFILE_COMPLETION
        }
        return NativeRouteId.TABS_HOME
    }
}
