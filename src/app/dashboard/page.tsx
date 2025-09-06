

'use client';

import { useTimetable } from '@/context/TimetableProvider';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TimetableGrid } from '@/components/timewise/TimetableGrid';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Calendar as CalendarIcon, PlusCircle, Trash2, AlertTriangle, Edit, BookOpenCheck, Ban, Lightbulb, UserX, Users, DoorOpen, GraduationCap, BookOpen, Settings, LogOut, Info, Settings2, MinusCircle, Redo, KeyRound, Fingerprint, History, FileText, CalendarDays } from 'lucide-react';
import React from 'react';
import { branches, semesters, Course, Faculty, Room, daysOfWeek, timeSlots, TimetableEntry, Holiday, Cancellation, TimetableConflict, FacultyLeave, SemesterSettings, FeedbackItem, ExtraClass, StudentGroup, Timetable, Basket, sections, ExamSchedule } from '@/lib/types';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, startOfWeek, getDay, isWithinInterval, addDays, eachDayOfInterval, nextSaturday, differenceInCalendarDays, nextDay, parseISO } from "date-fns";
import { cn } from '@/lib/utils';
import { generateConflictSuggestion } from '@/ai/flows/generate-conflict-suggestion';
import { Skeleton } from '@/components/ui/skeleton';
import { Combobox } from '@/components/ui/combobox';
import { Separator } from '@/components/ui/separator';
import { Logo } from '@/components/timewise/Logo';
import { ScrollArea } from '@/components/ui/scroll-area';
import Image from 'next/image';
import type { DateRange } from "react-day-picker"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Loader } from '@/components/ui/loader';
import { MultiSelect } from '@/components/ui/multi-select';
import { Badge } from '@/components/ui/badge';


const facultyFormSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
});

const studentGroupSchema = z.object({
  semester: z.coerce.number(),
  branch: z.enum(branches),
  sections: z.array(z.string()).optional(),
});

const courseFormSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  code: z.string().min(3, 'Code must be at least 3 characters'),
  enrolledGroups: z.array(studentGroupSchema).min(1, { message: "A course must have at least one student group."}),
  studentCount: z.coerce.number().min(1),
  duration: z.enum(['Full', 'Half-1', 'Half-2']),
  classroomHours: z.coerce.number().min(0),
  tutorialHours: z.coerce.number().min(0),
  labHours: z.coerce.number().min(0).refine(val => val % 2 === 0, { message: 'Lab hours must be in multiples of 2' }),
  weeklyClassroomHours: z.coerce.number().min(0),
  weeklyTutorialHours: z.coerce.number().min(0),
  weeklyLabHours: z.coerce.number().min(0).refine(val => val % 2 === 0, { message: 'Lab hours must be in multiples of 2' }),
  startDate: z.date({ required_error: "Start date is required." }),
  facultyId: z.string().optional(),
  basketId: z.string().optional(),
  requiresHardwareLab: z.boolean().default(false).optional(),
});

const roomFormSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  type: z.enum(['Classroom', 'Software Lab', 'Hardware Lab']),
  capacity: z.coerce.number().min(1),
});

const holidayFormSchema = z.object({
  name: z.string().min(3, 'Holiday name must be at least 3 characters').default(''),
  dateRange: z.object({
      from: z.date({ required_error: "A start date is required." }),
      to: z.date().optional(),
  }),
  scope: z.enum(['all_except_first_sem', 'only_first_sem']).default('all_except_first_sem'),
});

const cancellationFormSchema = z.object({
    date: z.date({ required_error: "A date is required." }),
    timeSlot: z.enum(timeSlots, { required_error: "Time slot is required." }),
    reason: z.string().min(3, 'Reason must be at least 3 characters'),
});

const facultyLeaveFormSchema = z.object({
  facultyId: z.string({ required_error: "Please select a faculty member." }),
  dateRange: z.object({
      from: z.date({ required_error: "A start date is required." }),
      to: z.date().optional(),
  }),
  reason: z.string().min(3, 'Reason must be at least 3 characters'),
});

const massRescheduleSchema = z.object({
  reschedules: z.array(z.object({
    originalClass: z.any(),
    makeupDate: z.date({ required_error: "Please select a makeup date." }),
    makeupTimeSlot: z.enum(timeSlots, { required_error: "Please select a time slot." }),
    makeupRoomName: z.string().min(1, { message: "Please select a room." }),
  }))
});

const basketFormSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  code: z.string().min(1, 'Code is required'),
});

const examScheduleFormSchema = z.object({
  semester: z.coerce.number({ required_error: "Please select a semester." }),
  branch: z.enum(branches, { required_error: "Please select a branch." }),
  midSemDate: z.date({ required_error: "Mid-semester date is required." }),
  endSemDate: z.date({ required_error: "End-semester date is required." }),
}).refine(data => data.endSemDate > data.midSemDate, {
  message: "End-semester date must be after the mid-semester date.",
  path: ["endSemDate"],
});

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


// Helper functions for WebAuthn
function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

function base64ToArrayBuffer(base64: string) {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}


export default function AdminPage() {
  const { courses, faculty, rooms, timetable, conflicts, setCourses, setFaculty, setRooms, holidays, setHolidays, cancellations, setCancellations, facultyLeaves, setFacultyLeaves, facultyMap, semesterSettings, setSemesterSettings, courseMap, feedbackItems, setFeedbackItems, extraClasses, setExtraClasses, baskets, setBaskets, examSchedules, setExamSchedules } = useTimetable();
  const { toast } = useToast();

  const [selectedWeek, setSelectedWeek] = React.useState<Date | undefined>();
  const [selectedSlotDetails, setSelectedSlotDetails] = React.useState<{ day: string; timeSlot: string; entry: TimetableEntry } | null>(null);
  const [editingCourse, setEditingCourse] = React.useState<Course | null>(null);
  const [isCourseFormOpen, setIsCourseFormOpen] = React.useState(false);
  const [editingRoom, setEditingRoom] = React.useState<Room | null>(null);
  const [isRoomFormOpen, setIsRoomFormOpen] = React.useState(false);


  const [isAdmin, setIsAdmin] = React.useState(false);
  const [adminCode, setAdminCode] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [authError, setAuthError] = React.useState('');
  const [isClient, setIsClient] = React.useState(false);
  
  const [activeDashboardTab, setActiveDashboardTab] = React.useState("timetable");

  const [classesToMassReschedule, setClassesToMassReschedule] = React.useState<{
    reason: 'FacultyLeave' | 'Holiday' | 'SlotCancellation';
    triggeringData: any;
    classes: (TimetableEntry & { timeSlot: string; date: Date })[];
  } | null>(null);
  
  const [longHolidayState, setLongHolidayState] = React.useState<{
    holidayData: Omit<Holiday, 'id'>;
    allAffectedClasses: (TimetableEntry & { timeSlot: string; date: Date })[];
  } | null>(null);

  const [biometricCredentialId, setBiometricCredentialId] = React.useState<string | null>(null);

  const [courseSearchQuery, setCourseSearchQuery] = React.useState('');

  // Deletion Confirmation Dialog State
  const deleteActionRef = React.useRef<(() => void) | null>(null);
  const [isConfirmDeleteDialogOpen, setIsConfirmDeleteDialogOpen] = React.useState(false);

  const openDeleteConfirmation = (action: () => void) => {
    deleteActionRef.current = action;
    setIsConfirmDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (deleteActionRef.current) {
      deleteActionRef.current();
    }
    setIsConfirmDeleteDialogOpen(false);
    deleteActionRef.current = null;
  };


  React.useEffect(() => {
    setSelectedWeek(semesterSettings.startDate);
    setIsClient(true);
    const storedCredentialId = localStorage.getItem('webauthn-credential-id');
    if (storedCredentialId) {
        setBiometricCredentialId(storedCredentialId);
    }
  }, [semesterSettings.startDate]);
  
  const roomMap = React.useMemo(() =>
      rooms.reduce((acc, r) => {
          acc[r.id] = r;
          return acc;
      }, {} as Record<string, Room>),
  [rooms]);

  const basketMap = React.useMemo(() =>
    baskets.reduce((acc, b) => {
        acc[b.id] = b;
        return acc;
    }, {} as Record<string, Basket>),
  [baskets]);

  const filteredCourses = React.useMemo(() => {
    if (!courseSearchQuery) {
      return courses;
    }
    return courses.filter(course =>
      course.name.toLowerCase().includes(courseSearchQuery.toLowerCase()) ||
      course.code.toLowerCase().includes(courseSearchQuery.toLowerCase())
    );
  }, [courses, courseSearchQuery]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminCode === process.env.NEXT_PUBLIC_ADMIN_CODE && password === process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
      setIsAdmin(true);
      setAuthError('');
    } else {
      setAuthError('Invalid admin code or password.');
    }
  };

  const handleBiometricLogin = async () => {
    if (!biometricCredentialId) return;
    try {
        const challenge = new Uint8Array(32);
        crypto.getRandomValues(challenge);

        const credential = await navigator.credentials.get({
            publicKey: {
                challenge,
                allowCredentials: [{
                    type: 'public-key',
                    id: base64ToArrayBuffer(biometricCredentialId),
                }],
                timeout: 60000,
            }
        });

        if (credential) {
            setIsAdmin(true);
            toast({ title: "Biometric Login Successful" });
        }
    } catch (err) {
        console.error(err);
        toast({ variant: 'destructive', title: "Biometric Login Failed", description: "Could not verify your identity. Please try again or use your password." });
    }
  };
  
  const handleLogout = () => {
    setIsAdmin(false);
    setAdminCode('');
    setPassword('');
    toast({
      title: 'Logged Out',
      description: 'You have been successfully logged out.',
    });
  };

  const addFaculty = (data: Omit<Faculty, 'id' | 'courses' | 'password'>) => {
    setFaculty(prev => [...prev, { ...data, id: `f-${Date.now()}`, courses: [], password: 'password' }]);
  };

  const handleAddCourse = (data: z.infer<typeof courseFormSchema>) => {
    const newCourseId = `c-${Date.now()}`;
    const finalEnrolledGroups: StudentGroup[] = [];
    data.enrolledGroups.forEach(group => {
        if (group.branch === 'CSE' && group.sections && group.sections.length > 0) {
            group.sections.forEach(section => {
                finalEnrolledGroups.push({ semester: group.semester, branch: group.branch, section });
            });
        } else {
            finalEnrolledGroups.push({ semester: group.semester, branch: group.branch });
        }
    });

    const newCourse: Course = {
      id: newCourseId,
      name: data.name,
      code: data.code,
      enrolledGroups: finalEnrolledGroups,
      studentCount: data.studentCount,
      duration: data.duration,
      classroomHours: data.classroomHours,
      tutorialHours: data.tutorialHours,
      labHours: data.labHours,
      weeklyClassroomHours: data.weeklyClassroomHours,
      weeklyTutorialHours: data.weeklyTutorialHours,
      weeklyLabHours: data.weeklyLabHours,
      startDate: data.startDate,
      requiresHardwareLab: data.requiresHardwareLab,
    };
    if (data.basketId && data.basketId !== 'none') {
        newCourse.basketId = data.basketId;
    }
    setCourses(prev => [...prev, newCourse]);

    if (data.facultyId && data.facultyId !== 'none') {
      setFaculty(prev => prev.map(f =>
        f.id === data.facultyId
          ? { ...f, courses: [...f.courses, newCourseId] }
          : f
      ));
    }
  };
  
  const handleUpdateCourse = (data: z.infer<typeof courseFormSchema>, courseId: string) => {
    const originalCourse = courses.find(c => c.id === courseId);
    if (!originalCourse) return;

    const finalEnrolledGroups: StudentGroup[] = [];
    data.enrolledGroups.forEach(group => {
        if (group.branch === 'CSE' && group.sections && group.sections.length > 0) {
            group.sections.forEach(section => {
                finalEnrolledGroups.push({ semester: group.semester, branch: group.branch, section });
            });
        } else {
            finalEnrolledGroups.push({ semester: group.semester, branch: group.branch });
        }
    });

    setCourses(prev => prev.map(course => {
        if (course.id === courseId) {
            const updatedCourse: Course = {
                ...course,
                name: data.name,
                code: data.code,
                enrolledGroups: finalEnrolledGroups,
                studentCount: data.studentCount,
                duration: data.duration,
                classroomHours: data.classroomHours,
                tutorialHours: data.tutorialHours,
                labHours: data.labHours,
                weeklyClassroomHours: data.weeklyClassroomHours,
                weeklyTutorialHours: data.weeklyTutorialHours,
                weeklyLabHours: data.weeklyLabHours,
                startDate: data.startDate,
                requiresHardwareLab: data.requiresHardwareLab,
            };

            if (data.basketId && data.basketId !== 'none') {
                updatedCourse.basketId = data.basketId;
            } else {
                delete (updatedCourse as Partial<Course>).basketId;
            }
            return updatedCourse;
        }
        return course;
    }));

    // Faculty assignment update
    const originalFacultyId = faculty.find(f => f.courses.includes(courseId))?.id;
    const newFacultyId = data.facultyId;

    if (originalFacultyId !== newFacultyId) {
        setFaculty(prev => prev.map(f => {
            if (f.id === originalFacultyId) {
                return { ...f, courses: f.courses.filter(c => c !== courseId) };
            }
            if (f.id === newFacultyId && newFacultyId !== 'none') {
                return { ...f, courses: [...f.courses, courseId] };
            }
            return f;
        }));
    }
  };

  const handleDeleteCourse = (courseId: string) => {
    setCourses(prev => prev.filter(c => c.id !== courseId));
    setFaculty(prev => prev.map(f => ({
      ...f,
      courses: f.courses.filter(cid => cid !== courseId),
    })));
  };

  const addRoom = (data: Omit<Room, 'id'>) => {
    setRooms(prev => [...prev, { ...data, id: `r-${Date.now()}` }]);
  };
  
  const handleUpdateRoom = (data: z.infer<typeof roomFormSchema>, roomId: string) => {
    setRooms(prev => prev.map(room => 
      room.id === roomId 
        ? { ...room, ...data } 
        : room
    ));
  };


  const addHoliday = (data: Omit<Holiday, 'id'>) => {
    const newHoliday: Holiday = {
      id: `h-${Date.now()}`,
      name: data.name,
      scope: data.scope,
      dateRange: {
        from: data.dateRange.from,
        to: data.dateRange.to || data.dateRange.from,
      },
    };
    setHolidays(prev => [...prev, newHoliday]);
    toast({ title: 'Holiday Added', description: `${data.name} on ${format(data.dateRange.from, 'PPP')} has been declared a holiday.` });
  };

  const removeHoliday = (holidayId: string) => {
    const holidayToRemove = holidays.find(h => h.id === holidayId);
    if (!holidayToRemove) return;

    // Find cancellations related to this holiday
    const reasonStr = `Holiday: ${holidayToRemove.name}`;
    const relatedCancellations = cancellations.filter(c => c.reason.startsWith(reasonStr));
    const relatedCancellationIds = new Set(relatedCancellations.map(c => c.id));
    
    // Find extra classes that were created for these specific cancellations
    const relatedExtraClassIds = new Set(relatedCancellations.map(c => c.extraClassId).filter(Boolean) as string[]);

    // Remove the holiday
    setHolidays(prev => prev.filter(h => h.id !== holidayId));
    // Remove related cancellations
    setCancellations(prev => prev.filter(c => !relatedCancellationIds.has(c.id)));
    // Remove related extra classes
    setExtraClasses(prev => prev.filter(ec => !relatedExtraClassIds.has(ec.id)));

    toast({ title: 'Holiday Removed', description: 'Associated cancellations and extra classes have also been removed, restoring original slots.' });
  };

  const addBasket = (data: Omit<Basket, 'id'>) => {
    setBaskets(prev => [...prev, { ...data, id: `b-${Date.now()}` }]);
  };
  
  const removeBasket = (basketId: string) => {
      setBaskets(prev => prev.filter(b => b.id !== basketId));
      setCourses(prev => prev.map(c => c.basketId === basketId ? { ...c, basketId: undefined } : c));
  };
  
  const handleSlotClick = (day: string, timeSlot: string, entry: TimetableEntry) => {
    setSelectedSlotDetails({ day, timeSlot, entry });
  };

  const handleMassRescheduleConfirm = (
    rescheduledData: { 
      makeupDate: Date, 
      makeupTimeSlot: string, 
      makeupRoomName: string, 
      originalClass: TimetableEntry & { timeSlot: string; date: Date } 
    }[]
  ) => {
    if (!classesToMassReschedule) return;
  
    const { reason, triggeringData } = classesToMassReschedule;
    
    const newCancellations: Cancellation[] = [];
    const newExtraClasses: Omit<ExtraClass, 'id'>[] = [];
  
    rescheduledData.forEach(item => {
        const extraClassId = `extra-${reason}-${Date.now()}-${Math.random()}`;
        
        let cancellationReason = `Rescheduled due to an event.`;
        if (reason === 'Holiday') {
            cancellationReason = `Holiday: ${triggeringData.name}`;
        } else if (reason === 'SlotCancellation') {
            cancellationReason = `ManualCancellation: ${triggeringData.reason}`;
        }
        const newCancellation: Cancellation = {
            id: `cancel-${reason}-${Date.now()}-${Math.random()}`,
            date: item.originalClass.date,
            timeSlot: item.originalClass.timeSlot,
            reason: cancellationReason,
            status: 'Rescheduled',
            extraClassId: extraClassId,
        };
        newCancellations.push(newCancellation);
  
        const extraClassPayload: Partial<ExtraClass> = {
          id: extraClassId,
          courseId: item.originalClass.courseId,
          date: item.makeupDate,
          timeSlot: item.makeupTimeSlot,
          roomName: item.makeupRoomName,
          reason: `Makeup for ${reason} on ${format(item.originalClass.date, 'PPP')}`,
        };
  
        if (item.originalClass.facultyId) {
          extraClassPayload.facultyId = item.originalClass.facultyId;
        }
  
        newExtraClasses.push(extraClassPayload as Omit<ExtraClass, 'id'>);
    });
  
    if (newCancellations.length > 0) {
        setCancellations(prev => [...prev, ...newCancellations]);
    }
    setExtraClasses(prev => [...prev, ...(newExtraClasses as ExtraClass[])]);
    
    let toastTitle = '';
    let toastDescription = '';
    
    switch(reason) {
      case 'FacultyLeave':
        setFacultyLeaves(prev => [...prev, { id: `leave-${Date.now()}`, ...triggeringData }]);
        toastTitle = 'Leave and Rescheduling Confirmed';
        toastDescription = `${facultyMap[triggeringData.facultyId]?.name} has been granted leave.`;
        break;
      case 'Holiday':
        if (longHolidayState) {
          const rescheduledClassKeys = new Set(rescheduledData.map(rd => `${rd.originalClass.courseId}-${rd.originalClass.date.getTime()}`));
          const remainingClasses = longHolidayState.allAffectedClasses.filter(c => !rescheduledClassKeys.has(`${c.courseId}-${c.date.getTime()}`));

          if (remainingClasses.length === 0) {
            addHoliday(triggeringData);
            setLongHolidayState(null);
          } else {
            setLongHolidayState(prev => ({...prev!, allAffectedClasses: remainingClasses }));
          }
        } else {
          addHoliday(triggeringData);
        }
        toastTitle = 'Holiday Declared and Classes Rescheduled';
        toastDescription = `${triggeringData.name} is now a holiday.`;
        break;
      case 'SlotCancellation':
        // A manual cancellation is handled in its own form.
        toastTitle = 'Classes Rescheduled';
        toastDescription = `Classes from the slot on ${format(triggeringData.date, 'PPP')} at ${triggeringData.timeSlot} were rescheduled.`;
        break;
    }
  
    toast({ title: toastTitle, description: `${toastDescription} ${rescheduledData.length} class(es) were rescheduled.` });
    setClassesToMassReschedule(null);
  };

  function ConflictItem({ conflict }: { conflict: TimetableConflict }) {
    const { courses, faculty, rooms } = useTimetable();
    const [suggestion, setSuggestion] = React.useState<string | null>(null);
    const [isLoading, setIsLoading] = React.useState(false);
  
    React.useEffect(() => {
      async function getSuggestion() {
        if (!conflict) return;
        setIsLoading(true);
        try {
          const courseInConflict = courses.find(c => c.id === conflict.details.courseId);
          const result = await generateConflictSuggestion({
            conflictType: conflict.type,
            conflictDescription: conflict.description,
            courses,
            faculty,
            rooms,
            courseInConflict,
          });
          setSuggestion(result.suggestion);
        } catch (error) {
          console.error("Error generating suggestion:", error);
          setSuggestion("Could not generate a suggestion at this time.");
        } finally {
          setIsLoading(false);
        }
      }
      getSuggestion();
    }, [conflict, courses, faculty, rooms]);
  
    return (
      <li className="space-y-1">
        <div className="flex items-start">
          <AlertTriangle className="h-4 w-4 mr-2 mt-1 flex-shrink-0" />
          <span>{conflict.description}</span>
        </div>
        <div className="text-foreground pl-6">
          {isLoading && (
            <p className="text-sm italic flex items-center gap-2">
              <Loader className="h-4 w-4" />
              Generating suggestion...
            </p>
          )}
          {suggestion && (
            <div className="text-sm flex items-start gap-2 pt-1">
                <Lightbulb className="h-4 w-4 mt-0.5 text-accent flex-shrink-0" />
                <div>
                    <span className="font-semibold">Suggestion:</span> <span className="text-foreground">{suggestion}</span>
                </div>
            </div>
          )}
        </div>
      </li>
    );
  }
  
  if (!isClient) {
    return (
      <div className="flex flex-grow items-center justify-center p-4 relative bg-background">
        <div className="absolute inset-0 -z-10 h-full w-full bg-background bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:6rem_4rem]">
          <div className="absolute bottom-0 left-0 right-0 top-0 bg-[radial-gradient(circle_500px_at_50%_200px,hsl(var(--primary)/.10),transparent)]" />
        </div>
        <Loader text="Loading Admin Portal..." />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-grow md:w-[1000px] h-full w-full items-center justify-center p-4 relative">
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
                        data-ai-hint="logo"
                    />
                </div>
            <CardTitle className="text-2xl">Admin Login</CardTitle>
            <CardDescription>
              Please enter your credentials to access the admin dashboard.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="admin-code">User ID</Label>
                <Input
                  className='bg-red'
                  id="admin-code"
                  type="text"
                  value={adminCode}
                  onChange={(e) => setAdminCode(e.target.value)}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  className='bg-red'
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {authError && <p className="text-sm font-medium text-destructive">{authError}</p>}
            </CardContent>
            <CardFooter className="flex-col gap-4">
              <Button type="submit" className="w-full">
                Login
              </Button>
              {biometricCredentialId && (
                <Button
                  type="button"
                  className="w-full bg-[#0C0950] text-white hover:bg-[#0C0950]/90"
                  onClick={handleBiometricLogin}
                >
                  <Fingerprint className="mr-2 h-4 w-4" />
                  Login with Biometrics
                </Button>
              )}
            </CardFooter>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="container md:min-w-[1024px] w-full h-full p-2 bg-[#1F316F] md:p-2">
      <div className="flex items-center w-full justify-between mb-8">
        <h1 className="text-4xl font-bold text-white font-headline">Administrator Dashboard</h1>
        <Button variant="destructive" onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Log Out
        </Button>
      </div>
      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="mb-4 grid w-full grid-cols-2 sm:grid-cols-5 border">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="scheduling">Scheduling Controls</TabsTrigger>
          <TabsTrigger value="resources">Resource Management</TabsTrigger>
          <TabsTrigger value="user_management">User Management</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          {conflicts.length > 0 && (
            <Card className="mb-6 border-destructive bg-destructive/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle />
                  Real-Time Conflict Alert
                </CardTitle>
                <CardDescription className="text-destructive/90">
                  The system has detected {conflicts.length} unresolved scheduling conflict{conflicts.length > 1 ? 's' : ''}. Immediate attention is required.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm text-destructive">
                  {conflicts.slice(0, 3).map((conflict, index) => (
                    <li key={index} className="ml-4 list-disc">{conflict.description}</li>
                  ))}
                  {conflicts.length > 3 && (
                      <li className="ml-4 list-disc">...and {conflicts.length - 3} more.</li>
                  )}
                </ul>
              </CardContent>
              <CardFooter>
                <Button variant="destructive" onClick={() => setActiveDashboardTab("conflicts")}>
                  Review All Conflicts
                </Button>
              </CardFooter>
            </Card>
          )}
           <Tabs value={activeDashboardTab} onValueChange={setActiveDashboardTab} className="w-full">
            <TabsList className="mb-4 grid w-full grid-cols-2 border">
              <TabsTrigger value="timetable">Master Timetable</TabsTrigger>
              <TabsTrigger value="conflicts">Scheduling Conflicts</TabsTrigger>
            </TabsList>
            <TabsContent value="timetable">
              <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                      <div>
                        <CardTitle>Master Timetable</CardTitle>
                        <CardDescription>Full view of the schedule. Use the date picker to navigate weeks.</CardDescription>
                      </div>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant={"outline"} className="w-full sm:w-[280px] justify-start text-left font-normal" disabled={!selectedWeek}>
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {selectedWeek ? `Week of ${format(startOfWeek(selectedWeek, { weekStartsOn: 1 }), "PPP")}` : "Loading..."}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                          <Calendar
                            mode="single"
                            selected={selectedWeek}
                            onSelect={setSelectedWeek}
                            initialFocus
                            defaultMonth={semesterSettings.startDate}
                            fromDate={semesterSettings.startDate}
                            toDate={semesterSettings.endDate}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                </CardHeader>
                <CardContent>
                  {selectedWeek ? (
                    <TimetableGrid timetable={timetable} onSlotClick={handleSlotClick} startDate={startOfWeek(selectedWeek, { weekStartsOn: 1 })} />
                  ) : (
                    <div className="text-center text-muted-foreground">
                      <Loader text="Loading timetable..." />
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="conflicts">
               {conflicts.length > 0 ? (
                <Card className="border-destructive/50">
                  <CardHeader>
                    <CardTitle className="text-destructive flex items-center"><AlertTriangle className="mr-2" />Scheduling Conflicts</CardTitle>
                    <CardDescription>The following classes could not be automatically scheduled. Here are some AI-powered suggestions to help you resolve them.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3 text-destructive">
                       {conflicts.map((c, i) => <ConflictItem key={i} conflict={c} />)}
                    </ul>
                  </CardContent>
                </Card>
              ) : (
                 <Card>
                  <CardContent className="p-6 text-center text-muted-foreground">
                    <p>No scheduling conflicts found. The timetable is clean!</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </TabsContent>
        
        <TabsContent value="scheduling">
          <Tabs defaultValue="settings" className="w-full">
            <TabsList className="mb-4 grid md:w-auto grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 border">
              <TabsTrigger value="settings">Semester Settings</TabsTrigger>
              <TabsTrigger value="exams">Exam Schedules</TabsTrigger>
              <TabsTrigger value="holidays">Holidays</TabsTrigger>
              <TabsTrigger value="cancellations">Cancellations</TabsTrigger>
              <TabsTrigger value="leaves">Staff Leaves</TabsTrigger>
              <TabsTrigger value="conflict_resolution">Conflict Resolution</TabsTrigger>
               <TabsTrigger value="extra_classes">Manage Extra Classes</TabsTrigger>
            </TabsList>
            <TabsContent value="settings">
              <SemesterSettingsManager />
            </TabsContent>
             <TabsContent value="exams">
              <ExamScheduleManager openDeleteConfirmation={openDeleteConfirmation} />
            </TabsContent>
            <TabsContent value="holidays">
               <div className="grid md:grid-cols-2 gap-6">
                  <AddHolidayForm 
                    setLongHolidayState={setLongHolidayState}
                  />
                  <Card>
                    <CardHeader>
                      <CardTitle>Declared Holidays</CardTitle>
                      <CardDescription>This is a list of all declared holidays. They will not have any classes scheduled.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date(s)</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Scope</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {holidays.length > 0 ? holidays
                            .sort((a, b) => a.dateRange.from.getTime() - b.dateRange.from.getTime())
                            .map((holiday) => (
                              <TableRow key={holiday.id}>
                                <TableCell>
                                    {format(holiday.dateRange.from, "PPP")}
                                    {holiday.dateRange.to && holiday.dateRange.to.getTime() !== holiday.dateRange.from.getTime() ? ` - ${format(holiday.dateRange.to, "PPP")}` : ''}
                                </TableCell>
                                <TableCell>{holiday.name}</TableCell>
                                <TableCell>
                                  {holiday.scope === 'only_first_sem' ? 'Only 1st Sem' : 'All Except 1st Sem'}
                                </TableCell>
                                <TableCell>
                                  <Button variant="ghost" size="icon" onClick={() => openDeleteConfirmation(() => removeHoliday(holiday.id))}>
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            )) : (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center">No holidays declared.</TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
            </TabsContent>
            <TabsContent value="cancellations">
              <CancellationManager setClassesToMassReschedule={setClassesToMassReschedule} openDeleteConfirmation={openDeleteConfirmation} />
            </TabsContent>
            <TabsContent value="leaves">
              <FacultyLeaveManager 
                setClassesToMassReschedule={setClassesToMassReschedule}
                openDeleteConfirmation={openDeleteConfirmation}
              />
            </TabsContent>
            <TabsContent value="conflict_resolution">
                <ConflictResolutionManager />
            </TabsContent>
            <TabsContent value="extra_classes">
                <ExtraClassManager openDeleteConfirmation={openDeleteConfirmation} />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="resources">
          <Tabs defaultValue="courses" className="w-full">
            <TabsList className="mb-4 grid w-full grid-cols-2 sm:grid-cols-4 border">
              <TabsTrigger value="courses">Manage Courses</TabsTrigger>
              <TabsTrigger value="staff">Staff Management</TabsTrigger>
              <TabsTrigger value="baskets">Manage Baskets</TabsTrigger>
              <TabsTrigger value="rooms">Manage Rooms</TabsTrigger>
            </TabsList>
            <TabsContent value="courses">
               <Card>
                <CardHeader>
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div className="space-y-1.5">
                      <CardTitle>Course Management</CardTitle>
                      <CardDescription>Add, edit, or delete courses.</CardDescription>
                    </div>
                    <div className="flex items-center gap-4">
                      <Input
                        placeholder="Search by name or code..."
                        value={courseSearchQuery}
                        onChange={(e) => setCourseSearchQuery(e.target.value)}
                        className="w-full sm:w-64"
                      />
                      <Button onClick={() => { setEditingCourse(null); setIsCourseFormOpen(true); }}>
                        <PlusCircle className="mr-2 h-4 w-4"/>Add Course
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Duration</TableHead>
                        <TableHead>Basket</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>Groups</TableHead>
                        <TableHead>Students</TableHead>
                        <TableHead>Total Class (h)</TableHead>
                        <TableHead>Wkly Class (h)</TableHead>
                        <TableHead>Total Tut (h)</TableHead>
                        <TableHead>Wkly Tut (h)</TableHead>
                        <TableHead>Total Lab (h)</TableHead>
                        <TableHead>Wkly Lab (h)</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCourses.map((item, index) => (
                        <TableRow key={item.id} className={cn(index % 2 === 0 ? 'bg-[#FFE99A] hover:bg-[#fddb70]' : 'bg-[#FFAAAA] hover:bg-[#ff9999]')}>
                          <TableCell>{item.name}</TableCell>
                          <TableCell>{item.code}</TableCell>
                          <TableCell>
                            {item.duration === 'Full' && 'Full Sem'}
                            {item.duration === 'Half-1' && 'First Half'}
                            {item.duration === 'Half-2' && 'Second Half'}
                          </TableCell>
                          <TableCell>{item.basketId ? basketMap[item.basketId]?.code : '-'}</TableCell>
                          <TableCell>{format(item.startDate, "PPP")}</TableCell>
                          <TableCell>{formatEnrolledGroupsForDisplay(item.enrolledGroups)}</TableCell>
                          <TableCell>{item.studentCount}</TableCell>
                          <TableCell>{item.classroomHours}</TableCell>
                          <TableCell>{item.weeklyClassroomHours}</TableCell>
                          <TableCell>{item.tutorialHours}</TableCell>
                          <TableCell>{item.weeklyTutorialHours}</TableCell>
                          <TableCell>{item.labHours}</TableCell>
                          <TableCell>{item.weeklyLabHours}</TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <Button variant="ghost" size="icon" onClick={() => { setEditingCourse(item); setIsCourseFormOpen(true); }}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => openDeleteConfirmation(() => handleDeleteCourse(item.id))}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
             <TabsContent value="staff">
                <Card>
                    <CardHeader className="flex-row items-center justify-between">
                    <CardTitle>Faculty Management</CardTitle>
                    <AddFacultyForm onAdd={addFaculty} />
                    </CardHeader>
                    <CardContent>
                    <Table>
                        <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Courses</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                        <TableBody>
                        {faculty.map((item, index) => (
                            <TableRow key={item.id} className={cn(index % 2 === 0 ? 'bg-[#F3F3E0] hover:bg-[#e9e9d6]' : 'bg-[#EF88AD] hover:bg-[#e0789d]')}>
                            <TableCell>{item.name}</TableCell>
                            <TableCell>{item.courses.map(id => courseMap[id]?.code || id).join(', ')}</TableCell>
                            <TableCell><Button variant="ghost" size="icon" onClick={() => openDeleteConfirmation(() => setFaculty(f => f.filter(i => i.id !== item.id)))}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                            </TableRow>
                        ))}
                        </TableBody>
                    </Table>
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="baskets">
                <Card>
                    <CardHeader className="flex-row items-center justify-between">
                        <CardTitle>Course Baskets</CardTitle>
                        <AddBasketForm onAdd={addBasket} />
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                            <TableBody>
                            {baskets.map((item) => (
                                <TableRow key={item.id}>
                                    <TableCell>{item.name}</TableCell>
                                    <TableCell>{item.code}</TableCell>
                                    <TableCell><Button variant="ghost" size="icon" onClick={() => openDeleteConfirmation(() => removeBasket(item.id))}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                                </TableRow>
                            ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </TabsContent>
            <TabsContent value="rooms">
              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle>Room Management</CardTitle>
                  <Button onClick={() => { setEditingRoom(null); setIsRoomFormOpen(true); }}>
                    <PlusCircle className="mr-2 h-4 w-4"/>Add Room
                  </Button>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Capacity</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {rooms.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.name}</TableCell><TableCell>{item.type}</TableCell><TableCell>{item.capacity}</TableCell>
                          <TableCell>
                            <div className="flex items-center">
                              <Button variant="ghost" size="icon" onClick={() => { setEditingRoom(item); setIsRoomFormOpen(true); }}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => openDeleteConfirmation(() => setRooms(r => r.filter(i => i.id !== item.id)))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>
        <TabsContent value="user_management">
            <Tabs defaultValue="faculty_accounts" className="w-full">
                <TabsList className="mb-4 grid w-full grid-cols-3 border">
                    <TabsTrigger value="faculty_accounts">Faculty Accounts</TabsTrigger>
                    <TabsTrigger value="admin_security">Admin Security</TabsTrigger>
                    <TabsTrigger value="submissions">User Submissions</TabsTrigger>
                </TabsList>
                <TabsContent value="faculty_accounts">
                    <FacultyAccountManager />
                </TabsContent>
                 <TabsContent value="admin_security">
                    <AdminSecurityManager 
                        credentialId={biometricCredentialId} 
                        setCredentialId={setBiometricCredentialId} 
                        openDeleteConfirmation={openDeleteConfirmation}
                    />
                </TabsContent>
                <TabsContent value="submissions">
                    <FeedbackManager openDeleteConfirmation={openDeleteConfirmation} />
                </TabsContent>
            </Tabs>
        </TabsContent>

        <TabsContent value="reports">
          <SchedulingReports />
        </TabsContent>
      </Tabs>
      
      <CourseFormDialog
        open={isCourseFormOpen}
        onOpenChange={setIsCourseFormOpen}
        courseToEdit={editingCourse}
        onAdd={handleAddCourse}
        onUpdate={handleUpdateCourse}
        faculty={faculty}
        baskets={baskets}
        semesterSettings={semesterSettings}
      />
      
      <RoomFormDialog
        open={isRoomFormOpen}
        onOpenChange={(isOpen) => {
          if (!isOpen) setEditingRoom(null);
          setIsRoomFormOpen(isOpen);
        }}
        roomToEdit={editingRoom}
        onAdd={addRoom}
        onUpdate={handleUpdateRoom}
      />

      <MassRescheduleDialog
        isOpen={!!classesToMassReschedule}
        onClose={() => setClassesToMassReschedule(null)}
        details={classesToMassReschedule}
        onConfirm={handleMassRescheduleConfirm}
        rooms={rooms}
        roomMap={roomMap}
      />
      
      <LongHolidayManagerDialog
        isOpen={!!longHolidayState}
        state={longHolidayState}
        onClose={() => setLongHolidayState(null)}
        setClassesToMassReschedule={setClassesToMassReschedule}
        setCancellations={setCancellations}
        addHoliday={addHoliday}
        toast={toast}
      />


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

            const details = [
                { label: "Day", value: day },
                { label: "Time Slot", value: entry.type === 'Lab' ? `${timeSlot.split('-')[0]}-${parseInt(timeSlot.split('-')[1].split(':')[0]) + 1}:00` : timeSlot },
                { label: "Course", value: course ? `${course.name} (${course.code})` + (entry.type !== 'Classroom' ? ` (${entry.type})` : '') : 'N/A' },
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
          <DialogFooter className="bg-[#e0f7fa] p-6 pt-4 flex justify-end">
            <Button type="button" variant="destructive" onClick={() => setSelectedSlotDetails(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isConfirmDeleteDialogOpen} onOpenChange={setIsConfirmDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the item from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { deleteActionRef.current = null; }}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className={buttonVariants({ variant: "destructive" })}>
              Confirm Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AdminSecurityManager({ credentialId, setCredentialId, openDeleteConfirmation }: { credentialId: string | null, setCredentialId: (id: string | null) => void, openDeleteConfirmation: (action: () => void) => void; }) {
    const { toast } = useToast();

    const handleRegisterBiometric = async () => {
        try {
            const challenge = new Uint8Array(32);
            crypto.getRandomValues(challenge);

            const excludeCredentials: PublicKeyCredentialDescriptor[] = [];
            if (credentialId) {
                excludeCredentials.push({
                    id: base64ToArrayBuffer(credentialId),
                    type: 'public-key',
                    transports: ['internal'],
                });
            }

            const credential = await navigator.credentials.create({
                publicKey: {
                    challenge,
                    rp: { name: "TimeWise Admin", id: window.location.hostname },
                    user: {
                        id: new TextEncoder().encode("admin-user-id"),
                        name: "admin@timewise.app",
                        displayName: "Admin",
                    },
                    pubKeyCredParams: [{ type: "public-key", alg: -7 }], // ES256
                    authenticatorSelection: {
                        authenticatorAttachment: "platform",
                        userVerification: "required",
                        residentKey: "required",
                    },
                    timeout: 60000,
                    excludeCredentials,
                }
            });

            if (credential) {
                const newCredentialId = arrayBufferToBase64((credential as any).rawId);
                localStorage.setItem('webauthn-credential-id', newCredentialId);
                setCredentialId(newCredentialId);
                toast({ title: "Biometric Login Activated", description: "You can now log in using this device's biometrics." });
            }
        } catch (err) {
            console.error(err);
            toast({ variant: 'destructive', title: "Registration Failed", description: "Could not set up biometric login. Your browser might not support it, or you may have cancelled the request." });
        }
    };
    
    const handleDeregisterBiometric = () => {
        localStorage.removeItem('webauthn-credential-id');
        setCredentialId(null);
        toast({ title: "Biometric Login Deactivated" });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Biometric Authentication</CardTitle>
                <CardDescription>
                    {credentialId 
                        ? "Biometric login is active. You can log in with this device's fingerprint or face scan."
                        : "Activate biometric login for a passwordless, secure sign-in experience on this device."
                    }
                </CardDescription>
            </CardHeader>
            <CardContent>
                {credentialId ? (
                    <Button variant="destructive" onClick={() => openDeleteConfirmation(handleDeregisterBiometric)}>
                        Deactivate Biometric Login
                    </Button>
                ) : (
                    <Button onClick={handleRegisterBiometric}>
                        <Fingerprint className="mr-2 h-4 w-4" />
                        Activate Biometric Login
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}

function SchedulingReports() {
  const { timetable, courses, facultyMap } = useTimetable();

  const reportData = React.useMemo(() => {
    const data: Record<string, {
      course: Course;
      facultyName: string;
      Classroom?: { first: Date | null; last: Date | null };
      Tutorial?: { first: Date | null; last: Date | null };
      Lab?: { first: Date | null; last: Date | null };
    }> = {};

    const sortedDates = Object.keys(timetable).sort();

    for (const dateStr of sortedDates) {
      const date = parseISO(dateStr);
      const daySchedule = timetable[dateStr];
      for (const timeSlot in daySchedule) {
        const entries = daySchedule[timeSlot];
        if (entries) {
          for (const entry of entries) {
            if (!data[entry.courseId]) {
              const course = courses.find(c => c.id === entry.courseId);
              if (!course) continue;
              const faculty = facultyMap[entry.facultyId || ''];
              data[entry.courseId] = {
                course,
                facultyName: faculty?.name || 'N/A',
              };
            }

            const courseRecord = data[entry.courseId];
            if (!courseRecord[entry.type]) {
              courseRecord[entry.type] = { first: null, last: null };
            }

            const typeRecord = courseRecord[entry.type]!;
            if (!typeRecord.first) {
              typeRecord.first = date;
            }
            typeRecord.last = date;
          }
        }
      }
    }
    return Object.values(data).sort((a,b) => a.course.code.localeCompare(b.course.code));
  }, [timetable, courses, facultyMap]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center"><FileText className="mr-2"/>Scheduling Report</CardTitle>
        <CardDescription>
          Overview of the first and last scheduled dates for each course and class type.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Course</TableHead>
              <TableHead>Groups</TableHead>
              <TableHead>Faculty</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>First Class</TableHead>
              <TableHead>Last Class</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reportData.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No classes scheduled to generate a report.
                </TableCell>
              </TableRow>
            )}
            {reportData.map(({ course, facultyName, Classroom, Tutorial, Lab }) => (
              <React.Fragment key={course.id}>
                {Classroom && (
                  <TableRow>
                    <TableCell className="font-medium">{course.name} ({course.code})</TableCell>
                    <TableCell>{formatEnrolledGroupsForDisplay(course.enrolledGroups)}</TableCell>
                    <TableCell>{facultyName}</TableCell>
                    <TableCell><Badge variant="secondary">Classroom</Badge></TableCell>
                    <TableCell>{Classroom.first ? format(Classroom.first, 'PPP') : 'N/A'}</TableCell>
                    <TableCell>{Classroom.last ? format(Classroom.last, 'PPP') : 'N/A'}</TableCell>
                  </TableRow>
                )}
                {Tutorial && (
                  <TableRow>
                    <TableCell className="font-medium">{course.name} ({course.code})</TableCell>
                    <TableCell>{formatEnrolledGroupsForDisplay(course.enrolledGroups)}</TableCell>
                    <TableCell>{facultyName}</TableCell>
                    <TableCell><Badge variant="outline" className="border-blue-500 text-blue-500">Tutorial</Badge></TableCell>
                    <TableCell>{Tutorial.first ? format(Tutorial.first, 'PPP') : 'N/A'}</TableCell>
                    <TableCell>{Tutorial.last ? format(Tutorial.last, 'PPP') : 'N/A'}</TableCell>
                  </TableRow>
                )}
                {Lab && (
                  <TableRow>
                    <TableCell className="font-medium">{course.name} ({course.code})</TableCell>
                    <TableCell>{formatEnrolledGroupsForDisplay(course.enrolledGroups)}</TableCell>
                    <TableCell>{facultyName}</TableCell>
                    <TableCell><Badge variant="outline" className="border-green-500 text-green-500">Lab</Badge></TableCell>
                    <TableCell>{Lab.first ? format(Lab.first, 'PPP') : 'N/A'}</TableCell>
                    <TableCell>{Lab.last ? format(Lab.last, 'PPP') : 'N/A'}</TableCell>
                  </TableRow>
                )}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}


function SemesterSettingsManager() {
  const { semesterSettings, setSemesterSettings } = useTimetable();
  const { toast } = useToast();

  const handleDateSelect = (
    date: Date | undefined,
    field: 'startDate' | 'endDate' | 'seniorEndDate'
  ) => {
    if (!date) return;
  
    const newSettings = { ...semesterSettings, [field]: date };
  
    if (field === 'startDate' && newSettings.endDate && date > newSettings.endDate) {
      toast({ variant: "destructive", title: "Invalid Date", description: "Start date cannot be after the end date." });
      return;
    }
    if (field === 'endDate' && newSettings.startDate && date < newSettings.startDate) {
      toast({ variant: "destructive", title: "Invalid Date", description: "End date cannot be before the start date." });
      return;
    }
    if (field === 'seniorEndDate' && newSettings.startDate && date < newSettings.startDate) {
        toast({ variant: "destructive", title: "Invalid Date", description: "Senior end date cannot be before the start date." });
        return;
    }
  
    setSemesterSettings(newSettings);
    toast({
      title: `Semester ${field.replace('Date', '')} Date Updated`,
      description: `Date set to ${format(date, "PPP")}.`,
    });
  };
  
  return (
    <div className="grid md:grid-cols-3 gap-6">
        <Card>
            <CardHeader>
                <CardTitle className="text-xl flex items-center"><CalendarIcon className="mr-3 h-5 w-5"/>Start Date</CardTitle>
                <CardDescription>Selected: {semesterSettings.startDate ? format(semesterSettings.startDate, 'PPP') : 'Not set'}</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center p-0">
                <Calendar
                    mode="single"
                    selected={semesterSettings.startDate}
                    onSelect={(date) => handleDateSelect(date, 'startDate')}
                    className='border-0 shadow-none'
                />
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
                <CardTitle className="text-xl flex items-center"><CalendarIcon className="mr-3 h-5 w-5"/>End Date (Juniors)</CardTitle>
                <CardDescription>Selected: {semesterSettings.endDate ? format(semesterSettings.endDate, 'PPP') : 'Not set'}</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center p-0">
                 <Calendar
                    mode="single"
                    selected={semesterSettings.endDate}
                    onSelect={(date) => handleDateSelect(date, 'endDate')}
                    disabled={(date) => semesterSettings.startDate ? date < semesterSettings.startDate : false }
                    className='border-0 shadow-none'
                />
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
                <CardTitle className="text-xl flex items-center"><CalendarIcon className="mr-3 h-5 w-5"/>End Date (Seniors)</CardTitle>
                <CardDescription>Selected: {semesterSettings.seniorEndDate ? format(semesterSettings.seniorEndDate, 'PPP') : 'Not set'}</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center p-0">
                 <Calendar
                    mode="single"
                    selected={semesterSettings.seniorEndDate}
                    onSelect={(date) => handleDateSelect(date, 'seniorEndDate')}
                    disabled={(date) => semesterSettings.startDate ? date < semesterSettings.startDate : false }
                    className='border-0 shadow-none'
                />
            </CardContent>
        </Card>
    </div>
  )
}

function CancellationManager({ setClassesToMassReschedule, openDeleteConfirmation }: { setClassesToMassReschedule: (details: any) => void, openDeleteConfirmation: (action: () => void) => void; }) {
    const { cancellations, setCancellations, timetable, semesterSettings, courseMap } = useTimetable();
    const { toast } = useToast();
    const [confirmCancelDialogState, setConfirmCancelDialogState] = React.useState<{ isOpen: boolean; classes: TimetableEntry[]; date: Date; timeSlot: string; reason: string; }>({ isOpen: false, classes: [], date: new Date(), timeSlot: '', reason: '' });

    const form = useForm<z.infer<typeof cancellationFormSchema>>({
        resolver: zodResolver(cancellationFormSchema),
        defaultValues: {
            date: undefined,
            timeSlot: undefined,
            reason: "",
        },
    });

    function onSubmit(values: z.infer<typeof cancellationFormSchema>) {
        const dateStr = format(values.date, 'yyyy-MM-dd');
        
        const classesInSlot = timetable[dateStr]?.[values.timeSlot] || [];
        if (classesInSlot.length > 0) {
            setConfirmCancelDialogState({
                isOpen: true,
                classes: classesInSlot,
                date: values.date,
                timeSlot: values.timeSlot,
                reason: values.reason,
            });
            return;
        }
        
        // If there are no classes, just add a blank cancellation to free the slot
        const newCancellation: Cancellation = {
            id: `cancel-${Date.now()}`,
            date: values.date,
            timeSlot: values.timeSlot,
            reason: `Manual Cancellation: ${values.reason}`,
            status: 'Cancelled',
        };
        setCancellations(prev => [...prev, newCancellation]);
        toast({ title: 'Slot Freed', description: `The slot on ${format(values.date, 'PPP')} at ${values.timeSlot} is now marked as unavailable.` });
        form.reset({ date: undefined, timeSlot: undefined, reason: "" });
    }

    const handleConfirmPermanentCancellation = () => {
        const { classes, date, timeSlot, reason } = confirmCancelDialogState;

        const newCancellation: Cancellation = {
            id: `cancel-slot-${date.getTime()}-${timeSlot}`,
            date: date,
            timeSlot: timeSlot,
            reason: `Manual Cancellation: ${reason}`,
            status: 'Cancelled',
            cancelledClasses: classes.map(c => ({ courseId: c.courseId, classType: c.type })),
        };

        setCancellations(prev => [...prev, newCancellation]);
        toast({ title: 'Classes Cancelled', description: `${classes.length} class(es) have been permanently cancelled.` });
        
        setConfirmCancelDialogState({ isOpen: false, classes: [], date: new Date(), timeSlot: '', reason: '' });
        form.reset({ date: undefined, timeSlot: undefined, reason: "" });
    };

    const handleRemoveCancellation = (id: string) => {
        setCancellations(prev => prev.filter(c => c.id !== id));
        toast({ title: 'Cancellation Removed' });
    };

    return (
        <>
            <div className="grid md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center"><Ban className="mr-2 h-5 w-5"/>Cancel a Time Slot</CardTitle>
                        <CardDescription>Free up a slot for an event. The timetable will be updated automatically.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                <FormField
                                    control={form.control}
                                    name="date"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                            <FormLabel>Date</FormLabel>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <FormControl>
                                                        <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                                            {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                        </Button>
                                                    </FormControl>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0" align="start">
                                                    <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus fromDate={semesterSettings.startDate} toDate={semesterSettings.endDate} modifiers={{ weekend: { dayOfWeek: [0, 6] } }}/>
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
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger><SelectValue placeholder="Select Time Slot" /></SelectTrigger>
                                                </FormControl>
                                                <SelectContent>{timeSlots.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="reason"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Reason for Cancellation</FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g. Department Meeting" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div className="flex justify-end">
                                    <Button type="submit">Cancel Slot</Button>
                                </div>
                            </form>
                        </Form>
                    </CardContent>
                </Card>
                 <Card>
                    <CardHeader>
                        <CardTitle>Cancelled Slots</CardTitle>
                        <CardDescription>This is a list of all manually cancelled slots. These will not have any classes scheduled.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Time Slot</TableHead>
                                    <TableHead>Reason</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {cancellations.length > 0 ? cancellations
                                    .filter(c => c.status === 'Cancelled' && c.reason.startsWith('Manual Cancellation:'))
                                    .sort((a, b) => a.date.getTime() - b.date.getTime())
                                    .map((cancellation, index) => (
                                        <TableRow key={cancellation.id}>
                                            <TableCell>{format(cancellation.date, "PPP")}</TableCell>
                                            <TableCell>{cancellation.timeSlot}</TableCell>
                                            <TableCell>{cancellation.reason}</TableCell>
                                            <TableCell>{cancellation.status}</TableCell>
                                            <TableCell>
                                                <Button variant="ghost" size="icon" onClick={() => openDeleteConfirmation(() => handleRemoveCancellation(cancellation.id))}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )) : (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center">No slots manually cancelled.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
            <AlertDialog open={confirmCancelDialogState.isOpen} onOpenChange={(isOpen) => setConfirmCancelDialogState(prev => ({ ...prev, isOpen }))}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Permanent Cancellation</AlertDialogTitle>
                  <AlertDialogDescription>
                    This slot contains scheduled classes. Do you want to permanently cancel them? This action will reduce the semester hour target for the affected course(s) and cannot be undone.
                    <ul className="mt-2 list-disc pl-5 text-sm text-foreground">
                        {confirmCancelDialogState.classes.map(c => <li key={c.courseId}>{courseMap[c.courseId]?.name} ({c.type})</li>)}
                    </ul>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Back</AlertDialogCancel>
                  <AlertDialogAction onClick={handleConfirmPermanentCancellation} className={buttonVariants({ variant: "destructive" })}>
                    Confirm Cancellation
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
        </>
    );
}

function FacultyLeaveManager({ setClassesToMassReschedule, openDeleteConfirmation }: { setClassesToMassReschedule: (details: any) => void; openDeleteConfirmation: (action: () => void) => void; }) {
    const { facultyLeaves, setFacultyLeaves, faculty, facultyMap, semesterSettings, timetable, setExtraClasses, setCancellations, cancellations, extraClasses } = useTimetable();
    const { toast } = useToast();

    const form = useForm<z.infer<typeof facultyLeaveFormSchema>>({
        resolver: zodResolver(facultyLeaveFormSchema),
        defaultValues: {
            facultyId: undefined,
            dateRange: { from: undefined, to: undefined },
            reason: "",
        },
    });

    const facultyOptions = React.useMemo(() => 
        faculty.map(f => ({ value: f.id, label: f.name }))
    , [faculty]);

    function onSubmit(values: z.infer<typeof facultyLeaveFormSchema>) {
        if (!values.dateRange.from) return;

        const processedValues = {
            ...values,
            dateRange: {
                from: values.dateRange.from,
                to: values.dateRange.to || values.dateRange.from,
            }
        };

        const allDates = eachDayOfInterval({ start: processedValues.dateRange.from, end: processedValues.dateRange.to });
        
        const classesToReschedule: (TimetableEntry & { timeSlot: string; date: Date })[] = [];
        allDates.forEach(day => {
            const dayOfWeek = getDay(day);
            if (dayOfWeek > 0 && dayOfWeek < 6) { // Monday to Friday
                const dateStr = format(day, 'yyyy-MM-dd');
                const daySchedule = timetable[dateStr];
                if (daySchedule) {
                    timeSlots.forEach(slot => {
                        daySchedule[slot]?.forEach(entry => {
                            if (entry.facultyId === processedValues.facultyId) {
                                classesToReschedule.push({ ...entry, timeSlot: slot, date: day });
                            }
                        });
                    });
                }
            }
        });
        
        const uniqueClassesToReschedule = Array.from(new Map(classesToReschedule.map(cls => [`${cls.courseId}-${cls.type}-${cls.timeSlot}-${format(cls.date, 'yyyy-MM-dd')}`, cls])).values());

        if (uniqueClassesToReschedule.length > 0) {
            setClassesToMassReschedule({
                reason: 'FacultyLeave',
                triggeringData: processedValues,
                classes: uniqueClassesToReschedule,
            });
            form.reset({ facultyId: undefined, dateRange: { from: undefined, to: undefined }, reason: "" });
            return;
        }
        
        const newLeave: FacultyLeave = {
            id: `leave-${Date.now()}`,
            facultyId: processedValues.facultyId,
            dateRange: processedValues.dateRange,
            reason: processedValues.reason,
        };
        setFacultyLeaves(prev => [...prev, newLeave]);
        const facultyMember = faculty.find(f => f.id === processedValues.facultyId);
        toast({ title: 'Leave Granted', description: `${facultyMember?.name} will be on leave.` });
        form.reset({ facultyId: undefined, dateRange: { from: undefined, to: undefined }, reason: "" });
    }

    const handleRemoveLeave = (leaveId: string) => {
        const leaveToRemove = facultyLeaves.find(l => l.id === leaveId);
        if (!leaveToRemove) return;

        // Find all cancellations linked to this leave by checking the reason
        const reasonStr = `FacultyLeave: ${facultyMap[leaveToRemove.facultyId]?.name} - ${leaveToRemove.reason}`;
        const relatedCancellations = cancellations.filter(c => c.reason === reasonStr);
        const relatedCancellationIds = new Set(relatedCancellations.map(c => c.id));
        const relatedExtraClassIds = new Set(relatedCancellations.map(c => c.extraClassId).filter(id => !!id));

        // Remove the leave
        setFacultyLeaves(prev => prev.filter(l => l.id !== leaveId));
        // Remove related cancellations
        setCancellations(prev => prev.filter(c => !relatedCancellationIds.has(c.id)));
        // Remove related extra classes
        setExtraClasses(prev => prev.filter(ec => !relatedExtraClassIds.has(ec.id)));

        toast({ title: 'Leave Removed', description: 'Associated cancellations and extra classes have also been removed.' });
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center"><UserX className="mr-2 h-5 w-5"/>Grant Faculty Leave</CardTitle>
                    <CardDescription>Declare a day off for a faculty member. You will be prompted to reschedule their classes.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <FormField
                                control={form.control}
                                name="facultyId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Faculty Member</FormLabel>
                                        <FormControl>
                                            <Combobox
                                                options={facultyOptions}
                                                value={field.value}
                                                onValueChange={field.onChange}
                                                placeholder="Select Faculty"
                                                searchPlaceholder="Search faculty..."
                                                emptyResultText="No faculty found."
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="dateRange"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Date(s) of Leave</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value?.from && "text-muted-foreground")}>
                                                        {field.value?.from ? (
                                                            field.value.to ? (
                                                                <>{format(field.value.from, "LLL dd, y")} - {format(field.value.to, "LLL dd, y")}</>
                                                            ) : (
                                                                format(field.value.from, "LLL dd, y")
                                                            )
                                                        ) : (
                                                            <span>Pick a date or range</span>
                                                        )}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar mode="range" selected={field.value} onSelect={field.onChange} initialFocus fromDate={semesterSettings.startDate} toDate={semesterSettings.endDate} modifiers={{ weekend: { dayOfWeek: [0, 6] } }}/>
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="reason"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Reason for Leave</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g. Personal Leave" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div className="flex justify-end">
                                <Button type="submit">Grant Leave</Button>
                            </div>
                        </form>
                    </Form>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>Granted Faculty Leaves</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Faculty</TableHead>
                                <TableHead>Date(s)</TableHead>
                                <TableHead>Reason</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {facultyLeaves.length > 0 ? facultyLeaves
                                .sort((a, b) => a.dateRange.from.getTime() - b.dateRange.from.getTime())
                                .map((leave) => (
                                    <TableRow key={leave.id}>
                                        <TableCell>{facultyMap[leave.facultyId]?.name || 'Unknown'}</TableCell>
                                        <TableCell>
                                            {format(leave.dateRange.from, "PPP")}
                                            {leave.dateRange.to && ` - ${format(leave.dateRange.to, "PPP")}`}
                                        </TableCell>
                                        <TableCell>{leave.reason}</TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="icon" onClick={() => openDeleteConfirmation(() => handleRemoveLeave(leave.id))}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                )) : (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center">No leaves granted.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

function FeedbackManager({ openDeleteConfirmation }: { openDeleteConfirmation: (action: () => void) => void; }) {
    const { feedbackItems, setFeedbackItems } = useTimetable();
    const { toast } = useToast();

    const handleDeleteFeedback = (feedbackId: string) => {
        setFeedbackItems((prev) => prev.filter((item) => item.id !== feedbackId));
        toast({
          title: 'Feedback Deleted',
          description: 'The feedback item has been successfully removed.',
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>User Submissions</CardTitle>
                <CardDescription>Review all user-submitted feedback and bug reports.</CardDescription>
            </CardHeader>
            <CardContent className="flex-grow overflow-hidden">
                <ScrollArea className="h-[60vh] pr-4">
                    {feedbackItems.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                        <p>No feedback submitted yet.</p>
                    </div>
                    ) : (
                    <div className="space-y-4">
                        {feedbackItems.map((item) => (
                        <Card key={item.id} className="bg-muted/30 flex flex-col">
                            <CardHeader>
                            <CardTitle className="text-base">{item.name}</CardTitle>
                            <CardDescription>{new Date(parseInt(item.id)).toLocaleString()}</CardDescription>
                            </CardHeader>
                            <CardContent className="flex-grow">
                            <p className="text-sm whitespace-pre-wrap">{item.description}</p>
                            {item.images.length > 0 && (
                                <>
                                <Separator className="my-4" />
                                <p className="text-sm font-medium mb-2">Attachments:</p>
                                <div className="flex flex-wrap gap-2">
                                    {item.images.map((image, index) => (
                                    <a key={index} href={image.url} target="_blank" rel="noopener noreferrer">
                                        <Image
                                        src={image.url}
                                        alt={image.name}
                                        width={80}
                                        height={80}
                                        className="rounded-md object-cover h-20 w-20 border hover:opacity-80 transition-opacity"
                                        />
                                    </a>
                                    ))}
                                </div>
                                </>
                            )}
                            </CardContent>
                            <CardFooter className="justify-end p-4 pt-0">
                            <Button variant="destructive" size="sm" onClick={() => openDeleteConfirmation(() => handleDeleteFeedback(item.id))}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                            </Button>
                            </CardFooter>
                        </Card>
                        ))}
                    </div>
                    )}
                </ScrollArea>
            </CardContent>
        </Card>
    )
}

const passwordFormSchema = z.object({
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
});


function FacultyAccountManager() {
    const { faculty, updateFacultyPassword } = useTimetable();
    const { toast } = useToast();
    const [editingFaculty, setEditingFaculty] = React.useState<Faculty | null>(null);
    const form = useForm<z.infer<typeof passwordFormSchema>>({
        resolver: zodResolver(passwordFormSchema),
        defaultValues: { password: "", confirmPassword: "" },
    });
    
    const handleOpenDialog = (facultyMember: Faculty) => {
        setEditingFaculty(facultyMember);
        form.reset();
    };

    const handleCloseDialog = () => {
        setEditingFaculty(null);
    };
    
    function onSubmit(values: z.infer<typeof passwordFormSchema>) {
        if (editingFaculty) {
            updateFacultyPassword(editingFaculty.id, values.password);
            toast({ title: 'Password Updated', description: `Password for ${editingFaculty.name} has been updated.` });
            handleCloseDialog();
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Faculty Account Management</CardTitle>
                <CardDescription>View current passwords and manage accounts for faculty members.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Name</TableHead>
                            <TableHead>Current Password</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {faculty.map((item) => (
                            <TableRow key={item.id}>
                                <TableCell>{item.name}</TableCell>
                                <TableCell className="font-mono text-sm">{item.password}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="outline" size="sm" onClick={() => handleOpenDialog(item)}>
                                        <KeyRound className="mr-2 h-4 w-4" />
                                        Change Password
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
             <Dialog open={!!editingFaculty} onOpenChange={(open) => !open && handleCloseDialog()}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Change Password for {editingFaculty?.name}</DialogTitle>
                        <DialogDescription>Enter a new password below. The faculty member will need this to log in.</DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                            <FormField
                                control={form.control}
                                name="password"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>New Password</FormLabel>
                                        <FormControl><Input type="password" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="confirmPassword"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Confirm New Password</FormLabel>
                                        <FormControl><Input type="password" {...field} /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={handleCloseDialog}>Cancel</Button>
                                <Button type="submit">Update Password</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </Card>
    );
}


function AddFacultyForm({ onAdd }: { onAdd: (data: Omit<Faculty, 'id' | 'courses' | 'password'>) => void; }) {
  const [open, setOpen] = React.useState(false);
  const form = useForm<z.infer<typeof facultyFormSchema>>({
    resolver: zodResolver(facultyFormSchema),
    defaultValues: { name: "" },
  });

  function onSubmit(values: z.infer<typeof facultyFormSchema>) {
    onAdd({
      name: values.name
    });
    form.reset();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4"/>Add Faculty</Button></DialogTrigger>
      <DialogContent><DialogHeader><DialogTitle>Add New Faculty</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Faculty Name</FormLabel><FormControl><Input placeholder="e.g. Dr. Alan Turing" {...field} /></FormControl><FormMessage /></FormItem> )}/>
            <DialogFooter><Button type="submit">Add Faculty</Button></DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

function AddBasketForm({ onAdd }: { onAdd: (data: Omit<Basket, 'id'>) => void; }) {
  const [open, setOpen] = React.useState(false);
  const form = useForm<z.infer<typeof basketFormSchema>>({
    resolver: zodResolver(basketFormSchema),
    defaultValues: { name: "", code: "" },
  });

  function onSubmit(values: z.infer<typeof basketFormSchema>) {
    onAdd(values);
    form.reset();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><PlusCircle className="mr-2 h-4 w-4"/>Add Basket</Button></DialogTrigger>
      <DialogContent><DialogHeader><DialogTitle>Add New Basket</DialogTitle></DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Basket Name</FormLabel><FormControl><Input placeholder="e.g. Open Elective 1" {...field} /></FormControl><FormMessage /></FormItem> )}/>
            <FormField control={form.control} name="code" render={({ field }) => ( <FormItem><FormLabel>Basket Code</FormLabel><FormControl><Input placeholder="e.g. OE1" {...field} /></FormControl><FormMessage /></FormItem> )}/>
            <DialogFooter><Button type="submit">Add Basket</Button></DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}


function CourseFormDialog({ 
  open, 
  onOpenChange, 
  onAdd, 
  onUpdate, 
  faculty, 
  baskets,
  courseToEdit,
  semesterSettings
}: { 
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (data: z.infer<typeof courseFormSchema>) => void;
  onUpdate: (data: z.infer<typeof courseFormSchema>, courseId: string) => void;
  faculty: Faculty[];
  baskets: Basket[];
  courseToEdit: Course | null; 
  semesterSettings: SemesterSettings;
}) {
  const isEditing = !!courseToEdit;
  const [isConfirmCloseOpen, setIsConfirmCloseOpen] = React.useState(false);

  const form = useForm<z.infer<typeof courseFormSchema>>({
    resolver: zodResolver(courseFormSchema),
    defaultValues: {
      name: "",
      code: "",
      enrolledGroups: [{ semester: 1, branch: "CSE", sections: [] }],
      studentCount: 50,
      duration: 'Full',
      classroomHours: 42,
      tutorialHours: 14,
      labHours: 28,
      weeklyClassroomHours: 3,
      weeklyTutorialHours: 1,
      weeklyLabHours: 2,
      startDate: semesterSettings.startDate,
      facultyId: "none",
      basketId: "none",
      requiresHardwareLab: false,
    }
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "enrolledGroups",
  });

  const watchedDuration = useWatch({ control: form.control, name: 'duration' });
  const watchedWeeklyHours = useWatch({ control: form.control, name: ['weeklyClassroomHours', 'weeklyTutorialHours', 'weeklyLabHours'] });

  React.useEffect(() => {
    const [wc, wt, wl] = watchedWeeklyHours;
    const multiplier = watchedDuration === 'Full' ? 14 : 7;
    form.setValue('classroomHours', wc * multiplier);
    form.setValue('tutorialHours', wt * multiplier);
    form.setValue('labHours', wl * multiplier);
  }, [watchedDuration, watchedWeeklyHours, form.setValue, form]);
  
  const facultyOptions = React.useMemo(() =>
    [{ value: 'none', label: 'None' }, ...faculty.map(f => ({ value: f.id, label: f.name }))]
  , [faculty]);

  const basketOptions = React.useMemo(() =>
    [{ value: 'none', label: 'None' }, ...baskets.map(b => ({ value: b.id, label: `${b.name} (${b.code})` }))]
  , [baskets]);

  const { formState: { isDirty } } = form;

  React.useEffect(() => {
    if (open) {
        if (isEditing && courseToEdit) {
            const assignedFacultyId = faculty.find(f => f.courses.includes(courseToEdit.id))?.id;

            // Group sections back for the form
            const groupedForForm: { semester: number; branch: 'CSE' | 'DSAI' | 'ECE'; sections: string[] }[] = [];
            courseToEdit.enrolledGroups.forEach(group => {
                const existing = groupedForForm.find(g => g.semester === group.semester && g.branch === group.branch);
                if (existing) {
                    if (group.section && !existing.sections.includes(group.section)) {
                        existing.sections.push(group.section);
                    }
                } else {
                    groupedForForm.push({
                        semester: group.semester,
                        branch: group.branch,
                        sections: group.section ? [group.section] : [],
                    });
                }
            });

            form.reset({
                ...courseToEdit,
                enrolledGroups: groupedForForm,
                startDate: courseToEdit.startDate || semesterSettings.startDate,
                facultyId: assignedFacultyId || 'none',
                basketId: courseToEdit.basketId || "none",
                requiresHardwareLab: courseToEdit.requiresHardwareLab || false,
            });
        } else {
            form.reset({
              name: "",
              code: "",
              enrolledGroups: [{ semester: 1, branch: "CSE", sections: [] }],
              studentCount: 50,
              duration: 'Full',
              classroomHours: 42,
              tutorialHours: 14,
              labHours: 28,
              weeklyClassroomHours: 3,
              weeklyTutorialHours: 1,
              weeklyLabHours: 2,
              startDate: semesterSettings.startDate,
              facultyId: "none",
              basketId: "none",
              requiresHardwareLab: false,
            });
        }
    }
  }, [open, isEditing, courseToEdit, form, faculty, semesterSettings, baskets]);
  
  const handleDialogInteraction = React.useCallback((isOpen: boolean) => {
    if (!isOpen && isDirty) {
      setIsConfirmCloseOpen(true);
      return;
    }
    onOpenChange(isOpen);
  }, [isDirty, onOpenChange]);


  function onSubmit(values: z.infer<typeof courseFormSchema>) {
    if (isEditing && courseToEdit) {
      onUpdate(values, courseToEdit.id);
    } else {
      onAdd(values);
    }
    onOpenChange(false);
  }

  const handleSaveChanges = () => {
    form.handleSubmit(onSubmit)();
    setIsConfirmCloseOpen(false);
  };

  const handleDiscardChanges = () => {
    form.reset();
    setIsConfirmCloseOpen(false);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogInteraction}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{isEditing ? 'Edit Course' : 'Add New Course'}</DialogTitle>
            <DialogDescription>
              {isEditing ? 'Update the details for this course.' : 'Enter the details for the new course.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8 pt-4">
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium leading-none text-foreground">Course Details</h3>
                <Separator />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Course Name</FormLabel><FormControl><Input placeholder="e.g. Introduction to Programming" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                  <FormField control={form.control} name="code" render={({ field }) => ( <FormItem><FormLabel>Course Code</FormLabel><FormControl><Input placeholder="e.g. CS101" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="studentCount" render={({ field }) => ( <FormItem><FormLabel>Total Student Count</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormDescription>Total for all groups/sections.</FormDescription><FormMessage /></FormItem> )}/>
                    <FormField
                      control={form.control}
                      name="duration"
                      render={({ field }) => (
                        <FormItem className="space-y-3">
                          <FormLabel>Course Duration</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              defaultValue={field.value}
                              className="flex items-center space-x-4"
                            >
                              <FormItem className="flex items-center space-x-2 space-y-0">
                                <FormControl><RadioGroupItem value="Full" /></FormControl>
                                <FormLabel className="font-normal">Full Sem</FormLabel>
                              </FormItem>
                              <FormItem className="flex items-center space-x-2 space-y-0">
                                <FormControl><RadioGroupItem value="Half-1" /></FormControl>
                                <FormLabel className="font-normal">First Half</FormLabel>
                              </FormItem>
                              <FormItem className="flex items-center space-x-2 space-y-0">
                                <FormControl><RadioGroupItem value="Half-2" /></FormControl>
                                <FormLabel className="font-normal">Second Half</FormLabel>
                              </FormItem>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                </div>
                 <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Course Start Date</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>
                                {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus fromDate={semesterSettings.startDate} toDate={semesterSettings.endDate}/>
                          </PopoverContent>
                        </Popover>
                        <FormDescription>The date this course officially begins.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium leading-none text-foreground">Student Groups</h3>
                <Separator />
                <FormItem>
                  <FormLabel>Enrolled Groups</FormLabel>
                  <FormDescription>
                    Define which student groups are enrolled. For CSE, you can specify sections.
                  </FormDescription>
                  <div className="space-y-3 rounded-lg border p-4">
                    {fields.map((field, index) => (
                      <div key={field.id} className="space-y-2">
                        <div className="flex items-end gap-2">
                          <FormField
                            control={form.control}
                            name={`enrolledGroups.${index}.semester`}
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                {index === 0 && <FormLabel>Semester</FormLabel>}
                                <Select onValueChange={(val) => field.onChange(parseInt(val))} defaultValue={String(field.value)}>
                                  <FormControl>
                                    <SelectTrigger><SelectValue placeholder="Semester" /></SelectTrigger>
                                  </FormControl>
                                  <SelectContent>{semesters.map(s => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}</SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`enrolledGroups.${index}.branch`}
                            render={({ field }) => (
                              <FormItem className="flex-1">
                                {index === 0 && <FormLabel>Branch</FormLabel>}
                                <Select onValueChange={(val) => { field.onChange(val); form.setValue(`enrolledGroups.${index}.sections`, []); }} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger><SelectValue placeholder="Branch" /></SelectTrigger>
                                  </FormControl>
                                  <SelectContent>{branches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <Button type="button" variant="destructive" size="icon" disabled={fields.length <= 1} onClick={() => remove(index)}>
                            <MinusCircle className="h-4 w-4" />
                          </Button>
                        </div>
                        
                        {form.watch(`enrolledGroups.${index}.branch`) === 'CSE' && (
                           <FormField
                              control={form.control}
                              name={`enrolledGroups.${index}.sections`}
                              render={() => (
                                <FormItem className="pl-1 pt-2">
                                  <FormLabel className="text-xs">Sections</FormLabel>
                                  <FormDescription className="text-xs">Select sections to divide the branch.</FormDescription>
                                  <div className="flex items-center space-x-4 pt-1">
                                    {sections.map((section) => (
                                      <FormField
                                        key={section}
                                        control={form.control}
                                        name={`enrolledGroups.${index}.sections`}
                                        render={({ field }) => {
                                          return (
                                            <FormItem key={section} className="flex flex-row items-start space-x-2 space-y-0">
                                              <FormControl>
                                                <Checkbox
                                                  checked={field.value?.includes(section)}
                                                  onCheckedChange={(checked) => {
                                                    return checked
                                                      ? field.onChange([...(field.value || []), section])
                                                      : field.onChange(field.value?.filter((value) => value !== section));
                                                  }}
                                                />
                                              </FormControl>
                                              <FormLabel className="font-normal">Section {section}</FormLabel>
                                            </FormItem>
                                          );
                                        }}
                                      />
                                    ))}
                                  </div>
                                </FormItem>
                              )}
                            />
                        )}
                      </div>
                    ))}
                    <Button type="button" variant="outline" size="sm" onClick={() => append({ semester: 1, branch: "CSE", sections: [] })}>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Add Group
                    </Button>
                  </div>
                   <FormMessage>{form.formState.errors.enrolledGroups?.message}</FormMessage>
                </FormItem>
              </div>

              <div className="space-y-4">
                  <h3 className="text-lg font-medium leading-none text-foreground">Hour Allocation</h3>
                  <Separator />
                   <div className="p-4 border rounded-lg bg-muted/20">
                      <FormLabel>Weekly Target Hours</FormLabel>
                      <FormDescription className="mb-4">The number of hours to be scheduled each week.</FormDescription>
                      <div className="grid grid-cols-3 gap-4">
                          <FormField control={form.control} name="weeklyClassroomHours" render={({ field }) => ( <FormItem><FormLabel className="text-xs text-muted-foreground">Classroom</FormLabel><FormControl><Input type="number" placeholder="e.g. 3" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                          <FormField control={form.control} name="weeklyTutorialHours" render={({ field }) => ( <FormItem><FormLabel className="text-xs text-muted-foreground">Tutorial</FormLabel><FormControl><Input type="number" placeholder="e.g. 1" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                          <FormField control={form.control} name="weeklyLabHours" render={({ field }) => ( <FormItem><FormLabel className="text-xs text-muted-foreground">Lab</FormLabel><FormControl><Input type="number" step="2" placeholder="e.g. 2" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                      </div>
                  </div>
                  <div className="p-4 border rounded-lg bg-muted/20">
                      <FormLabel>Total Semester Hours</FormLabel>
                      <FormDescription className="mb-4">Auto-calculated from weekly hours and duration. Can be overridden.</FormDescription>
                      <div className="grid grid-cols-3 gap-4">
                          <FormField control={form.control} name="classroomHours" render={({ field }) => ( <FormItem><FormLabel className="text-xs text-muted-foreground">Classroom</FormLabel><FormControl><Input type="number" placeholder="e.g. 45" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                          <FormField control={form.control} name="tutorialHours" render={({ field }) => ( <FormItem><FormLabel className="text-xs text-muted-foreground">Tutorial</FormLabel><FormControl><Input type="number" placeholder="e.g. 15" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                          <FormField control={form.control} name="labHours" render={({ field }) => ( <FormItem><FormLabel className="text-xs text-muted-foreground">Lab</FormLabel><FormControl><Input type="number" step="2" placeholder="e.g. 30" {...field} /></FormControl><FormMessage /></FormItem> )}/>
                      </div>
                  </div>
              </div>
              
              <div className="space-y-4">
                <h3 className="text-lg font-medium leading-none text-foreground">Staff & Basket Assignment</h3>
                <Separator />
                 <FormField control={form.control} name="facultyId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assign Faculty</FormLabel>
                     <FormControl>
                          <Combobox options={facultyOptions} value={field.value} onValueChange={field.onChange} placeholder="Select a faculty to assign" searchPlaceholder="Search faculty..." emptyResultText="No faculty found." />
                     </FormControl>
                     <FormDescription>Instructor for lectures, tutorials, and labs.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}/>
                 <FormField
                  control={form.control}
                  name="requiresHardwareLab"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-muted/20">
                      <div className="space-y-0.5">
                        <FormLabel>Requires Hardware Lab</FormLabel>
                        <FormDescription>
                          Does this course require a specialized hardware lab facility?
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField control={form.control} name="basketId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assign Elective Basket</FormLabel>
                      <FormControl>
                          <Combobox options={basketOptions} value={field.value} onValueChange={field.onChange} placeholder="Select a basket" searchPlaceholder="Search baskets..." emptyResultText="No baskets found." />
                      </FormControl>
                      <FormDescription>Assigning a basket allows electives to be scheduled in parallel if needed.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}/>
              </div>
              
              <DialogFooter>
                <Button type="submit">{isEditing ? 'Save Changes' : 'Add Course'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={isConfirmCloseOpen} onOpenChange={setIsConfirmCloseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Would you like to save them before closing?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="ghost" onClick={() => setIsConfirmCloseOpen(false)}>Keep Editing</Button>
            <Button variant="outline" onClick={handleDiscardChanges}>
              Discard Changes
            </Button>
            <AlertDialogAction onClick={handleSaveChanges}>
              Save and Close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function RoomFormDialog({ 
  open, 
  onOpenChange, 
  onAdd, 
  onUpdate, 
  roomToEdit 
}: { 
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (data: z.infer<typeof roomFormSchema>) => void;
  onUpdate: (data: z.infer<typeof roomFormSchema>, roomId: string) => void;
  roomToEdit: Room | null; 
}) {
  const isEditing = !!roomToEdit;
  const form = useForm<z.infer<typeof roomFormSchema>>({
    resolver: zodResolver(roomFormSchema),
  });

  React.useEffect(() => {
    if (open) {
      if (isEditing && roomToEdit) {
        form.reset(roomToEdit);
      } else {
        form.reset({ name: "", type: "Classroom", capacity: 60 });
      }
    }
  }, [open, isEditing, roomToEdit, form]);

  function onSubmit(values: z.infer<typeof roomFormSchema>) {
    if (isEditing && roomToEdit) {
      onUpdate(values, roomToEdit.id);
    } else {
      onAdd(values);
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Room' : 'Add New Room'}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => ( <FormItem><FormLabel>Room Name/No.</FormLabel><FormControl><Input placeholder="e.g. CR101 or Lab202" {...field} /></FormControl><FormMessage /></FormItem> )}/>
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="type" render={({ field }) => ( <FormItem><FormLabel>Type</FormLabel><Select onValueChange={field.onChange} value={field.value}><FormControl><SelectTrigger><SelectValue placeholder="Select Type" /></SelectTrigger></FormControl><SelectContent><SelectItem value="Classroom">Classroom</SelectItem><SelectItem value="Software Lab">Software Lab</SelectItem><SelectItem value="Hardware Lab">Hardware Lab</SelectItem></SelectContent></Select><FormMessage /></FormItem> )}/>
              <FormField control={form.control} name="capacity" render={({ field }) => ( <FormItem><FormLabel>Capacity</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem> )}/>
            </div>
            <DialogFooter>
              <Button type="submit">{isEditing ? 'Save Changes' : 'Add Room'}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}


function AddHolidayForm({ 
  setLongHolidayState,
}: { 
  setLongHolidayState: (details: any) => void;
}) {
  const { semesterSettings, timetable, setHolidays, courses } = useTimetable();
  const { toast } = useToast();
  const form = useForm<z.infer<typeof holidayFormSchema>>({
    resolver: zodResolver(holidayFormSchema),
    defaultValues: {
      name: "",
      dateRange: { from: undefined, to: undefined },
      scope: 'all_except_first_sem',
    },
  });

  function onSubmit(values: z.infer<typeof holidayFormSchema>) {
    if (!values.dateRange.from) return;
    
    const holidayData = {
        name: values.name,
        scope: values.scope,
        dateRange: { 
            from: values.dateRange.from, 
            to: values.dateRange.to || values.dateRange.from 
        }
    };

    const allDates = eachDayOfInterval({ start: holidayData.dateRange.from, end: holidayData.dateRange.to });
    const holidayDuration = differenceInCalendarDays(holidayData.dateRange.to, holidayData.dateRange.from) + 1;

    const classesToCancel: (TimetableEntry & { timeSlot: string; date: Date })[] = [];

    allDates.forEach(day => {
        const dayOfWeek = getDay(day);
        if (dayOfWeek > 0 && dayOfWeek < 6) { // Monday to Friday
            const dateStr = format(day, 'yyyy-MM-dd');
            const daySchedule = timetable[dateStr];
            if (daySchedule) {
                timeSlots.forEach(slot => {
                    (daySchedule[slot] || []).forEach(entry => {
                        const course = courses.find(c => c.id === entry.courseId);
                        if (!course) return;

                        // Check if the class should be cancelled based on holiday scope
                        const isFirstSemCourse = course.enrolledGroups.some(g => g.semester === 1);
                        if (holidayData.scope === 'all_except_first_sem' && isFirstSemCourse) {
                            return; // Don't cancel this class
                        }
                        if (holidayData.scope === 'only_first_sem' && !isFirstSemCourse) {
                            return; // Don't cancel this class
                        }

                        classesToCancel.push({ ...entry, timeSlot: slot, date: day });
                    });
                });
            }
        }
    });

    const uniqueClasses = Array.from(new Map(classesToCancel.map(cls => [`${cls.courseId}-${cls.type}-${cls.timeSlot}-${format(cls.date, 'yyyy-MM-dd')}`, cls])).values());
    
    if (uniqueClasses.length === 0) {
      toast({ title: "No Classes Affected", description: "This holiday does not affect any scheduled classes." });
      setHolidays(prev => [...prev, { id: `h-${Date.now()}`, ...holidayData }]);
      form.reset({ name: "", dateRange: { from: undefined, to: undefined } });
      return;
    }

    setLongHolidayState({
      holidayData,
      allAffectedClasses: uniqueClasses,
    });
    
    form.reset({ name: "", dateRange: { from: undefined, to: undefined }, scope: 'all_except_first_sem' });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Declare a Holiday</CardTitle>
        <CardDescription>Select a date or range and give it a name to declare a holiday.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Holiday Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Winter Break" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dateRange"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date(s)</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn("w-full pl-3 text-left font-normal", !field.value?.from && "text-muted-foreground")}
                        >
                          {field.value?.from ? (
                            field.value.to ? (
                                <>{format(field.value.from, "LLL dd, y")} - {format(field.value.to, "LLL dd, y")}</>
                            ) : (
                                format(field.value.from, "LLL dd, y")
                            )
                          ) : (
                            <span>Pick a date or range</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="range"
                        selected={field.value}
                        onSelect={field.onChange}
                        initialFocus
                        fromDate={semesterSettings.startDate}
                        toDate={semesterSettings.endDate}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="scope"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Holiday Scope</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="flex flex-col space-y-1"
                    >
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="all_except_first_sem" />
                        </FormControl>
                        <FormLabel className="font-normal">
                          All Semesters EXCEPT the 1st
                        </FormLabel>
                      </FormItem>
                      <FormItem className="flex items-center space-x-3 space-y-0">
                        <FormControl>
                          <RadioGroupItem value="only_first_sem" />
                        </FormControl>
                        <FormLabel className="font-normal">
                          Only First Semester
                        </FormLabel>
                      </FormItem>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end">
              <Button type="submit">Declare Holiday</Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

function MassRescheduleDialog({ 
  isOpen, 
  onClose, 
  details, 
  onConfirm,
  rooms,
  roomMap,
} : {
  isOpen: boolean;
  onClose: () => void;
  details: {
    reason: 'FacultyLeave' | 'Holiday' | 'SlotCancellation';
    triggeringData: any;
    classes: (TimetableEntry & { timeSlot: string; date: Date })[];
  } | null;
  onConfirm: (
    rescheduledData: { 
      makeupDate: Date, 
      makeupTimeSlot: string, 
      makeupRoomName: string, 
      originalClass: TimetableEntry & { timeSlot: string; date: Date } 
    }[]
  ) => void;
  rooms: Room[];
  roomMap: Record<string, Room>;
}) {
  const { courseMap, semesterSettings, facultyMap } = useTimetable();
  const { toast } = useToast();
  const roomOptions = React.useMemo(() => rooms.map(r => ({ value: r.name, label: `${r.name} (${r.type}, Cap: ${r.capacity})` })), [rooms]);
  
  const [quickRescheduleDates, setQuickRescheduleDates] = React.useState<Record<string, Date | undefined>>({});

  const form = useForm<z.infer<typeof massRescheduleSchema>>({
    resolver: zodResolver(massRescheduleSchema),
    defaultValues: {
      reschedules: []
    }
  });

  const { control, setValue, getValues } = form;

  const { fields } = useFieldArray({
    control,
    name: "reschedules",
  });
  
  const groupedClasses = React.useMemo(() => {
    if (!details) return {};
    return details.classes.reduce((acc, cls) => {
      const dateStr = format(cls.date, 'yyyy-MM-dd');
      if (!acc[dateStr]) {
        acc[dateStr] = [];
      }
      acc[dateStr].push(cls);
      return acc;
    }, {} as Record<string, (TimetableEntry & { timeSlot: string; date: Date })[]>);
  }, [details]);
  
  const handleQuickRescheduleForGroup = (dateStr: string) => {
    const quickDate = quickRescheduleDates[dateStr];
    if (!quickDate) {
        toast({
            variant: "destructive",
            title: "No Date Selected",
            description: "Please select a weekend date for this group of classes.",
        });
        return;
    }
    
    getValues().reschedules.forEach((field, index) => {
        if (format(field.originalClass.date, 'yyyy-MM-dd') === dateStr) {
            const originalClass = field.originalClass;
            const originalRoom = roomMap[originalClass.roomId];

            setValue(`reschedules.${index}.makeupDate`, quickDate, { shouldDirty: true });
            setValue(`reschedules.${index}.makeupTimeSlot`, originalClass.timeSlot, { shouldDirty: true });
            if(originalRoom) {
                setValue(`reschedules.${index}.makeupRoomName`, originalRoom.name, { shouldDirty: true });
            }
        }
    });

    toast({
        title: "Dates Updated",
        description: `Classes from ${format(new Date(dateStr), "PPP")} are set to be rescheduled on ${format(quickDate, "PPP")}.`,
    });
  };

  React.useEffect(() => {
    if (isOpen && details) {
        const classesToDisplay = details.classes;

        form.reset({
            reschedules: classesToDisplay.map(c => ({
            originalClass: c,
            makeupDate: undefined,
            makeupTimeSlot: undefined,
            makeupRoomName: undefined,
            }))
        });
        setQuickRescheduleDates({});
    }
  }, [isOpen, details, form]);

  if (!isOpen || !details) return null;
  
  const handleFormSubmit = (values: z.infer<typeof massRescheduleSchema>) => {
    onConfirm(values.reschedules.map((r, i) => ({
      ...r,
      originalClass: (fields[i] as any).originalClass,
    })));
  };
  
  const getStaffName = () => {
    if (details.reason === 'FacultyLeave') return facultyMap[details.triggeringData.facultyId]?.name;
    return null;
  };
  
  const getDateRangeText = () => {
      const dateSource = details.triggeringData.dateRange || details.triggeringData;

      if (dateSource) {
          const from = dateSource.from || dateSource.date;
          const to = dateSource.to;
          if (from instanceof Date && to instanceof Date && from.getTime() !== to.getTime()) return `from ${format(from, "PPP")} to ${format(to, "PPP")}`;
          if (from instanceof Date) return `on ${format(from, "PPP")}`;
      }
      return '';
  }

  const titleMap = {
    FacultyLeave: `Reschedule for ${getStaffName()}'s Leave`,
    Holiday: `Reschedule for Holiday`,
    SlotCancellation: `Reschedule Cancelled Slot`,
  };
  
  const descriptionMap = {
      FacultyLeave: `${getStaffName()} has been granted leave ${getDateRangeText()}. Please reschedule their classes.`,
      Holiday: `The holiday "${details.triggeringData.name}" (${getDateRangeText()}) affects scheduled classes. Please reschedule all affected classes.`,
      SlotCancellation: `The slot at ${details.triggeringData.timeSlot} on ${details.triggeringData.date instanceof Date ? format(details.triggeringData.date, "PPP") : ''} has been cancelled. Please reschedule the affected classes.`,
  };
  
  const holidayDate = details.reason === 'Holiday' ? details.triggeringData.dateRange.from : new Date();
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center"><Redo className="mr-2"/>{titleMap[details.reason] || 'Reschedule Classes'}</DialogTitle>
          <DialogDescription>
            {descriptionMap[details.reason] || 'Please reschedule the following classes to a weekend to meet weekly targets.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="flex-grow overflow-hidden">
            <ScrollArea className="h-full pr-4">
              <Accordion type="multiple" className="w-full space-y-4">
                {Object.entries(groupedClasses).map(([dateStr, classesInGroup]) => (
                  <AccordionItem key={dateStr} value={dateStr}>
                    <AccordionTrigger>
                      {`${classesInGroup.length} classes from ${format(new Date(dateStr), 'EEEE, PPP')}`}
                    </AccordionTrigger>
                    <AccordionContent>
                       <div className="space-y-6">
                        <Card className="bg-muted/50">
                          <CardHeader className="py-4">
                              <CardTitle className="text-base">Quick Reschedule</CardTitle>
                              <CardDescription className="text-xs">
                              Apply a new weekend date to all classes from this day.
                              </CardDescription>
                          </CardHeader>
                          <CardContent className="flex flex-col sm:flex-row items-center gap-4">
                              <Popover>
                                  <PopoverTrigger asChild>
                                      <Button variant={"outline"} className={cn("w-full sm:w-[280px] justify-start text-left font-normal", !quickRescheduleDates[dateStr] && "text-muted-foreground")}>
                                          <CalendarIcon className="mr-2 h-4 w-4" />
                                          {quickRescheduleDates[dateStr] ? format(quickRescheduleDates[dateStr]!, "PPP") : <span>Pick a weekend date</span>}
                                      </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="start">
                                      <Calendar 
                                          mode="single" 
                                          selected={quickRescheduleDates[dateStr]} 
                                          onSelect={(date) => setQuickRescheduleDates(prev => ({ ...prev, [dateStr]: date }))}
                                          fromDate={holidayDate}
                                          toDate={semesterSettings.endDate}
                                          disabled={(date) => (getDay(date) > 0 && getDay(date) < 6) || date < holidayDate}
                                          numberOfMonths={1}
                                      />
                                  </PopoverContent>
                              </Popover>
                              <Button type="button" onClick={() => handleQuickRescheduleForGroup(dateStr)} className="w-full sm:w-auto">
                                  Apply to all from this day
                              </Button>
                          </CardContent>
                        </Card>
                         <div className="space-y-4">
                              {fields.map((field, index) => {
                                const originalClass = (field as any).originalClass as TimetableEntry & { timeSlot: string; date: Date };
                                if (format(originalClass.date, 'yyyy-MM-dd') !== dateStr) return null;

                                const course = courseMap[originalClass.courseId];
                                return (
                                  <Card key={field.id} className="bg-background">
                                    <CardHeader className="py-3">
                                      <CardTitle className="text-base">
                                        {course?.name} ({course?.code})
                                      </CardTitle>
                                      <CardDescription>
                                        Original Slot: {format(originalClass.date, 'PPP')} at {originalClass.timeSlot}
                                      </CardDescription>
                                    </CardHeader>
                                    <CardContent className="p-4 pt-0 space-y-4">
                                      <FormField
                                          control={form.control}
                                          name={`reschedules.${index}.makeupDate`}
                                          render={({ field }) => (
                                              <FormItem className="flex flex-col">
                                                  <FormLabel>Makeup Date (Weekend)</FormLabel>
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
                                                              fromDate={semesterSettings.startDate} 
                                                              toDate={semesterSettings.endDate}
                                                              disabled={(date) => getDay(date) > 0 && getDay(date) < 6}
                                                              numberOfMonths={1}
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
                                            name={`reschedules.${index}.makeupTimeSlot`}
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
                                            name={`reschedules.${index}.makeupRoomName`}
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
                                    </CardContent>
                                  </Card>
                                )
                              })}
                         </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </ScrollArea>
          </form>
        </Form>
        <DialogFooter className="pt-4 border-t">
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" onClick={form.handleSubmit(handleFormSubmit)}>Confirm Rescheduling</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


function LongHolidayManagerDialog({ 
  isOpen, 
  state,
  onClose,
  setClassesToMassReschedule,
  setCancellations,
  addHoliday,
  toast,
}: {
  isOpen: boolean;
  state: {
    holidayData: Omit<Holiday, 'id'>;
    allAffectedClasses: (TimetableEntry & { timeSlot: string; date: Date })[];
  } | null;
  onClose: () => void;
  setClassesToMassReschedule: (details: any) => void;
  setCancellations: React.Dispatch<React.SetStateAction<Cancellation[]>>;
  addHoliday: (data: Omit<Holiday, 'id'>) => void;
  toast: any;
}) {
  const [selectedDates, setSelectedDates] = React.useState<Date[]>([]);
  const [remainingClassAction, setRemainingClassAction] = React.useState<'Postponed' | 'Cancelled'>('Postponed');

  if (!isOpen || !state) return null;
  
  const { holidayData, allAffectedClasses } = state;
  const allHolidayDates = eachDayOfInterval({ start: holidayData.dateRange.from, end: holidayData.dateRange.to || holidayData.dateRange.from });

  const handleDaySelect = (day: Date) => {
    setSelectedDates(prev => {
      if (prev.some(d => d.getTime() === day.getTime())) {
        return prev.filter(d => d.getTime() !== day.getTime());
      }
      if (prev.length < 2) {
        return [...prev, day];
      }
      return prev;
    });
  };

  const handleConfirm = () => {
    const selectedDateStrings = new Set(selectedDates.map(d => format(d, 'yyyy-MM-dd')));
    const classesToReschedule = allAffectedClasses.filter(c => selectedDateStrings.has(format(c.date, 'yyyy-MM-dd')));
    const classesToHandleOtherwise = allAffectedClasses.filter(c => !selectedDateStrings.has(format(c.date, 'yyyy-MM-dd')));

    // Handle the classes that are not being rescheduled
    if (classesToHandleOtherwise.length > 0) {
        // Create permanent cancellation records if the user chooses to cancel
        if (remainingClassAction === 'Cancelled') {
            const newCancellations: Cancellation[] = classesToHandleOtherwise.map(c => ({
                id: `cancel-holiday-${c.courseId}-${c.date.getTime()}-${Math.random()}`,
                date: c.date,
                timeSlot: c.timeSlot,
                reason: `Holiday: ${holidayData.name}`,
                status: 'Cancelled',
                cancelledClasses: [{ courseId: c.courseId, classType: c.type }],
            }));
            setCancellations(prev => [...prev, ...newCancellations]);
        }
        
        toast({
            title: `Classes Handled`,
            description: `${classesToHandleOtherwise.length} classes have been marked as ${remainingClassAction.toLowerCase()}.`,
        });
    }

    // If there are classes to reschedule, open the next dialog
    if (classesToReschedule.length > 0) {
        setClassesToMassReschedule({
            reason: 'Holiday',
            triggeringData: holidayData,
            classes: classesToReschedule,
        });
    }
    
    // Add the holiday regardless of rescheduling
    addHoliday(holidayData);
    onClose();
  };
  
  const remainingDaysCount = allHolidayDates.length - selectedDates.length;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Long Holiday Detected</DialogTitle>
          <DialogDescription>
            The holiday "{holidayData.name}" is for {allHolidayDates.length} days.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4 space-y-6">
          <div className="space-y-2">
            <Label>1. Select up to 2 days to reschedule</Label>
            <p className="text-sm text-muted-foreground">
              Classes from the selected days will be moved to a weekend.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
              {allHolidayDates.map(day => (
                <Button
                  key={day.toISOString()}
                  variant={selectedDates.some(d => d.getTime() === day.getTime()) ? 'default' : 'outline'}
                  onClick={() => handleDaySelect(day)}
                  disabled={selectedDates.length >= 2 && !selectedDates.some(d => d.getTime() === day.getTime())}
                >
                  {format(day, "MMM d")}
                </Button>
              ))}
            </div>
          </div>
          <Separator />
          <div className="space-y-2">
            <Label>2. Handle classes on unselected days</Label>
             <p className="text-sm text-muted-foreground">
                Choose what to do with classes on the other {remainingDaysCount} holiday day(s).
            </p>
            <RadioGroup
              value={remainingClassAction}
              onValueChange={(value: 'Postponed' | 'Cancelled') => setRemainingClassAction(value)}
              className="pt-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Postponed" id="postpone" />
                <Label htmlFor="postpone">Postpone to End of Semester</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="Cancelled" id="cancel" />
                <Label htmlFor="cancel">Cancel Permanently</Label>
              </div>
            </RadioGroup>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm}>Declare Holiday & Continue</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const conflictResolutionSchema = z.object({
  day: z.string({ required_error: "A day is required." }),
  timeSlot: z.enum(timeSlots, { required_error: "A time slot is required." }),
  startDate: z.date({ required_error: "A start date is required." }),
  roomName: z.string().min(1, 'Room is required.'),
  recurrence: z.enum(['once', 'weekly']),
});

function ConflictResolutionManager() {
    const { conflicts, courses, rooms, semesterSettings, setExtraClasses, facultyMap, examSchedules } = useTimetable();
    const { toast } = useToast();
    const form = useForm<z.infer<typeof conflictResolutionSchema>>();

    const resolvableConflicts = React.useMemo(() => 
        conflicts.filter(c => 
            (c.type === 'Semester Hour Shortage') ||
            (c.type === 'Scheduling Period Violation' && c.description.includes('after the mid-semester'))
        ),
    [conflicts]);
    
    const dayOptions = React.useMemo(() => daysOfWeek
      .filter(d => d !== 'Saturday' && d !== 'Sunday')
      .map(d => ({ value: d, label: d })), []);

    function onSubmit(values: z.infer<typeof conflictResolutionSchema>, conflict: TimetableConflict) {
        const { day, startDate, roomName, recurrence, timeSlot } = values;
        
        const isLab = conflict.details.type === 'Lab';
        const duration = isLab ? 2 : 1;

        let deficit, courseId, endDateLimit: Date | undefined;

        if (conflict.type === 'Scheduling Period Violation') {
            deficit = Math.ceil(conflict.details.violationHours);
            courseId = conflict.details.courseId;
            const course = courses.find(c => c.id === courseId);
            if (course) {
                const group = course.enrolledGroups[0];
                const examSchedule = examSchedules.find(es => es.semester === group.semester && es.branch === group.branch);
                if (examSchedule) {
                    endDateLimit = examSchedule.midSemDate;
                }
            }
        } else { // Semester Hour Shortage
            deficit = conflict.details.deficit;
            courseId = conflict.details.courseId;
        }

        const course = courses.find(c => c.id === courseId);
        if (!course) return;

        const facultyId = Object.values(facultyMap).find(f => f.courses.includes(courseId))?.id;

        const dayIndex = daysOfWeek.indexOf(day);
        
        let currentDate = nextDay(startDate, dayIndex as any);
        if (getDay(startDate) === dayIndex) {
            currentDate = startDate;
        }

        const newMakeupClasses: ExtraClass[] = [];
        let remainingDeficit = deficit;
        
        const semesterEndDate = endDateLimit || semesterSettings.endDate;

        while (remainingDeficit > 0 && isWithinInterval(currentDate, { start: semesterSettings.startDate, end: semesterEndDate })) {
            newMakeupClasses.push({
                id: `makeup-${courseId}-${currentDate.getTime()}-${timeSlot}`,
                courseId,
                facultyId,
                date: currentDate,
                timeSlot: timeSlot,
                roomName,
                reason: 'Conflict Resolution', // Tagging as makeup class
            });

            remainingDeficit -= duration;
            if (recurrence === 'once') break;
            currentDate = addDays(currentDate, 7);
        }

        setExtraClasses(prev => [...prev, ...newMakeupClasses]);
        toast({
            title: 'Makeup Classes Scheduled',
            description: `${newMakeupClasses.length} makeup class(es) for ${course.code} have been added to the schedule.`,
        });
        form.reset();
    }
    
    const getRoomOptionsForConflict = (conflict: TimetableConflict) => {
        const course = courses.find(c => c.id === conflict.details.courseId);
        if (!course) return [];
        
        if (conflict.details.type === 'Lab') {
            const labType = course.requiresHardwareLab ? 'Hardware Lab' : 'Software Lab';
            return rooms.filter(r => r.type === labType)
                        .map(r => ({ value: r.name, label: `${r.name} (${r.type}, Cap: ${r.capacity})` }));
        }
        
        return rooms.filter(r => r.type === 'Classroom')
                    .map(r => ({ value: r.name, label: `${r.name} (Cap: ${r.capacity})` }));
    };

    const getTimeSlotOptionsForConflict = (conflict: TimetableConflict) => {
        if (conflict.details.type === 'Lab') {
            // Labs are 2 hours, so they can't start in the last slot of a session.
            return timeSlots
                .filter(slot => slot !== '11:00-12:00' && slot !== '15:30-16:30' && slot !== '18:00-19:00')
                .map(t => ({ value: t, label: t }));
        }
        return timeSlots.map(t => ({ value: t, label: t }));
    };

    if (resolvableConflicts.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Conflict Resolution</CardTitle>
                    <CardDescription>Manually schedule makeup classes to resolve semester hour shortages or period violations.</CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">No resolvable conflicts found.</p>
                </CardContent>
            </Card>
        );
    }
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>Conflict Resolution</CardTitle>
                <CardDescription>Manually schedule makeup classes to resolve semester hour shortages or period violations.</CardDescription>
            </CardHeader>
            <CardContent>
                <Accordion type="single" collapsible className="w-full">
                    {resolvableConflicts.map(conflict => {
                         const course = courses.find(c => c.id === conflict.details.courseId);
                         return (
                            <AccordionItem key={conflict.details.courseId + conflict.description} value={conflict.details.courseId + conflict.description}>
                                <AccordionTrigger>
                                    <div className="flex flex-col items-start text-left">
                                        <p>{course?.name} ({course?.code})</p>
                                        <p className="text-sm font-normal text-destructive">{conflict.description}</p>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                    <Form {...form}>
                                        <form onSubmit={form.handleSubmit((data) => onSubmit(data, conflict))} className="space-y-4 rounded-lg border bg-background p-4">
                                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                                <FormField
                                                    control={form.control}
                                                    name="day"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Day of Week</FormLabel>
                                                            <Combobox options={dayOptions} value={field.value} onValueChange={field.onChange} placeholder="Select Day" />
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="startDate"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Start From</FormLabel>
                                                            <Popover>
                                                                <PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full pl-3 text-left font-normal", !field.value && "text-muted-foreground")}>{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}<CalendarIcon className="ml-auto h-4 w-4 opacity-50" /></Button></FormControl></PopoverTrigger>
                                                                <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={field.onChange} initialFocus fromDate={semesterSettings.startDate} toDate={semesterSettings.endDate} /></PopoverContent>
                                                            </Popover>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                             <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                                <FormField
                                                    control={form.control}
                                                    name="timeSlot"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Time Slot</FormLabel>
                                                            <Select onValueChange={field.onChange} value={field.value}>
                                                                <FormControl>
                                                                    <SelectTrigger><SelectValue placeholder="Select Time Slot" /></SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>{getTimeSlotOptionsForConflict(conflict).map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                                                            </Select>
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
                                                            <Combobox options={getRoomOptionsForConflict(conflict)} value={field.value} onValueChange={field.onChange} placeholder="Select Room" />
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                            <FormField
                                                control={form.control}
                                                name="recurrence"
                                                render={({ field }) => (
                                                  <FormItem className="space-y-3">
                                                    <FormLabel>Recurrence</FormLabel>
                                                    <FormControl>
                                                      <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex flex-col space-y-1">
                                                        <FormItem className="flex items-center space-x-3 space-y-0">
                                                          <FormControl><RadioGroupItem value="once" /></FormControl>
                                                          <FormLabel className="font-normal">Just once</FormLabel>
                                                        </FormItem>
                                                        <FormItem className="flex items-center space-x-3 space-y-0">
                                                          <FormControl><RadioGroupItem value="weekly" /></FormControl>
                                                          <FormLabel className="font-normal">Schedule weekly until shortage is resolved</FormLabel>
                                                        </FormItem>
                                                      </RadioGroup>
                                                    </FormControl>
                                                    <FormMessage />
                                                  </FormItem>
                                                )}
                                            />
                                            <div className="flex justify-end">
                                                <Button type="submit">Schedule Makeup Class(es)</Button>
                                            </div>
                                        </form>
                                    </Form>
                                </AccordionContent>
                            </AccordionItem>
                         )
                    })}
                </Accordion>
            </CardContent>
        </Card>
    );
}

function ExtraClassManager({ openDeleteConfirmation }: { openDeleteConfirmation: (action: () => void) => void; }) {
    const { extraClasses, setExtraClasses, courseMap, facultyMap, cancellations, setCancellations } = useTimetable();
    const { toast } = useToast();

    const handleCancelExtraClass = (id: string, linkedCancellationId?: string) => {
      // Find the extra class to be removed
      const extraClassToRemove = extraClasses.find(ec => ec.id === id);
      if (!extraClassToRemove) return;
  
      // Remove the extra class
      setExtraClasses(prev => prev.filter(ec => ec.id !== id));
  
      // If it's a makeup class, also remove the associated cancellation
      if (linkedCancellationId) {
          setCancellations(prev => prev.filter(c => c.id !== linkedCancellationId));
          toast({ title: 'Makeup Class Cancelled', description: 'The original class slot has been restored.' });
      } else {
          toast({ title: 'Extra Class Cancelled', description: 'The manually scheduled class has been removed.' });
      }
    };
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>Manage Extra Classes</CardTitle>
                <CardDescription>View and cancel all manually scheduled classes, including makeup and rescheduled sessions.</CardDescription>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Time</TableHead>
                            <TableHead>Course</TableHead>
                            <TableHead>Faculty</TableHead>
                            <TableHead>Room</TableHead>
                            <TableHead>Reason</TableHead>
                            <TableHead>Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {extraClasses.length > 0 ? extraClasses
                            .sort((a, b) => a.date.getTime() - b.date.getTime())
                            .map((ec) => (
                                <TableRow key={ec.id}>
                                    <TableCell>{format(ec.date, "PPP")}</TableCell>
                                    <TableCell>{ec.timeSlot}</TableCell>
                                    <TableCell>{courseMap[ec.courseId]?.name || 'Unknown'}</TableCell>
                                    <TableCell>{ec.facultyId ? facultyMap[ec.facultyId]?.name : 'N/A'}</TableCell>
                                    <TableCell>{ec.roomName}</TableCell>
                                    <TableCell>{ec.reason}</TableCell>
                                    <TableCell>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => openDeleteConfirmation(() => handleCancelExtraClass(ec.id, ec.linkedCancellationId))}
                                        >
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )) : (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center">No extra classes scheduled.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}

function ExamScheduleManager({ openDeleteConfirmation }: { openDeleteConfirmation: (action: () => void) => void }) {
    const { examSchedules, setExamSchedules, semesterSettings } = useTimetable();
    const { toast } = useToast();
    const [isFormOpen, setIsFormOpen] = React.useState(false);
    const [editingSchedule, setEditingSchedule] = React.useState<ExamSchedule | null>(null);

    const form = useForm<z.infer<typeof examScheduleFormSchema>>({
        resolver: zodResolver(examScheduleFormSchema),
    });

    const handleOpenDialog = (schedule: ExamSchedule | null) => {
        setEditingSchedule(schedule);
        if (schedule) {
            form.reset(schedule);
        } else {
            form.reset({
                semester: undefined,
                branch: undefined,
                midSemDate: undefined,
                endSemDate: undefined,
            });
        }
        setIsFormOpen(true);
    };

    const handleDelete = (id: string) => {
        setExamSchedules(prev => prev.filter(s => s.id !== id));
        toast({ title: "Exam Schedule Deleted" });
    };

    function onSubmit(values: z.infer<typeof examScheduleFormSchema>) {
        const id = `${values.semester}-${values.branch}`;
        if (editingSchedule) {
            // Update
            setExamSchedules(prev => prev.map(s => s.id === editingSchedule.id ? { ...values, id } : s));
            toast({ title: "Exam Schedule Updated" });
        } else {
            // Create
            if (examSchedules.some(s => s.id === id)) {
                form.setError("branch", { message: "A schedule for this semester and branch already exists." });
                return;
            }
            setExamSchedules(prev => [...prev, { ...values, id }]);
            toast({ title: "Exam Schedule Added" });
        }
        setIsFormOpen(false);
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="flex items-center"><CalendarDays className="mr-2"/>Exam Schedules</CardTitle>
                    <CardDescription>Set Mid- and End-Semester exam start dates for each student group.</CardDescription>
                </div>
                <Button onClick={() => handleOpenDialog(null)}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Schedule
                </Button>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Semester</TableHead>
                            <TableHead>Branch</TableHead>
                            <TableHead>Mid-Sem Start</TableHead>
                            <TableHead>End-Sem Start</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {examSchedules.length > 0 ? examSchedules
                            .sort((a,b) => a.semester - b.semester || a.branch.localeCompare(b.branch))
                            .map(schedule => (
                            <TableRow key={schedule.id}>
                                <TableCell>{schedule.semester}</TableCell>
                                <TableCell>{schedule.branch}</TableCell>
                                <TableCell>{format(schedule.midSemDate, 'PPP')}</TableCell>
                                <TableCell>{format(schedule.endSemDate, 'PPP')}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(schedule)}>
                                        <Edit className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => openDeleteConfirmation(() => handleDelete(schedule.id))}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        )) : (
                             <TableRow>
                                <TableCell colSpan={5} className="text-center text-muted-foreground">
                                    No exam schedules set. Click "Add Schedule" to begin.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>

            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingSchedule ? 'Edit' : 'Add'} Exam Schedule</DialogTitle>
                        <DialogDescription>Set the exam dates for a specific student group.</DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="semester"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Semester</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value?.toString()}>
                                                <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                                                <SelectContent>{semesters.map(s => <SelectItem key={s} value={String(s)}>{s}</SelectItem>)}</SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="branch"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Branch</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                                                <SelectContent>{branches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                             <FormField
                                control={form.control}
                                name="midSemDate"
                                render={({ field }) => (
                                  <FormItem className="flex flex-col">
                                    <FormLabel>Mid-Semester Exam Start Date</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild><Button variant={"outline"} className="justify-start text-left font-normal"><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}</Button></PopoverTrigger>
                                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} fromDate={semesterSettings.startDate} toDate={semesterSettings.endDate} initialFocus /></PopoverContent>
                                    </Popover>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                               <FormField
                                control={form.control}
                                name="endSemDate"
                                render={({ field }) => (
                                  <FormItem className="flex flex-col">
                                    <FormLabel>End-Semester Exam Start Date</FormLabel>
                                    <Popover>
                                        <PopoverTrigger asChild><Button variant={"outline"} className="justify-start text-left font-normal"><CalendarIcon className="mr-2 h-4 w-4" />{field.value ? format(field.value, "PPP") : <span>Pick a date</span>}</Button></PopoverTrigger>
                                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={field.value} onSelect={field.onChange} fromDate={form.getValues("midSemDate") || semesterSettings.startDate} toDate={semesterSettings.endDate} initialFocus /></PopoverContent>
                                    </Popover>
                                     <FormMessage />
                                  </FormItem>
                                )}
                              />
                            <DialogFooter>
                                <Button type="button" variant="ghost" onClick={() => setIsFormOpen(false)}>Cancel</Button>
                                <Button type="submit">Save Schedule</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
