package com.vinesight.shell

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

@Composable
fun TabsShellScreen(
    viewModel: TabsShellViewModel,
    modifier: Modifier = Modifier,
) {
    val route by viewModel.currentRoute.collectAsState()
    val selectedTab = TabsFlowCoordinator.resolveTab(route)

    Column(modifier = modifier.fillMaxSize()) {
        TabBody(
            title = selectedTab.name,
            routeId = route.raw,
            onResetHome = viewModel::resetHome,
            modifier = Modifier.weight(1f),
        )

        NavigationBar {
            NativeTabSelection.entries.forEach { tab ->
                NavigationBarItem(
                    selected = selectedTab == tab,
                    onClick = { viewModel.select(tab) },
                    icon = { Text(tab.name.take(1)) },
                    label = { Text(tab.name.lowercase().replaceFirstChar { it.uppercase() }) },
                )
            }
        }
    }
}

@Composable
private fun TabBody(
    title: String,
    routeId: String,
    onResetHome: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(title, style = MaterialTheme.typography.headlineSmall)
        Text("Current native route: $routeId")
        Button(onClick = onResetHome, modifier = Modifier.fillMaxWidth()) {
            Text("Reset to Home")
        }
    }
}
