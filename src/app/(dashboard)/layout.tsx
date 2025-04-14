"use client"

import { cn } from "@/lib/utils"
import Navbar from "@/components/Navbar"

interface DashboardLayoutProps {
  children: React.ReactNode
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <div className="flex-1 pt-10">
        {children}
      </div>
    </div>
  )
} 