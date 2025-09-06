
'use client'

import { Logo } from '@/components/timewise/Logo';
import { Sidebar, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarContent, SidebarProvider } from '@/components/ui/sidebar';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, LayoutDashboard, User, GraduationCap, FlaskConical, DoorOpen, Bug } from 'lucide-react';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname();

  const navItems = [
    { href: '/dashboard/home', label: 'Home', icon: Home },
    { href: '/dashboard', label: 'Admin', icon: LayoutDashboard },
    { href: '/dashboard/student', label: 'Student', icon: GraduationCap },
    { href: '/dashboard/faculty', label: 'Faculty', icon: User },
    { href: '/dashboard/lab-coordinator', label: 'Lab Coordinator', icon: FlaskConical },
    { href: '/dashboard/classroom', label: 'Classroom', icon: DoorOpen },
    { href: '/dashboard/review', label: 'Review', icon: Bug },
  ];

  return (
      <SidebarProvider>
        <div className="flex min-h-screen bg-background">
          <Sidebar className="border-r bg-[#FCD8CD]" collapsible="icon">
            <SidebarHeader>
              <Link href="/" className="flex items-center gap-2 font-bold text-lg px-2">
                <Logo className="h-8 w-8 text-primary" />
                <span className="font-headline text-primary group-data-[collapsible=icon]:hidden">TimeWise</span>
              </Link>
            </SidebarHeader>
            <SidebarContent>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.label}>
                    <SidebarMenuButton
                      asChild
                      isActive={pathname === item.href}
                      tooltip={{ children: item.label, side: 'right' }}
                    >
                      <Link href={item.href}>
                        <item.icon className="h-5 w-5" />
                        <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarContent>
          </Sidebar>
          <main className="flex-1 flex flex-col">
            {children}
          </main>
        </div>
      </SidebarProvider>
  )
}
