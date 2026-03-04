import SwiftUI

struct TabsShellRootView: View {
    @StateObject private var viewModel = TabsShellViewModel()

    var body: some View {
        TabView(selection: Binding(
            get: { viewModel.selectedTab },
            set: { viewModel.select(tab: $0) }
        )) {
            tabContent(title: "Home", description: "Farm overview and daily highlights")
                .tabItem { Label("Home", systemImage: "house") }
                .tag(NativeTabSelection.home)

            tabContent(title: "Farms", description: "Farm list and crop-level context")
                .tabItem { Label("Farms", systemImage: "leaf") }
                .tag(NativeTabSelection.farms)

            tabContent(title: "Tools", description: "Calculators, helpers, and operational tools")
                .tabItem { Label("Tools", systemImage: "wrench.and.screwdriver") }
                .tag(NativeTabSelection.tools)

            tabContent(title: "Workers", description: "Attendance, tasks, and workforce insights")
                .tabItem { Label("Workers", systemImage: "person.2") }
                .tag(NativeTabSelection.workers)

            tabContent(title: "Settings", description: "Account, language, and preferences")
                .tabItem { Label("Settings", systemImage: "gearshape") }
                .tag(NativeTabSelection.settings)
        }
    }

    private func tabContent(title: String, description: String) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text(title)
                .font(.title.bold())
            Text(description)
                .foregroundStyle(.secondary)
            Text("Current native route: \(viewModel.currentRoute.rawValue)")
                .font(.footnote.monospaced())
                .foregroundStyle(.secondary)
            Button("Reset to Home") {
                viewModel.resetHome()
            }
            .buttonStyle(.bordered)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .padding(24)
    }
}

#Preview {
    TabsShellRootView()
}
