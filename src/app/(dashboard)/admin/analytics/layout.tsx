import { Sidebar } from "@/components/dashboard/analytics/sidebar"

export default function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <aside className="fixed left-0 z-30 w-64 border-r bg-background h-[calc(100vh-4rem)] top-16">
        <div className="flex flex-col h-full">
          <div className="px-3 py-2">
            <h2 className="mb-2 px-4 text-lg font-semibold tracking-tight">
              Analytics
            </h2>
          </div>
          <Sidebar />
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-64">
        <div className="container mx-auto p-6">
          {children}
        </div>
      </main>
    </div>
  )
} 