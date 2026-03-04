package com.vinesight.shell

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

class TabsShellViewModel {
    private val _currentRoute = MutableStateFlow(NativeRouteId.TABS_HOME)
    val currentRoute: StateFlow<NativeRouteId> = _currentRoute.asStateFlow()

    fun select(tab: NativeTabSelection) {
        _currentRoute.value = TabsFlowCoordinator.nextRoute(
            _currentRoute.value,
            TabsFlowEvent.Select(tab),
        )
    }

    fun resetHome() {
        _currentRoute.value = TabsFlowCoordinator.nextRoute(
            _currentRoute.value,
            TabsFlowEvent.ResetHome,
        )
    }
}
