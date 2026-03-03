package com.vinesight.shell

enum class NativeTabSelection {
    HOME,
    FARMS,
    TOOLS,
    WORKERS,
    SETTINGS,
}

sealed interface TabsFlowEvent {
    data class Select(val tab: NativeTabSelection) : TabsFlowEvent
    data object ResetHome : TabsFlowEvent
}

object TabsFlowCoordinator {
    val defaultTab: NativeTabSelection = NativeTabSelection.HOME

    fun routeIdFor(tab: NativeTabSelection): NativeRouteId {
        return when (tab) {
            NativeTabSelection.HOME -> NativeRouteId.TABS_HOME
            NativeTabSelection.FARMS -> NativeRouteId.TABS_FARMS
            NativeTabSelection.TOOLS -> NativeRouteId.TABS_TOOLS
            NativeTabSelection.WORKERS -> NativeRouteId.TABS_WORKERS
            NativeTabSelection.SETTINGS -> NativeRouteId.TABS_SETTINGS
        }
    }

    fun resolveTab(routeId: NativeRouteId): NativeTabSelection {
        return when (routeId) {
            NativeRouteId.TABS_FARMS -> NativeTabSelection.FARMS
            NativeRouteId.TABS_TOOLS -> NativeTabSelection.TOOLS
            NativeRouteId.TABS_WORKERS -> NativeTabSelection.WORKERS
            NativeRouteId.TABS_SETTINGS -> NativeTabSelection.SETTINGS
            else -> NativeTabSelection.HOME
        }
    }

    fun nextRoute(current: NativeRouteId, event: TabsFlowEvent): NativeRouteId {
        return when (event) {
            is TabsFlowEvent.Select -> routeIdFor(event.tab)
            TabsFlowEvent.ResetHome -> NativeRouteId.TABS_HOME
        }
    }
}
