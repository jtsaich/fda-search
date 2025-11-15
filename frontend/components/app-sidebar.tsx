"use client";

import * as React from "react";
import {
  MessageSquare,
  Users,
  ShieldCheck,
  ChevronRight,
  Shield,
  Upload,
  FileText,
  Database,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { NavUser } from "@/components/nav-user";

import bioTrendLogo from "@/public/bio-trend-logo.png";

const navItems = [
  {
    title: "Chat",
    url: "/chat",
    icon: MessageSquare,
  },
  {
    title: "Knowledge Base",
    icon: Database,
    items: [
      {
        title: "Upload",
        url: "/upload",
        icon: Upload,
      },
      {
        title: "Documents",
        url: "/documents",
        icon: FileText,
      },
    ],
  },
  {
    title: "Admin",
    icon: Shield,
    items: [
      {
        title: "Users",
        url: "/admin/users",
        icon: Users,
      },
      {
        title: "Roles",
        url: "/admin/roles",
        icon: ShieldCheck,
      },
    ],
  },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2">
              <SidebarMenuButton
                size="lg"
                asChild
                className="flex-1 group-data-[collapsible=icon]:hidden"
              >
                <Link href="/">
                  <Image
                    src={bioTrendLogo}
                    alt="Bio-Trend"
                    width={436}
                    className="w-full"
                  />
                </Link>
              </SidebarMenuButton>
              <SidebarTrigger className="ml-auto" />
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {navItems.map((item) => {
            // If item has sub-items, render collapsible
            if ("items" in item && item.items) {
              const isActive = item.items.some((subItem) =>
                pathname?.startsWith(subItem.url)
              );
              return (
                <Collapsible
                  key={item.title}
                  asChild
                  defaultOpen={isActive}
                  className="group/collapsible"
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton tooltip={item.title}>
                        {item.icon && <item.icon />}
                        <span>{item.title}</span>
                        <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {item.items.map((subItem) => (
                          <SidebarMenuSubItem key={subItem.title}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={pathname?.startsWith(subItem.url)}
                            >
                              <Link href={subItem.url}>
                                <span>{subItem.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              );
            }

            // Regular menu item
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  tooltip={item.title}
                  isActive={pathname?.startsWith(item.url)}
                >
                  <Link href={item.url}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
