
'use client'

import { TimetableProvider } from '@/context/TimetableProvider';
import { Logo } from '@/components/timewise/Logo';
import { Sidebar, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarContent, SidebarProvider, SidebarFooter } from '@/components/ui/sidebar';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, LayoutDashboard, User, GraduationCap, DoorOpen, MessageSquare } from 'lucide-react';
import Image from 'next/image';

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
    { href: '/dashboard/classroom', label: 'Classroom', icon: DoorOpen },
    { href: '/dashboard/review', label: 'Review', icon: MessageSquare },
  ];

  return (
    <TimetableProvider>
      <SidebarProvider>
        <div className="flex min-h-screen bg-background">
          <Sidebar className="border-r bg-[#FCD8CD]" collapsible="icon">
            <SidebarHeader className="bg-white rounded-lg m-2">
              <Link href="/" className="flex items-center gap-2 font-bold text-lg px-2">
                <div className="p-2 group-data-[collapsible=icon]:p-2 transition-all duration-300">
                    <Image 
                        src="https://upload.wikimedia.org/wikipedia/en/thumb/9/95/Indian_Institute_of_Information_Technology%2C_Dharwad_Logo.svg/800px-Indian_Institute_of_Information_Technology%2C_Dharwad_Logo.svg.png"
                        alt="IIIT Dharwad Logo"
                        width={30}
                        height={30}
                        className="h-auto"
                    />
                </div>
                
                <span className="font-headline text-black text-2xl gap-0 group-data-[collapsible=icon]:hidden">TimeWise</span>
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
            <SidebarFooter className="mt-auto">
                
            </SidebarFooter>
          </Sidebar>
          <main className="flex-1 flex flex-col">
            {children}
          </main>
        </div>
      </SidebarProvider>
    </TimetableProvider>
  )
}
