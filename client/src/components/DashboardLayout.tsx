import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { startLogin } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  CalendarDays,
  LogOut,
  MessageCircleMore,
  PanelLeft,
  Settings2,
  Sparkles,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";

export type DashboardNavigationItem = {
  icon: LucideIcon;
  label: string;
  path: string;
};

const defaultNavigation: DashboardNavigationItem[] = [
  { icon: CalendarDays, label: "Agenda", path: "/admin" },
  { icon: UsersRound, label: "Clientes", path: "/admin/clientes" },
  { icon: MessageCircleMore, label: "Mensagens", path: "/admin/mensagens" },
  { icon: Settings2, label: "Configurações", path: "/admin/configuracoes" },
];

const SIDEBAR_WIDTH_KEY = "agenda-cilios-sidebar-width";
const DEFAULT_WIDTH = 270;
const MIN_WIDTH = 220;
const MAX_WIDTH = 420;

export default function DashboardLayout({
  children,
  navigation = defaultNavigation,
}: {
  children: React.ReactNode;
  navigation?: DashboardNavigationItem[];
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) return <DashboardLayoutSkeleton />;

  if (!user) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_20%_20%,#ead8cf_0%,transparent_32%),#f7f2ed] px-5 py-10 text-[#251b18]">
        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md flex-col items-center justify-center text-center">
          <div className="mb-7 grid h-16 w-16 place-items-center rounded-full bg-[#241a17] text-[#f6e8df] shadow-xl shadow-[#6f4136]/20">
            <Sparkles className="h-7 w-7" />
          </div>
          <p className="mb-3 font-serif text-sm tracking-[0.28em] text-[#9b6758]">MY ESTÉTICA EXCLUSIVA</p>
          <h1 className="font-serif text-4xl leading-tight">Seu espaço de gestão.</h1>
          <p className="mt-4 max-w-sm text-sm leading-6 text-[#6c5a54]">
            Acesse o painel para administrar horários, clientes e comunicações do estúdio.
          </p>
          <Button
            onClick={() => startLogin()}
            size="lg"
            className="mt-8 h-12 w-full rounded-full bg-[#241a17] text-[#fffaf6] shadow-lg shadow-[#5b332b]/20 transition hover:bg-[#3a2924] active:scale-[0.98]"
          >
            Entrar no painel
          </Button>
        </div>
      </main>
    );
  }

  return (
    <SidebarProvider
      style={{ "--sidebar-width": `${sidebarWidth}px` } as CSSProperties}
    >
      <DashboardLayoutContent navigation={navigation} setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  navigation: DashboardNavigationItem[];
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  navigation,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeNavigation = navigation.find(item => item.path === location);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const width = event.clientX - sidebarLeft;
      if (width >= MIN_WIDTH && width <= MAX_WIDTH) setSidebarWidth(width);
    };
    const handleMouseUp = () => setIsResizing(false);

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r border-[#ffffff10] bg-[#241a17] text-[#fffaf6]" disableTransition={isResizing}>
          <SidebarHeader className="h-[92px] justify-center px-3">
            <div className="flex w-full items-center gap-3">
              <button
                onClick={toggleSidebar}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[#f9e5db] transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e5aa93]"
                aria-label="Alternar navegação"
              >
                <PanelLeft className="h-4 w-4" />
              </button>
              {!isCollapsed && (
                <div className="min-w-0">
                  <p className="font-serif text-lg leading-none tracking-wide">MY</p>
                  <p className="mt-1 text-[9px] font-medium tracking-[0.24em] text-[#d8aa97]">AGENDA</p>
                </div>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="px-2 py-4">
            <p className="px-3 pb-2 text-[10px] font-medium tracking-[0.2em] text-[#cbb2a8] group-data-[collapsible=icon]:hidden">
              GESTÃO
            </p>
            <SidebarMenu className="gap-1">
              {navigation.map(item => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-11 rounded-xl px-3 text-[#f2e5de] transition-all hover:bg-white/10 hover:text-white ${
                        isActive ? "bg-[#b87362] text-white hover:bg-[#b87362]" : ""
                      }`}
                    >
                      <item.icon className="h-[18px] w-[18px]" />
                      <span className="text-sm">{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e5aa93] group-data-[collapsible=icon]:justify-center">
                  <Avatar className="h-9 w-9 shrink-0 border border-white/15 bg-[#b87362]">
                    <AvatarFallback className="bg-[#b87362] text-xs font-semibold text-white">
                      {user?.name?.charAt(0).toUpperCase() || "E"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
                    <p className="truncate text-sm font-medium">{user?.name || "Equipe MY"}</p>
                    <p className="mt-0.5 truncate text-xs text-[#cbb2a8]">Painel administrativo</p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 rounded-xl p-1">
                <DropdownMenuItem onClick={logout} className="cursor-pointer rounded-lg text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair do painel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute right-0 top-0 z-50 h-full w-1 cursor-col-resize transition-colors hover:bg-[#d9957f]/50 ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => !isCollapsed && setIsResizing(true)}
        />
      </div>

      <SidebarInset className="bg-[#fbf8f5]">
        {isMobile && (
          <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-[#e9dfd9] bg-[#fbf8f5]/95 px-4 backdrop-blur">
            <SidebarTrigger className="rounded-xl" />
            <div>
              <p className="font-serif text-lg leading-none">MY</p>
              <p className="mt-1 text-[9px] tracking-[0.18em] text-[#9b6758]">{activeNavigation?.label?.toUpperCase() || "GESTÃO"}</p>
            </div>
          </header>
        )}
        <main className="min-h-screen flex-1 p-4 md:p-7">{children}</main>
      </SidebarInset>
    </>
  );
}
