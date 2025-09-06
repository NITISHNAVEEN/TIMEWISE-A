

'use client';

import { useTimetable } from '@/context/TimetableProvider';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useState, useMemo, useEffect, useRef } from 'react';
import { TimetableEntry, Course, Faculty, Room, timeSlots, Timetable, StudentGroup, SemesterSettings, ExtraClass, Cancellation, Course as CourseType } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BookOpenCheck, Calendar as CalendarIcon, Ban, PlusCircle, Undo2, Info, Settings2, LogOut, History } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format, isSameDay, startOfWeek, addDays, getDay, isWithinInterval, eachDayOfInterval } from 'date-fns';
import { Combobox, ComboboxOption } from '@/components/ui/combobox';
import React from 'react';
import { cn } from '@/lib/utils';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Logo } from '@/components/timewise/Logo';
import { TimetableGrid } from '@/components/timewise/TimetableGrid';
import { Checkbox } from '@/components/ui/checkbox';
import Image from 'next/image';
import { Loader } from '@/components/ui/loader';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

function formatEnrolledGroupsForDisplay(groups: StudentGroup[]): string {
    if (!groups || groups.length === 0) return 'N/A';
    
    const formattedGroups = groups.map(g => `Sem ${g.semester}, ${g.branch}${g.section ? `-${g.section}` : ''}`);

    if (formattedGroups.length > 2) {
        return `${formattedGroups.slice(0, 2).join(' | ')}...`;
    }
    
    return formattedGroups.join(' | ');
}

function formatAllEnrolledGroups(groups: StudentGroup[]): string {
    if (!groups || groups.length === 0) return 'N/A';
    return groups.map(g => `Sem ${g.semester}, ${g.branch}${g.section ? `-${g.section}` : ''}`).join(' | ');
}

const cancelAndRescheduleSchema = z.object({
  reason: z.string().min(10, { message: "Reason must be at least 10 characters." }),
  makeupDate: z.date({ required_error: "Please select a makeup date." }),
  makeupTimeSlot: z.string({ required_error: "Please select a time slot." }),
  makeupRoomName: z.string().min(1, { message: "Please select a room." }),
});

const extraClassFormSchema = z.object({
    courseId: z.string({ required_error: "Please select a course." }),
    date: z.date({ required_error: "A date is required." }),
    timeSlot: z.string({ required_error: "Time slot is required." }),
    roomName: z.string().min(1, 'Room name is required.'),
    reason: z.string().min(3, 'Reason must be at least 3 characters'),
});

const facultyLoginSchema = z.object({
    facultyId: z.string({ required_error: "Please select your name." }),
    password: z.string().min(1, { message: "Password is required." }),
    rememberMe: z.boolean().default(false).optional(),
});

export default function FacultyPageContainer() {
    const { faculty } = useTimetable();
    const [loggedInFaculty, setLoggedInFaculty] = useState<Faculty | null>(null);
    const loginTimePassword = useRef<string | undefined>();
    const [isClient, setIsClient] = React.useState(false);
    const { toast } = useToast();
  
    React.useEffect(() => {
        setIsClient(true);
        try {
            const storedFacultyId = localStorage.getItem('loggedInFacultyId');
            if (storedFacultyId) {
                const facultyMember = faculty.find(f => f.id === storedFacultyId);
                if (facultyMember) {
                    setLoggedInFaculty(facultyMember);
                    loginTimePassword.current = facultyMember.password;
                } else {
                    localStorage.removeItem('loggedInFacultyId');
                }
            }
        } catch (error) {
            console.error("Could not access localStorage", error);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleLogin = (values: z.infer<typeof facultyLoginSchema>) => {
        const facultyMember = faculty.find(f => f.id === values.facultyId);
        if (facultyMember && facultyMember.password === values.password) {
            setLoggedInFaculty(facultyMember);
            loginTimePassword.current = facultyMember.password;
            if (values.rememberMe) {
                try {
                    localStorage.setItem('loggedInFacultyId', facultyMember.id);
                } catch (error) {
                    console.error("Could not access localStorage", error);
                }
            }
        } else {
            return "Invalid name or password.";
        }
    };
    
    const handleLogout = React.useCallback(() => {
        setLoggedInFaculty(null);
        loginTimePassword.current = undefined;
        try {
            localStorage.removeItem('loggedInFacultyId');
        } catch (error) {
            console.error("Could not access localStorage", error);
        }
    }, []);
    
    React.useEffect(() => {
        if (loggedInFaculty) {
            const currentFacultyDataInProvider = faculty.find(f => f.id === loggedInFaculty.id);
            
            if (!currentFacultyDataInProvider) {
                 toast({
                    title: "Account Removed",
                    description: "Your faculty account has been removed by an administrator. Please log in again.",
                    variant: "destructive",
                });
                handleLogout();
            } 
            else if (currentFacultyDataInProvider.password !== loginTimePassword.current) {
                toast({
                    title: "Session Expired",
                    description: "Your password was changed by an administrator. Please log in again.",
                    variant: "destructive",
                });
                handleLogout();
            }
        }
    }, [faculty, loggedInFaculty, handleLogout, toast]);

    if (!isClient) {
        return <div className="flex-grow flex items-center justify-center"><Loader text="Loading..." /></div>;
    }

    if (!loggedInFaculty) {
        return <FacultyLoginPage onLogin={handleLogin} />;
    }
    
    const currentFacultyDataForDisplay = faculty.find(f => f.id === loggedInFaculty.id) || loggedInFaculty;

    return <FacultyDashboardPage faculty={currentFacultyDataForDisplay} onLogout={handleLogout} />;
}

function FacultyLoginPage({ onLogin }: { onLogin: (values: z.infer<typeof facultyLoginSchema>) => string | void }) {
    const { faculty } = useTimetable();
    const [error, setError] = useState<string | null>(null);
    const form = useForm<z.infer<typeof facultyLoginSchema>>({
        resolver: zodResolver(facultyLoginSchema),
        defaultValues: { facultyId: undefined, password: "", rememberMe: true },
    });
    
    const facultyOptions = useMemo(() => faculty.map(f => ({ value: f.id, label: f.name })), [faculty]);

    const onSubmit = (values: z.infer<typeof facultyLoginSchema>) => {
        const result = onLogin(values);
        if (result) {
            setError(result);
        } else {
            setError(null);
        }
    };

    return (
        <div className="flex flex-grow md:w-[1000px] h-full w-full items-center justify-center p-4 relative bg-background">
            <div className="absolute inset-0 -z-10 h-full w-full bg-background bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:6rem_4rem]">
                <div className="absolute bottom-0 left-0 right-0 top-0 bg-[radial-gradient(circle_500px_at_50%_200px,hsl(var(--primary)/.10),transparent)]" />
            </div>
            <Card className="w-full max-w-md bg-[#E3F2FD] shadow-2xl">
                <CardHeader className="items-center text-center">
                <div className="p-4 group-data-[collapsible=icon]:p-2 transition-all duration-300">
                    <Image 
                        src="https://upload.wikimedia.org/wikipedia/en/thumb/9/95/Indian_Institute_of_Information_Technology%2C_Dharwad_Logo.svg/800px-Indian_Institute_of_Information_Technology%2C_Dharwad_Logo.svg.png"
                        alt="IIIT Dharwad Logo"
                        width={50}
                        height={50}
                        className="w-full h-auto"
                    />
                </div>
                    <CardTitle className="text-2xl">Faculty Login</CardTitle>
                    <CardDescription>
                        Please select your name and enter your password to continue.
                    </CardDescription>
                </CardHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)}>
                        <CardContent className="grid gap-4">
                             <FormField
                                control={form.control}
                                name="facultyId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Name</FormLabel>
                                        <Combobox
                                            options={facultyOptions}
                                            value={field.value}
                                            onValueChange={field.onChange}
                                            placeholder="Select your name"
                                            searchPlaceholder="Search..."
                                            emptyResultText="Faculty not found."
                                            triggerClassName="w-full bg-[#D4EBF8] shadow-lg"
                                        />
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="password"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Password</FormLabel>
                                        <FormControl className='bg-[#D4EBF8] shadow-lg'>
                                            <Input type="password" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="rememberMe"
                                render={({ field }) => (
                                    <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                                        <FormControl>
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                        <div className="space-y-1 leading-none">
                                            <FormLabel>
                                                Keep me logged in
                                            </FormLabel>
                                        </div>
                                    </FormItem>
                                )}
                            />
                            {error && <p className="text-sm font-medium text-destructive">{error}</p>}
                        </CardContent>
                        <CardFooter>
                            <Button type="submit" className="w-full bg-[#000957]">
                                Login
                            </Button>
                        </CardFooter>
                    </form>
                </Form>
            </Card>
        </div>
    );
}


function FacultyDashboardPage({ faculty: loggedInFaculty, onLogout }: { faculty: Faculty, onLogout: () => void }) {
  const { timetable, courses, rooms, holidays, extraClasses, courseMap, semesterSettings, facultyCancelAndReschedule, revertExtraClass, facultyLeaves, faculty, facultyPermanentCancel, cancellations, revertPermanentCancellation } = useTimetable();
  const { toast } = useToast();
  
  const selectedFacultyId = loggedInFaculty.id;
  
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedSlotDetails, setSelectedSlotDetails] = useState<{ day: string; timeSlot: string; entry: TimetableEntry & { roomName?: string } } | null>(null);
  const [classToCancel, setClassToCancel] = useState<{ day: string; timeSlot: string; entry: TimetableEntry; date: Date } | null>(null);
  const [isCancelChoiceOpen, setIsCancelChoiceOpen] = useState(false);

  useEffect(() => {
    setSelectedDate(new Date());
  }, []);

  const facultyMap = useMemo(() =>
    faculty.reduce((acc, f) => {
        acc[f.id] = f;
        return acc;
    }, {} as Record<string, Faculty>),
  [faculty]);

  const roomMap = useMemo(() =>
      rooms.reduce((acc, r) => {
          acc[r.id] = r;
          return acc;
      }, {} as Record<string, Room>),
  [rooms]);

    const facultyScheduleForDay = useMemo(() => {
        if (!selectedFacultyId || !selectedDate) return [];

        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const dayOfWeek = getDay(selectedDate);
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        const scheduleForDay: {
            id?: string;
            linkedCancellationId?: string;
            courseId: string;
            facultyId?: string;
            roomId: string;
            type: 'Classroom' | 'Lab' | 'Tutorial' | 'Extra Class' | 'Makeup Class';
            day: string;
            time: string;
            courseName: string;
            enrolledGroups: StudentGroup[];
            roomName: string;
        }[] = [];

        // Regular classes from timetable
        if (!isWeekend) {
            const daySchedule = timetable[dateStr];
            if (daySchedule) {
                const labEntriesProcessed = new Set<string>();
                timeSlots.forEach((time, index) => {
                    const entries = daySchedule[time];
                    if (entries) {
                        entries.forEach(entry => {
                            if (entry && entry.facultyId === selectedFacultyId) {
                                const course = courseMap[entry.courseId];
                                const room = roomMap[entry.roomId];
                                
                                if (entry.type === 'Lab') {
                                    const labId = `${entry.courseId}-${entry.roomId}`;
                                    if (labEntriesProcessed.has(labId)) return;
                                    labEntriesProcessed.add(labId);
                                    const labStartTime = time.split('-')[0];
                                    const labEndTime = timeSlots[index + 1]?.split('-')[1] || '';
                                    scheduleForDay.push({
                                        ...entry,
                                        day: format(selectedDate, 'EEEE'),
                                        time: `${labStartTime}-${labEndTime}`,
                                        courseName: course?.name || 'Unknown Course',
                                        enrolledGroups: course?.enrolledGroups || [],
                                        roomName: room?.name || 'N/A',
                                    });
                                } else {
                                    scheduleForDay.push({
                                        ...entry,
                                        day: format(selectedDate, 'EEEE'),
                                        time,
                                        courseName: course?.name || 'Unknown Course',
                                        enrolledGroups: course?.enrolledGroups || [],
                                        roomName: room?.name || 'N/A',
                                    });
                                }
                            }
                        });
                    }
                });
            }
        }

        // Extra classes
        extraClasses
            .filter(ec => ec.facultyId === selectedFacultyId && format(ec.date, 'yyyy-MM-dd') === dateStr)
            .forEach(ec => {
                const course = courseMap[ec.courseId];
                let classType: 'Extra Class' | 'Makeup Class' = 'Extra Class';
                let specificType: 'Classroom' | 'Tutorial' = 'Classroom'; // Default

                if (ec.reason === 'Conflict Resolution') {
                    classType = 'Makeup Class';
                    // Infer type from course needs for makeup classes
                    if (course) {
                        if (course.weeklyClassroomHours > 0) specificType = 'Classroom';
                        else if (course.weeklyTutorialHours > 0) specificType = 'Tutorial';
                    }
                }

                scheduleForDay.push({
                    id: ec.id,
                    linkedCancellationId: ec.linkedCancellationId,
                    courseId: ec.courseId,
                    facultyId: ec.facultyId,
                    roomId: '', // No roomId for extra class
                    type: classType,
                    day: format(selectedDate, 'EEEE'),
                    time: ec.timeSlot,
                    courseName: course?.name || 'Unknown Course',
                    enrolledGroups: course?.enrolledGroups || [],
                    roomName: ec.roomName,
                });
            });

        return scheduleForDay.sort((a, b) => timeSlots.indexOf(a.time.split('-')[0] + '-00:00') - timeSlots.indexOf(b.time.split('-')[0] + '-00:00'));

    }, [selectedFacultyId, selectedDate, timetable, courses, rooms, extraClasses, courseMap, facultyMap]);
  
  const facultyTimetableForWeek = useMemo(() => {
    if (!selectedFacultyId || !selectedDate) {
      return {};
    }

    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const weekEnd = addDays(weekStart, 6);
  
    const weeklyTimetable: Timetable = {};
  
    // Process regular timetable
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
    for (const day of weekDays) {
      const dateStr = format(day, 'yyyy-MM-dd');
      const daySchedule = timetable[dateStr];
  
      if (daySchedule) {
        for (const slot of timeSlots) {
          const entries = daySchedule[slot];
          if (entries) {
            const filteredEntries = entries.filter(entry => entry.facultyId === selectedFacultyId);
            if (filteredEntries.length > 0) {
              if (!weeklyTimetable[dateStr]) weeklyTimetable[dateStr] = {};
              weeklyTimetable[dateStr]![slot] = filteredEntries;
            }
          }
        }
      }
    }
    
    // Process extra classes for the faculty
    const facultyExtraClasses = extraClasses.filter(ec => 
        ec.facultyId === selectedFacultyId && 
        isWithinInterval(ec.date, { start: weekStart, end: weekEnd })
    );

    facultyExtraClasses.forEach(ec => {
        const dateStr = format(ec.date, 'yyyy-MM-dd');
        if (!weeklyTimetable[dateStr]) weeklyTimetable[dateStr] = {};
        if (!weeklyTimetable[dateStr][ec.timeSlot]) weeklyTimetable[dateStr][ec.timeSlot] = [];
        
        // Convert ExtraClass to a TimetableEntry-like structure for the grid
        const syntheticEntry: TimetableEntry = {
            courseId: ec.courseId,
            facultyId: ec.facultyId,
            roomId: '', // No real room ID, but roomName is on the extra class
            type: 'Classroom', // Default type, grid will handle display
        };
        
        weeklyTimetable[dateStr][ec.timeSlot]!.push(syntheticEntry);
    });

    return weeklyTimetable;
  }, [selectedFacultyId, selectedDate, timetable, extraClasses]);
  
  const permanentlyCancelledClasses = useMemo(() => {
    return cancellations
      .filter(c => {
        if (c.status !== 'Cancelled' || !c.reason.startsWith('Faculty-initiated') || !c.cancelledClasses) {
          return false;
        }
        // Check if any of the cancelled classes in this record belong to the logged-in faculty
        return c.cancelledClasses.some(cc => {
          const course = courseMap[cc.courseId];
          if (!course) return false;
          // This logic assumes the faculty member assigned to the course is the one who cancelled it.
          // A more robust system might store the facultyId directly on the cancellation.
          const assignedFaculty = faculty.find(f => f.courses.includes(cc.courseId));
          return assignedFaculty?.id === selectedFacultyId;
        });
      })
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [cancellations, courseMap, faculty, selectedFacultyId]);


  const holidayForSelectedDate = useMemo(() => {
    if (!selectedDate) return null;
    return holidays.find(h => isSameDay(new Date(h.dateRange.from), selectedDate));
  }, [selectedDate, holidays]);
  
  const handleSlotClick = (day: string, timeSlot: string, entry: TimetableEntry) => {
    setSelectedSlotDetails({ day, timeSlot, entry });
  };
  
  const handleCancelClick = (day: string, timeSlot: string, entry: TimetableEntry, date: Date) => {
    setClassToCancel({ day, timeSlot, entry, date });
    setIsCancelChoiceOpen(true);
  };
  
  const handleConfirmCancellation = (values: z.infer<typeof cancelAndRescheduleSchema>) => {
    if (!classToCancel) return;

    const originalClass = {
        entry: classToCancel.entry,
        date: classToCancel.date,
        timeSlot: classToCancel.timeSlot,
    };
    
    const makeupClass: Omit<ExtraClass, 'id' | 'facultyId' | 'courseId' | 'linkedCancellationId'> = {
        date: values.makeupDate,
        timeSlot: values.makeupTimeSlot,
        roomName: values.makeupRoomName,
        reason: `Makeup for cancelled class. Reason: ${values.reason}`,
    };

    facultyCancelAndReschedule(originalClass, values.reason, makeupClass);

    toast({
      title: 'Class Rescheduled',
      description: `The class on ${format(originalClass.date, "PPP")} at ${originalClass.timeSlot} has been cancelled and rescheduled to ${format(makeupClass.date, "PPP")} at ${makeupClass.timeSlot}.`,
    });

    setClassToCancel(null);
  };

  const handlePermanentCancel = () => {
    if (!classToCancel) return;
    facultyPermanentCancel(classToCancel.entry, classToCancel.date, classToCancel.timeSlot);
    toast({
        title: 'Class Cancelled',
        description: `The class on ${format(classToCancel.date, "PPP")} at ${classToCancel.timeSlot} has been permanently cancelled.`,
    });
    setClassToCancel(null);
  }

  const handleRevertExtraClass = (item: { id: string; linkedCancellationId?: string }) => {
    revertExtraClass(item.id);
    if (item.linkedCancellationId) {
      toast({
        title: 'Cancellation Reverted',
        description: 'The makeup class has been removed and the original class slot has been restored.',
      });
    } else {
      toast({
        title: 'Extra Class Removed',
        description: 'The manually scheduled extra class has been removed.',
      });
    }
  };
  
  const handleRevertPermanentCancellation = (cancellationId: string) => {
    revertPermanentCancellation(cancellationId);
    toast({
      title: 'Cancellation Reverted',
      description: 'The class has been restored to the schedule. The timetable will update shortly.',
    });
  };


  return (
    <div className="w-full p-8 md:p-10 lg:p-12">
        <div className="flex items-center justify-between mb-10">
            <h1 className="text-4xl md:text-5xl font-extrabold font-headline text-gray-800">Welcome, {loggedInFaculty.name}</h1>
            <Button variant="destructive" onClick={onLogout}>
                <LogOut className="mr-2 h-4 w-4 border-black" />
                Log Out
            </Button>
        </div>
      
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <Card className="lg:col-span-1 rounded-lg border bg-[#FAF6E9] shadow-sm shadow-gray-800 flex w-full p-6 justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className='border-0 shadow-none p-0'
            />
          </Card>
          <div className="lg:col-span-2">
            <Card className="bg-[#EFEEEA] rounded-xl shadow-lg shadow-md">
              <CardHeader>
                <CardTitle className="font-bold text-2xl font-headline text-gray-800">
                  Schedule for {selectedDate ? format(selectedDate, 'PPP') : '...'}
                </CardTitle>
                <CardDescription className="text-base text-gray-600 font-body pt-2">
                  {selectedDate ? `Showing schedule for ${format(selectedDate, 'EEEE')}. Click on a class to see more details.` : 'Select a date to see the schedule.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="px-6 pb-6">
                {holidayForSelectedDate ? (
                  <div className="flex flex-col items-center justify-center text-center h-48">
                    <CalendarIcon className="h-12 w-12 text-primary mb-2" />
                    <p className="text-lg font-semibold">{holidayForSelectedDate.name}</p>
                    <p className="text-muted-foreground">Holiday</p>
                  </div>
                ) : facultyScheduleForDay.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow className="pointer-events-none border-b-gray-200 bg-[#102E50]">
                        <TableHead className="font-semibold text-white font-headline">Time Slot</TableHead>
                        <TableHead className="font-semibold text-white font-headline">Course</TableHead>
                        <TableHead className="font-semibold text-white font-headline">Student Group</TableHead>
                        <TableHead className="font-semibold text-white font-headline">Room</TableHead>
                        <TableHead className="font-semibold text-white font-headline">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {facultyScheduleForDay.map((item, index) => (
                        <TableRow 
                          key={index}
                          className={cn("cursor-pointer", index % 2 === 0 ? 'bg-[#ADEED9] hover:bg-[#a1dece]' : 'bg-[#FFEDF3] hover:bg-[#ffe0eb]')}
                          onClick={(e) => {
                            if ((e.target as HTMLElement).closest('button')) {
                                e.stopPropagation();
                                return;
                            }
                            handleSlotClick(format(selectedDate!, 'EEEE'), item.time, item as TimetableEntry);
                          }}
                        >
                          <TableCell className="font-semibold text-gray-700">{item.time}</TableCell>
                          <TableCell className="font-semibold text-gray-800">
                            {item.courseName}
                            <span className={cn("text-gray-500 text-xs font-normal", (item.type === 'Extra Class' || item.type === 'Makeup Class') && 'text-accent font-semibold')}> ({item.type})</span>
                          </TableCell>
                          <TableCell className="text-gray-600">{formatEnrolledGroupsForDisplay(item.enrolledGroups)}</TableCell>
                          <TableCell className="text-gray-600">{item.roomName}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                                <Button variant="ghost" size="icon" title="View Details" onClick={() => {
                                    const isManualClass = item.type === 'Extra Class' || item.type === 'Makeup Class';
                                    const entryForDialog = isManualClass
                                        ? { ...item, type: 'Classroom', roomName: item.roomName } 
                                        : item;
                                    handleSlotClick(item.day, item.time, entryForDialog as TimetableEntry & { roomName?: string })
                                }}>
                                    <BookOpenCheck className="h-4 w-4" />
                                </Button>
                                {item.type !== 'Extra Class' && item.type !== 'Makeup Class' ? (
                                    <Button variant="ghost" size="icon" title="Cancel Class" onClick={() => handleCancelClick(item.day, item.time, item as TimetableEntry, selectedDate!)}>
                                        <Ban className="h-4 w-4 text-destructive" />
                                    </Button>
                                ) : (
                                    <Button variant="ghost" size="icon" title={item.linkedCancellationId ? "Revert Cancellation" : "Remove Extra Class"} onClick={() => handleRevertExtraClass(item as any)}>
                                        <Undo2 className="h-4 w-4 text-green-600" />
                                    </Button>
                                )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center text-gray-500 font-body italic py-8 h-48 flex items-center justify-center">
                    <p>No classes scheduled for this day.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
        
        <Card className="mt-10 bg-[#FEF3E2] rounded-xl shadow-lg border-black">
          <CardHeader>
            <CardTitle className="font-bold text-2xl font-headline text-gray-800 flex items-center">
              <CalendarIcon className="mr-3 h-6 w-6"/>
              Weekly Schedule for {selectedDate ? `Week of ${format(startOfWeek(selectedDate, {weekStartsOn: 1}), 'PPP')}` : '...'}
            </CardTitle>
            <CardDescription className="text-base text-gray-600 font-body pt-2">
              Full week view for {facultyMap[selectedFacultyId]?.name}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedDate && (
              <TimetableGrid 
                timetable={facultyTimetableForWeek} 
                onSlotClick={handleSlotClick} 
                startDate={startOfWeek(selectedDate, { weekStartsOn: 1 })}
              />
            )}
          </CardContent>
        </Card>
        
        <div className="mt-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <ManualSchedulingSection
                selectedFacultyId={selectedFacultyId}
                selectedWeek={selectedDate}
            />
            <CancelledClassesSection
                cancellations={permanentlyCancelledClasses}
                onRevert={handleRevertPermanentCancellation}
            />
        </div>

      <CancelAndRescheduleDialog
        isOpen={!!classToCancel && !isCancelChoiceOpen}
        onClose={() => setClassToCancel(null)}
        classDetails={classToCancel}
        onConfirm={handleConfirmCancellation}
        rooms={rooms}
        semesterSettings={semesterSettings}
      />

      <AlertDialog open={isCancelChoiceOpen} onOpenChange={setIsCancelChoiceOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Class</AlertDialogTitle>
            <AlertDialogDescription>
              Would you like to permanently cancel this class or reschedule it for a weekend? Permanent cancellation will reduce the total required hours for this course.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setClassToCancel(null)}>Back</AlertDialogCancel>
            <Button variant="destructive" onClick={() => {
                setIsCancelChoiceOpen(false);
                handlePermanentCancel();
            }}>
                Cancel Permanently
            </Button>
            <AlertDialogAction onClick={() => {
                setIsCancelChoiceOpen(false);
            }}>
                Reschedule
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!selectedSlotDetails} onOpenChange={() => setSelectedSlotDetails(null)}>
        <DialogContent className="rounded-lg overflow-hidden p-0 gap-0 [&>button]:text-primary-foreground [&>button]:opacity-80 [&>button:hover]:opacity-100">
          <DialogHeader className="bg-primary text-primary-foreground p-6">
            <DialogTitle className="flex items-center"><BookOpenCheck className="mr-2 h-5 w-5" />Slot Details</DialogTitle>
            <DialogDescription className="text-primary-foreground/80">
              Detailed information for the selected class assignment.
            </DialogDescription>
          </DialogHeader>
          {selectedSlotDetails && (() => {
            const { day, timeSlot, entry } = selectedSlotDetails;
            const course = courseMap[entry.courseId];
            const facultyMember = entry.facultyId ? facultyMap[entry.facultyId] : null;
            const room = entry.roomId ? roomMap[entry.roomId] : (entry as any).roomName || 'N/A';
            const isManualClass = !entry.roomId;
            
            const details = [
                { label: "Day", value: day },
                { label: "Time Slot", value: timeSlot },
                { label: "Course", value: course ? `${course.name} (${course.code})` + (isManualClass ? ` (${(entry as any).type})` : (entry.type !== 'Classroom' ? ` (${entry.type})` : '')) : 'N/A' },
                { label: "Student Groups", value: course ? formatAllEnrolledGroups(course.enrolledGroups) : 'N/A' },
                { label: "Students", value: course?.studentCount },
                ...(facultyMember ? [{ label: "Faculty", value: facultyMember.name }] : []),
                { label: "Room", value: typeof room === 'string' ? room : room ? `${room.name} (Cap: ${room.capacity})` : 'N/A' }
            ].filter(item => item.value !== undefined && item.value !== null);

            return (
              <div className="bg-[#e0f7fa] text-foreground p-6">
                <div className="space-y-1">
                  {details.map((item, index) => (
                      <React.Fragment key={item.label}>
                          <div className="flex justify-between items-center py-3">
                              <p className="text-sm text-gray-600">{item.label}</p>
                              <p className="text-sm font-semibold text-gray-800 text-right">{item.value?.toString()}</p>
                          </div>
                          {index < details.length - 1 && <div className="border-b border-gray-300/70" />}
                      </React.Fragment>
                  ))}
                </div>
              </div>
            );
          })()}
          <DialogFooter className="bg-[#e0f7fa] p-6 pt-4 flex justify-end gap-2">
            {selectedSlotDetails && !selectedSlotDetails.entry.roomId && (
              <Button
                variant="outline"
                onClick={() => {
                  handleRevertExtraClass(selectedSlotDetails.entry as any);
                  setSelectedSlotDetails(null);
                }}
              >
                <Undo2 className="mr-2 h-4 w-4 text-green-600" />
                {(selectedSlotDetails.entry as any).linkedCancellationId ? "Revert Cancellation" : "Remove Extra Class"}
              </Button>
            )}
            {selectedSlotDetails && selectedSlotDetails.entry.roomId && (
                <Button
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => {
                        const { day, timeSlot, entry } = selectedSlotDetails;
                        handleCancelClick(day, timeSlot, entry as TimetableEntry, selectedDate!);
                        setSelectedSlotDetails(null);
                    }}
                >
                    <Ban className="mr-2 h-4 w-4" />
                    Cancel Class
                </Button>
            )}
            <Button type="button" variant="destructive" onClick={() => setSelectedSlotDetails(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    
    
    </div>
  );
}

function CancelAndRescheduleDialog({
    isOpen,
    onClose,
    classDetails,
    onConfirm,
    rooms,
    semesterSettings,
}: {
    isOpen: boolean;
    onClose: () => void;
    classDetails: { day: string; timeSlot: string; entry: TimetableEntry; date: Date } | null;
    onConfirm: (values: z.infer<typeof cancelAndRescheduleSchema>) => void;
    rooms: Room[];
    semesterSettings: SemesterSettings;
}) {
    const { courseMap } = useTimetable();
    const form = useForm<z.infer<typeof cancelAndRescheduleSchema>>({
        resolver: zodResolver(cancelAndRescheduleSchema),
        defaultValues: {
            reason: '',
            makeupDate: undefined,
            makeupTimeSlot: undefined,
            makeupRoomName: undefined,
        },
    });

    useEffect(() => {
        if (!isOpen) {
            form.reset();
        }
    }, [isOpen, form]);

    if (!classDetails) return null;

    const course = courseMap[classDetails.entry.courseId];
    const roomOptions = rooms.map(r => ({ value: r.name, label: `${r.name} (${r.type}, Cap: ${r.capacity})` }));
    
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center"><Ban className="mr-2" />Cancel and Reschedule Class</DialogTitle>
                    <DialogDescription>
                        Cancel the class for <strong>{course?.name}</strong> on {format(classDetails.date, "PPP")} at {classDetails.timeSlot}. You must schedule a makeup class on a weekend to meet weekly targets.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onConfirm)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="reason"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Reason for Cancellation</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="e.g., Attending a conference" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="makeupDate"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Makeup Class Date (Weekend)</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <FormControl>
                                                <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                    {field.value ? format(field.value, "PPP") : <span>Pick a weekend date</span>}
                                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                </Button>
                                            </FormControl>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar 
                                                mode="single" 
                                                selected={field.value} 
                                                onSelect={field.onChange} 
                                                initialFocus 
                                                fromDate={semesterSettings.startDate} 
                                                toDate={semesterSettings.endDate}
                                                disabled={(date) => getDay(date) > 0 && getDay(date) < 6}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="makeupTimeSlot"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Time Slot</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl><SelectTrigger><SelectValue placeholder="Time" /></SelectTrigger></FormControl>
                                            <SelectContent>{timeSlots.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="makeupRoomName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Room</FormLabel>
                                         <Combobox
                                            options={roomOptions}
                                            value={field.value}
                                            onValueChange={field.onChange}
                                            placeholder="Select Room"
                                            searchPlaceholder="Search rooms..."
                                            emptyResultText="No room found."
                                        />
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <DialogFooter className="pt-4">
                            <Button type="button" variant="ghost" onClick={onClose}>Back</Button>
                            <Button type="submit">Confirm Cancellation</Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}

function ManualSchedulingSection({ selectedFacultyId, selectedWeek }: { selectedFacultyId: string, selectedWeek?: Date }) {
    const { setExtraClasses, courses, rooms, facultyMap, semesterSettings } = useTimetable();
    const { toast } = useToast();

    const form = useForm<z.infer<typeof extraClassFormSchema>>({
        resolver: zodResolver(extraClassFormSchema),
        defaultValues: {
            courseId: undefined,
            date: undefined,
            timeSlot: undefined,
            roomName: "",
            reason: ""
        },
    });

    const courseOptions = React.useMemo(() => {
        const facultyMember = facultyMap[selectedFacultyId];
        if (!facultyMember) return [];
        return facultyMember.courses
            .map(courseId => courses.find(c => c.id === courseId))
            .filter((c): c is CourseType => !!c)
            .map(c => ({ value: c.id, label: `${c.code} - ${c.name}` }));
    }, [selectedFacultyId, facultyMap, courses]);

    const roomOptions = React.useMemo(() => rooms.map(r => ({ value: r.name, label: `${r.name} (${r.type})` })), [rooms]);
    
    React.useEffect(() => {
        form.reset();
    }, [selectedFacultyId, form]);

    function onSubmit(values: z.infer<typeof extraClassFormSchema>) {
        const newExtraClass: ExtraClass = {
            id: `extra-${Date.now()}`,
            ...values,
            facultyId: selectedFacultyId,
        };
        setExtraClasses(prev => [...prev, newExtraClass]);
        toast({ title: 'Extra Class Scheduled', description: `Class scheduled successfully on ${format(values.date, 'PPP')}.` });
        form.reset();
    }

    return (
        <Card className="bg-[#F3F3E0] rounded-xl shadow-lg border">
            <CardHeader>
                <CardTitle className="font-bold text-2xl font-headline text-gray-800">Manual Scheduling</CardTitle>
                <CardDescription className="text-base text-gray-600 font-body pt-2">Schedule an extra class. This will not affect your weekly hour targets.</CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <FormField
                            control={form.control}
                            name="courseId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Course</FormLabel>
                                    <Combobox triggerClassName='bg-[#FFF4EA]' options={courseOptions} value={field.value} onValueChange={field.onChange} placeholder="Select Course" />
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="date"
                            render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel>Date</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !field.value && "text-muted-foreground bg-[#FFF4EA]")}>
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar 
                                                mode="single" 
                                                selected={field.value} 
                                                onSelect={field.onChange} 
                                                disabled={(date) => date < semesterSettings.startDate || date > semesterSettings.endDate} 
                                                initialFocus 
                                            />
                                        </PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="timeSlot"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Time Slot</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value}><FormControl className='bg-[#FFF4EA]'><SelectTrigger><SelectValue placeholder="Select Time Slot" /></SelectTrigger></FormControl><SelectContent>{timeSlots.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="roomName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Room</FormLabel>
                                    <Combobox triggerClassName='bg-[#FFF4EA]' options={roomOptions} value={field.value} onValueChange={field.onChange} placeholder="Select Room" />
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField control={form.control} name="reason" render={({ field }) => (<FormItem><FormLabel>Reason</FormLabel><FormControl className='bg-[#FFF4EA]'><Input placeholder="e.g., Make-up for leave" {...field} /></FormControl><FormMessage /></FormItem>)} />

                        <div className="flex justify-end"><Button type="submit">Schedule Class</Button></div>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}

function CancelledClassesSection({ cancellations, onRevert }: { cancellations: Cancellation[], onRevert: (id: string) => void }) {
    const { courseMap } = useTimetable();

    return (
        <Card className="bg-[#FFF0F0] rounded-xl shadow-lg border">
            <CardHeader>
                <CardTitle className="font-bold text-2xl font-headline text-gray-800 flex items-center"><History className="mr-2 h-5 w-5" />Cancellation History</CardTitle>
                <CardDescription className="text-base text-gray-600 font-body pt-2">Review your permanently cancelled classes and revert them if needed.</CardDescription>
            </CardHeader>
            <CardContent>
                {cancellations.length > 0 ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Slot</TableHead>
                                <TableHead>Course</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {cancellations.map(c => (
                                <TableRow key={c.id}>
                                    <TableCell>{format(c.date, 'PPP')}</TableCell>
                                    <TableCell>{c.timeSlot}</TableCell>
                                    <TableCell>{c.cancelledClasses?.map(cc => courseMap[cc.courseId]?.name).join(', ') || 'N/A'}</TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="sm" onClick={() => onRevert(c.id)}>
                                            <Undo2 className="mr-2 h-4 w-4" />
                                            Revert
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : (
                    <div className="text-center text-muted-foreground italic py-4">
                        You have no permanently cancelled classes.
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
    

    









