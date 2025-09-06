'use client';

import { useTimetable } from '@/context/TimetableProvider';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowRight, BookOpen, Users, DoorOpen, LayoutDashboard, GraduationCap, User, MessageSquare } from 'lucide-react';

export default function DashboardHomePage() {
  const { courses, faculty, rooms } = useTimetable();

  const totalStaff = faculty.length;

  const quickActionCards = [
    {
      title: 'Admin Dashboard',
      description: 'View the full weekly schedule and manage all resources.',
      href: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      title: 'Student Schedules',
      description: 'Check timetables for any semester and branch.',
      href: '/dashboard/student',
      icon: GraduationCap,
    },
    {
      title: 'Faculty Schedules',
      description: 'View individual schedules for all faculty members.',
      href: '/dashboard/faculty',
      icon: User,
    },
    {
      title: 'Classroom Schedules',
      description: 'Check timetables for any classroom.',
      href: '/dashboard/classroom',
      icon: DoorOpen,
    },
    {
      title: 'Submit Feedback',
      description: 'Report issues or provide feedback to the admin team.',
      href: '/dashboard/review',
      icon: MessageSquare,
    },
  ];

  return (
    <div className="p-6 md:p-10 flex flex-col h-full w-full">
      <div className="flex-grow w-full">
        <div className="mb-10">
          <h1 className="text-4xl font-bold font-headline mb-2">Welcome to TimeWise</h1>
          <p className="text-lg text-muted-foreground">Your central hub for managing schedules and resources.</p>
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-2xl font-bold font-headline mb-6">Quick Actions</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {quickActionCards.map((item) => (
              <Card key={item.title} className="flex flex-col hover:border-primary/50 hover:shadow-lg transition-all">
                <CardHeader>
                  <div className="flex items-center gap-4">
                      <div className="p-3 bg-primary/10 rounded-full">
                        <item.icon className="h-6 w-6 text-primary" />
                      </div>
                      <CardTitle className="text-xl">{item.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="flex-grow">
                  <CardDescription>{item.description}</CardDescription>
                </CardContent>
                <div className="p-6 pt-0">
                  <Button asChild className="w-full">
                    <Link href={item.href}>
                      View {item.title.split(' ')[0]} <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
      <footer className="mt-10 pt-6 border-t text-center text-muted-foreground text-sm">
        <p>Brought to you by-</p>
        <p>NITISH NAVEEN</p>
        <p>24BDS050</p>
      </footer>
    </div>
  );
}
