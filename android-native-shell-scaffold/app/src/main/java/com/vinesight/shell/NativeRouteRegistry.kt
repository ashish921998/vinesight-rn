package com.vinesight.shell

enum class NativeRouteId(val raw: String) {
    AUTH_LOGIN("auth.login"),
    AUTH_PHONE_LOGIN("auth.phone_login"),
    AUTH_OTP_VERIFICATION("auth.otp_verification"),
    AUTH_PROFILE_COMPLETION("auth.profile_completion"),
    ONBOARDING("onboarding"),
    TABS_HOME("tabs.home"),
    TABS_FARMS("tabs.farms"),
    TABS_TOOLS("tabs.tools"),
    TABS_WORKERS("tabs.workers"),
    TABS_SETTINGS("tabs.settings")
}

enum class NativeTabId {
    HOME,
    FARMS,
    TOOLS,
    WORKERS,
    SETTINGS
}

object NativeShellRegistry {
    val tabs: List<NativeTabId> = NativeTabId.entries
    val routes: List<NativeRouteId> = NativeRouteId.entries
}
