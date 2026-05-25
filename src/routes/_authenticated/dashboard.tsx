import { createFileRoute, Outlet } from "@tanstack/react-router";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { CompanionPanel } from "@/components/dashboard/CompanionPanel";
import { TopBar } from "@/components/dashboard/TopBar";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardLayout,
});

function DashboardLayout() {
  return (
    <div style={{ display: "flex", width: "100%", height: "100vh", overflow: "hidden" }}>
      <Sidebar />
      <main className="main" style={{ position: "relative" }}>
        <TopBar />
        <div className="main-bg">
          <Outlet />
        </div>
      </main>
      <CompanionPanel />
    </div>
  );
}
