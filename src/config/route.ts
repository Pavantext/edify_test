import { Home, GraduationCap, Users, Wrench, History, Library, UserRoundCheck, ShieldPlus, ShieldCheck } from "lucide-react";
import { title } from "process";

export const routes = [
  // {
  //   title: "Home",
  //   href: "/",
  //   icon: Home,
  // },
  {
    title: "Admin",
    href: "/admin/analytics",
    icon: ShieldPlus,
    adminOnly: true,
    isOrgAdmin: true,
  },
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: GraduationCap,
    hideFromAdmin: true,
    isOrgAdmin: true,
  },
  {
    title: "Waitlist",
    href: "/admin/waitlist",
    icon: UserRoundCheck,
    adminOnly: true,
    isOrgAdmin: true,
  },
  {
    title: "Tools",
    href: "/tools",
    icon: Wrench,
  },
  {
    title: "History",
    href: "/history",
    icon: History,
    hideFromAdmin: true,
  },
  {
    title: "Prompt Library",
    href: "/prompt-library",
    icon: Library,
    hideFromAdmin: true,
  },

  {
    title: "Moderator",
    href: "/moderator",
    icon: ShieldCheck,
    hideFromAdmin: true,
   // Add after your "Tools" route and before "Tickets"
  } 
];
