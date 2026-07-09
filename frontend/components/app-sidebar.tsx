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
import { useTranslation } from "@/components/i18n-provider";

import bioTrendLogo from "@/public/bio-trend-logo.png";

const navItems = [
  {
    id: "chat",
    url: "/chat",
    icon: MessageSquare,
  },
  {
    id: "knowledgeBase",
    icon: Database,
    items: [
      {
        id: "upload",
        url: "/upload",
        icon: Upload,
      },
      {
        id: "documents",
        url: "/documents",
        icon: FileText,
      },
    ],
  },
  {
    id: "admin",
    icon: Shield,
    items: [
      {
        id: "users",
        url: "/admin/users",
        icon: Users,
      },
      {
        id: "roles",
        url: "/admin/roles",
        icon: ShieldCheck,
      },
    ],
  },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { t } = useTranslation();

  const navLabel = (id: string): string => {
    switch (id) {
      case "chat":
        return t("nav.chat");
      case "knowledgeBase":
        return t("nav.knowledgeBase");
      case "upload":
        return t("nav.upload");
      case "documents":
        return t("nav.documents");
      case "admin":
        return t("nav.admin");
      case "users":
        return t("nav.users");
      case "roles":
        return t("nav.roles");
      default:
        return id;
    }
  };

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
                    alt={t("nav.logoAlt")}
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
                  key={item.id}
                  asChild
                  defaultOpen={isActive}
                  className="group/collapsible"
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton tooltip={navLabel(item.id)}>
                        {item.icon && <item.icon />}
                        <span>{navLabel(item.id)}</span>
                        <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {item.items.map((subItem) => (
                          <SidebarMenuSubItem key={subItem.id}>
                            <SidebarMenuSubButton
                              asChild
                              isActive={pathname?.startsWith(subItem.url)}
                            >
                              <Link href={subItem.url}>
                                <span>{navLabel(subItem.id)}</span>
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
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton
                  asChild
                  tooltip={navLabel(item.id)}
                  isActive={pathname?.startsWith(item.url)}
                >
                  <Link href={item.url}>
                    <item.icon />
                    <span>{navLabel(item.id)}</span>
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
