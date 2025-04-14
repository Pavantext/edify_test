"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  BarChart3,
  Users,
  Building2,
  AlertTriangle,
  Settings,
  CircleDollarSign,
  Activity,
  ChevronDown
} from "lucide-react"
import { useState } from "react"

const sidebarItems = [
  {
    title: "Overview",
    href: "/admin/analytics",
    icon: BarChart3,
  },
  {
    title: "Users",
    href: "/admin/analytics/users",
    icon: Users,
    subItems: [
      {
        title: "All Users",
        href: "/admin/analytics/users",
      },
      {
        title: "Individual Users",
        href: "/admin/analytics/users/active",
      },
      {
        title: "Organisations Users",
        href: "/admin/analytics/users/organizations",
      },
    ]
  },
  {
    title: "Organisations",
    href: "/admin/analytics/organizations",
    icon: Building2,
  },
  {
    title: "Token Usage",
    href: "/admin/analytics/tokens",
    icon: CircleDollarSign,
  },
  {
    title: "Violations",
    href: "/admin/analytics/violations",
    icon: AlertTriangle,
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({})

  const toggleSection = (href: string) => {
    setOpenSections(prev => ({
      ...prev,
      [href]: !prev[href]
    }))
  }

  return (
    <nav className="space-y-4 py-4">
      <div className="px-3 py-2">
        <div className="space-y-1">
          {sidebarItems.map((item) => 
            item.subItems ? (
              <div key={item.href} className="relative">
                <button
                  type="button"
                  onClick={() => toggleSection(item.href)}
                  className={cn(
                    "group flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium",
                    "hover:bg-accent hover:text-accent-foreground cursor-pointer",
                    "transition-colors duration-200",
                    pathname === item.href && "bg-accent text-accent-foreground"
                  )}
                >
                  <div className="flex items-center">
                    <item.icon className="mr-2 h-4 w-4" />
                    <span>{item.title}</span>
                  </div>
                  <ChevronDown 
                    className={cn(
                      "h-4 w-4 transition-transform duration-200",
                      openSections[item.href] && "rotate-180"
                    )}
                  />
                </button>
                
                <div className={cn(
                  "mt-1 space-y-1",
                  !openSections[item.href] && "hidden"
                )}>
                  {item.subItems.map((subItem) => (
                    <Link
                      key={subItem.href}
                      href={subItem.href}
                      className={cn(
                        "block rounded-lg px-8 py-2 text-sm font-medium",
                        "hover:bg-accent hover:text-accent-foreground cursor-pointer",
                        "transition-colors duration-200",
                        pathname === subItem.href && "bg-accent text-accent-foreground"
                      )}
                    >
                      {subItem.title}
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center rounded-lg px-3 py-2 text-sm font-medium",
                  "hover:bg-accent hover:text-accent-foreground cursor-pointer",
                  "transition-colors duration-200",
                  pathname === item.href && "bg-accent text-accent-foreground"
                )}
              >
                <item.icon className="mr-2 h-4 w-4" />
                {item.title}
              </Link>
            )
          )}
        </div>
      </div>
    </nav>
  )
} 