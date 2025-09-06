
'use client';

import { useTimetable } from '@/context/TimetableProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useMemo, useEffect } from 'react';
import { semesters, branches, TimetableEntry, Course, Faculty, Room, timeSlots, Timetable, StudentGroup, sections, Notification, ExtraClass } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { BookOpenCheck, Calendar as CalendarIcon, ListChecks, Clock, UserSearch } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format, isSameDay, startOfWeek, addDays, getDay, isWithinInterval, eachDayOfInterval } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TimetableGrid } from '@/components/timewise/TimetableGrid';
import React from 'react';
import { cn } from '@/lib/utils';
import { Combobox } from '@/components/ui/combobox';
import { NotificationBell } from '@/components/timewise/NotificationBell';

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

// Simple hash function to create a checksum from a string
const simpleHash = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString();
};

export default function StudentPage() {
  const { timetable, courses, faculty, rooms, holidays, extraClasses, courseMap } = useTimetable();
  const [selectedSemester, setSelectedSemester] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedSlotDetails, setSelectedSlotDetails] = useState<{ day: string; timeSlot: string; entry: TimetableEntry } | null>(null);
  const [locatorFacultyId, setLocatorFacultyId] = useState<string | null>(null);
  
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isClient, setIsClient] = useState(false);

  // Effect to load notifications from localStorage on mount
  useEffect(() => {
    setIsClient(true);
    const storedNotifications = localStorage.getItem('studentNotifications');
    if (storedNotifications) {
        setNotifications(JSON.parse(storedNotifications));
    }
    setSelectedDate(new Date());
  }, []);

  // Effect to save notifications to localStorage when they change
  useEffect(() => {
    if (isClient) {
        localStorage.setItem('studentNotifications', JSON.stringify(notifications));
    }
  }, [notifications, isClient]);

  const addNotification = (message: string) => {
    const newNotification: Notification = {
      id: `notif-${Date.now()}`,
      message,
      timestamp: Date.now(),
    };
    setNotifications(prev => [newNotification, ...prev].slice(0, 20)); // Keep last 20
  };

  const clearNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };
  
  const getRelevantCourseIds = useMemo(() => {
    return (semester: string | null, branch: string | null, section: string | null): Set<string> => {
        if (!semester || semester === 'all' || !branch || branch === 'all') {
            return new Set<string>();
        }
        if (branch === 'CSE' && (!section || section === 'all')) {
            return new Set<string>();
        }

        return new Set(courses
            .filter(c => c.enrolledGroups.some(g => {
                if (g.semester !== Number(semester) || g.branch !== branch) {
                    return false;
                }
                // Correct semester and branch.
                if (branch !== 'CSE') {
                    return true; // Section doesn't matter for non-CSE.
                }
                // For CSE, a course is relevant if it has no section (common course) or matches the selected section.
                return !g.section || g.section === section;
            }))
            .map(c => c.id)
        );
    };
  }, [courses]);

  // Effect to detect changes and create notifications
  useEffect(() => {
    if (!isClient || !selectedSemester || !selectedBranch || selectedBranch === 'all' || selectedSemester === 'all') return;
    if (selectedBranch === 'CSE' && (!selectedSection || selectedSection === 'all')) return;

    const studentGroupId = `${selectedSemester}-${selectedBranch}${selectedSection ? `-${selectedSection}` : ''}`;

    const handleTimetableChange = () => {
        addNotification(`The timetable for your group (${studentGroupId}) was updated by the admin.`);
    };
    
    const handleExtraClassChange = (newExtraClasses: any[], oldExtraClasses: any[]) => {
        const relevantCourseIds = getRelevantCourseIds(selectedSemester, selectedBranch, selectedSection);
        const newRelevant = newExtraClasses.filter(ec => relevantCourseIds.has(ec.courseId));
        const oldRelevant = oldExtraClasses.filter(ec => relevantCourseIds.has(ec.courseId));

        if (newRelevant.length > oldRelevant.length) {
            const addedClass = newRelevant.find(nc => !oldRelevant.some(oc => oc.id === nc.id));
            if (addedClass) {
                const course = courseMap[addedClass.courseId];
                addNotification(`An extra class for ${course?.name} has been scheduled on ${format(addedClass.date, 'PPP')} at ${addedClass.timeSlot}.`);
            }
        }
    };
    
    const relevantCourseIds = getRelevantCourseIds(selectedSemester, selectedBranch, selectedSection);
    
    // Create a lightweight representation of the relevant schedule for hashing
    const relevantScheduleSubset = Object.entries(timetable).reduce((acc, [date, daySchedule]) => {
        const relevantSlots = Object.entries(daySchedule).reduce((dayAcc, [slot, entries]) => {
            const relevantEntries = (entries || []).filter(entry => relevantCourseIds.has(entry.courseId));
            if (relevantEntries.length > 0) {
                dayAcc[slot] = relevantEntries.map(e => e.courseId); // Store only essential info
            }
            return dayAcc;
        }, {} as Record<string, string[]>);
        
        if (Object.keys(relevantSlots).length > 0) {
            acc[date] = relevantSlots;
        }
        return acc;
    }, {} as Record<string, any>);

    const currentTimetableChecksum = simpleHash(JSON.stringify(relevantScheduleSubset));
    const previousTimetableChecksum = localStorage.getItem(`timetableChecksum_${studentGroupId}`);
    
    if (previousTimetableChecksum && previousTimetableChecksum !== currentTimetableChecksum) {
        handleTimetableChange();
    }
    localStorage.setItem(`timetableChecksum_${studentGroupId}`, currentTimetableChecksum);

    // For extra classes, we can continue to use JSON stringify as it's a much smaller object.
    const currentExtraClassesState = JSON.stringify(extraClasses);
    const previousExtraClassesState = localStorage.getItem(`extraClassesState_${studentGroupId}`);

    if (previousExtraClassesState && previousExtraClassesState !== currentExtraClassesState) {
        handleExtraClassChange(extraClasses, JSON.parse(previousExtraClassesState));
    }
    localStorage.setItem(`extraClassesState_${studentGroupId}`, currentExtraClassesState);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timetable, extraClasses, selectedSemester, selectedBranch, selectedSection, isClient]);


  // Reset section when branch changes from CSE
  useEffect(() => {
    if (selectedBranch !== 'CSE') {
      setSelectedSection(null);
    }
  }, [selectedBranch]);

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
  
  const facultyOptions = useMemo(() =>
    faculty.map(f => ({ value: f.id, label: f.name }))
  , [faculty]);


  const studentTimetableForDay = useMemo(() => {
    const relevantCourseIds = getRelevantCourseIds(selectedSemester, selectedBranch, selectedSection);

    if (relevantCourseIds.size === 0 || !selectedDate) return [];

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const daySchedule = timetable[dateStr];

    const regularScheduleForDay: (TimetableEntry & { time: string, instructorName: string, roomName: string })[] = [];
    if (daySchedule) {
      const labEntriesProcessed = new Set<string>();
      timeSlots.forEach((slot, index) => {
        const entries = daySchedule[slot];
        if (entries) {
          entries.forEach(entry => {
            if (relevantCourseIds.has(entry.courseId)) {
              const instructorName = entry.facultyId ? facultyMap[entry.facultyId]?.name : 'N/A';
              
              if (entry.type === 'Lab') {
                const labId = `${entry.courseId}-${entry.roomId}`;
                if (labEntriesProcessed.has(labId)) return;
                labEntriesProcessed.add(labId);

                const labStartTime = slot.split('-')[0];
                const labEndTime = timeSlots[index + 1]?.split('-')[1] || '';
                
                regularScheduleForDay.push({ 
                  ...entry, 
                  time: `${labStartTime}-${labEndTime}`,
                  instructorName,
                  roomName: roomMap[entry.roomId]?.name || 'N/A'
                });
              } else {
                regularScheduleForDay.push({ 
                  ...entry, 
                  time: slot,
                  instructorName,
                  roomName: roomMap[entry.roomId]?.name || 'N/A'
                });
              }
            }
          });
        }
      });
    }

    const extraClassesForDay = extraClasses
      .filter(ec => relevantCourseIds.has(ec.courseId) && format(ec.date, 'yyyy-MM-dd') === dateStr)
      .map(ec => {
          const facultyMember = ec.facultyId ? facultyMap[ec.facultyId] : null;
          return {
            ...ec,
            type: 'Extra Class' as const,
            time: ec.timeSlot,
            instructorName: facultyMember?.name || 'N/A',
            roomName: ec.roomName
          };
      });

    const combinedSchedule = [...regularScheduleForDay, ...extraClassesForDay];

    return combinedSchedule.sort((a, b) => {
        const timeA = a.time.split('-')[0];
        const timeB = b.time.split('-')[0];
        return timeSlots.indexOf(`${timeA}-00:00`) - timeSlots.indexOf(`${timeB}-00:00`);
    });
  }, [selectedSemester, selectedBranch, selectedSection, selectedDate, timetable, extraClasses, facultyMap, roomMap, getRelevantCourseIds]);

  const studentTimetableForWeek = useMemo(() => {
    const relevantCourseIds = getRelevantCourseIds(selectedSemester, selectedBranch, selectedSection);

    if (relevantCourseIds.size === 0 || !selectedDate) return {};
  
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
    const weekEnd = addDays(weekStart, 6); // Get the full week including weekends for extra classes
  
    const weeklyTimetable: Timetable = {};
  
    // Process regular timetable for weekdays
    const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });
    for (const day of weekDays) {
      const dateStr = format(day, 'yyyy-MM-dd');
      const daySchedule = timetable[dateStr];
  
      if (daySchedule) {
        for (const slot of timeSlots) {
          const entries = daySchedule[slot];
          if (entries) {
            const filteredEntries = entries.filter(entry => relevantCourseIds.has(entry.courseId));
            if (filteredEntries.length > 0) {
              if (!weeklyTimetable[dateStr]) weeklyTimetable[dateStr] = {};
              weeklyTimetable[dateStr]![slot] = filteredEntries;
            }
          }
        }
      }
    }

    // Process extra classes for the relevant group
    const studentExtraClasses = extraClasses.filter(ec => 
        relevantCourseIds.has(ec.courseId) && 
        isWithinInterval(ec.date, { start: weekStart, end: weekEnd })
    );

    studentExtraClasses.forEach(ec => {
        const dateStr = format(ec.date, 'yyyy-MM-dd');
        if (!weeklyTimetable[dateStr]) weeklyTimetable[dateStr] = {};
        if (!weeklyTimetable[dateStr][ec.timeSlot]) weeklyTimetable[dateStr][ec.timeSlot] = [];
        
        const syntheticEntry: TimetableEntry & Partial<ExtraClass> = {
            courseId: ec.courseId,
            facultyId: ec.facultyId,
            roomId: '', // No real room ID, but roomName is on the extra class
            type: 'Classroom', // Default type, grid will handle display
            roomName: ec.roomName,
            reason: ec.reason
        };
        
        weeklyTimetable[dateStr][ec.timeSlot]!.push(syntheticEntry);
    });
  
    return weeklyTimetable;
  }, [selectedSemester, selectedBranch, selectedSection, selectedDate, timetable, extraClasses, getRelevantCourseIds]);
  
  const facultyScheduleForSelectedDay = useMemo(() => {
    if (!locatorFacultyId || !selectedDate) return [];

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const daySchedule = timetable[dateStr];

    const regularClasses = timeSlots.flatMap(slot => {
        const entries = daySchedule?.[slot] || [];
        return entries
            .filter(entry => entry.facultyId === locatorFacultyId)
            .map(entry => {
                const course = courseMap[entry.courseId];
                const room = roomMap[entry.roomId];
                return {
                    originalTime: slot, // for sorting
                    time: entry.type === 'Lab' ? `${slot.split('-')[0]}-${parseInt(slot.split('-')[1]) + 1}:00` : slot,
                    courseName: course?.name || 'Unknown',
                    type: entry.type,
                    enrolledGroups: course?.enrolledGroups || [],
                    roomName: room?.name || 'N/A'
                };
            });
    });

    const selectedDaysExtraClasses = extraClasses
        .filter(ec => ec.facultyId === locatorFacultyId && format(ec.date, 'yyyy-MM-dd') === dateStr)
        .map(ec => {
            const course = courseMap[ec.courseId];
            return {
                originalTime: ec.timeSlot, // for sorting
                time: ec.timeSlot,
                courseName: course?.name || 'Unknown',
                type: 'Extra Class' as const,
                enrolledGroups: course?.enrolledGroups || [],
                roomName: ec.roomName
            };
        });

    const fullSchedule = [...regularClasses, ...selectedDaysExtraClasses];
    
    // Remove duplicates from labs that span two slots
    const uniqueSchedule = Array.from(new Map(fullSchedule.map(item => [item.time + item.courseName, item])).values());
    
    return uniqueSchedule.sort((a, b) => timeSlots.indexOf(a.originalTime) - timeSlots.indexOf(b.originalTime));
  }, [locatorFacultyId, selectedDate, timetable, extraClasses, courseMap, roomMap]);

  const holidayForSelectedDate = useMemo(() => {
    if (!selectedDate) return null;
    return holidays.find(h => isSameDay(h.dateRange.from, selectedDate));
  }, [selectedDate, holidays]);

  const freeSlotsForDay = useMemo(() => {
    if (!selectedSemester || !selectedBranch || !selectedDate || holidayForSelectedDate) {
      return [];
    }
    
    // Logic for finding free slots remains the same as it can operate on groups without section detail for now.
    const targetStudentGroups = new Set<string>();
    if (selectedSemester === 'all' && selectedBranch === 'all') {
      courses.forEach(c => c.enrolledGroups.forEach(g => targetStudentGroups.add(`${g.semester}-${g.branch}`)));
    } else if (selectedSemester === 'all') {
      courses.filter(c => c.enrolledGroups.some(g => g.branch === selectedBranch)).forEach(c => c.enrolledGroups.filter(g => g.branch === selectedBranch).forEach(g => targetStudentGroups.add(`${g.semester}-${g.branch}`)));
    } else if (selectedBranch === 'all') {
      courses.filter(c => c.enrolledGroups.some(g => g.semester === Number(selectedSemester))).forEach(c => c.enrolledGroups.filter(g => g.semester === Number(selectedSemester)).forEach(g => targetStudentGroups.add(`${g.semester}-${g.branch}`)));
    } else {
      targetStudentGroups.add(`${Number(selectedSemester)}-${selectedBranch}`);
    }
    
    if (targetStudentGroups.size === 0) return timeSlots;

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const daySchedule = timetable[dateStr];
    if (!daySchedule) return timeSlots;

    const occupiedSlots = new Set<string>();
    for (const slot of timeSlots) {
      const entries = daySchedule[slot];
      if (entries) {
        for (const entry of entries) {
          const course = courseMap[entry.courseId];
          if (course) {
             const courseIsRelevant = course.enrolledGroups.some(g => targetStudentGroups.has(`${g.semester}-${g.branch}`));
             if (courseIsRelevant) {
                occupiedSlots.add(slot);
                break; 
             }
          }
        }
      }
    }

    return timeSlots.filter(slot => !occupiedSlots.has(slot));
  }, [selectedSemester, selectedBranch, selectedDate, holidays, courses, timetable, courseMap]);
  
  const handleSlotClick = (day: string, timeSlot: string, entry: TimetableEntry) => {
    setSelectedSlotDetails({ day, timeSlot, entry });
  };

  const getPlaceholderText = () => {
    if (!selectedSemester || !selectedBranch) return 'Please select a semester and branch.';
    if (selectedSemester === 'all' || selectedBranch === 'all') return 'Please select a specific semester and branch.';
    if (selectedBranch === 'CSE' && !selectedSection) return 'Please select your section for the CSE branch.';
    if (selectedBranch === 'CSE' && selectedSection === 'all') return 'Please select a specific section for the CSE branch.';
    return 'No classes scheduled for this day.';
  };


  return (
    <div className="container p-0 mx-auto w-fit md:p-10 lg:p-12 px-4">
      <div className="flex justify-between items-center mb-10">
        <h1 className="text-5xl font-extrabold font-headline px-2 pt-6 text-gray-800">Student Dashboard</h1>
        {isClient && (
          <NotificationBell 
            notifications={notifications}
            onClearNotification={clearNotification}
            onClearAllNotifications={clearAllNotifications}
          />
        )}
      </div>
      
      <Card className="mb-10 p-0 w-[365px] md:w-full bg-[#FFEDFA] rounded-xl shadow-lg border border-black shrink-0">
        <CardHeader>
          <CardTitle className="font-bold text-2xl font-headline text-gray-800">Schedule &amp; Slot Finder</CardTitle>
          <CardDescription className="text-base text-gray-600 font-body leading-relaxed pt-2">Select a semester, branch, and date to view the class schedule or find available slots for group activities.</CardDescription>
          <div className="flex flex-col md:flex-row gap-6 pt-6">
            <Select onValueChange={(value) => setSelectedSemester(value)}>
              <SelectTrigger className="animated-gradient-button w-full md:w-[220px] h-12 text-base font-semibold font-headline text-gray-700 bg-gray-50 border-black focus:ring-primary">
                <SelectValue placeholder="Select Semester" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Semesters</SelectItem>
                {semesters.map(s => <SelectItem key={s} value={String(s)}>Semester {s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select onValueChange={(value) => setSelectedBranch(value)}>
              <SelectTrigger className="animated-gradient-button w-full md:w-[220px] h-12 text-base font-semibold font-headline text-gray-700 bg-gray-50 border-black focus:ring-primary">
                <SelectValue placeholder="Select Branch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
            {selectedBranch === 'CSE' && (
              <Select onValueChange={(value) => setSelectedSection(value)}>
                <SelectTrigger className="animated-gradient-button w-full md:w-[220px] h-12 text-base font-semibold font-headline text-gray-700 bg-gray-50 border-black focus:ring-primary">
                  <SelectValue placeholder="Select Section" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sections</SelectItem>
                  {sections.map(s => <SelectItem key={s} value={s}>Section {s}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>
      </Card>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <Card className="lg:col-span-1 rounded-lg border bg-[#FAF6E9] shadow-sm shadow-gray-800 flex w-full p-6 justify-center">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            className='border-0 shadow-red p-0'
          />
        </Card>
        <div className="lg:col-span-2 w-auto">
          <Tabs defaultValue="schedule" className="w-full">
            <TabsList className="grid w-auto grid-cols-3 sm:grid-cols-3 bg-white p-1 rounded-lg text-black shrink-0 border-[1px] border-gray-200">
              <TabsTrigger value="schedule" className="data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md rounded-md">Daily Schedule</TabsTrigger>
              <TabsTrigger value="finder" className="data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md rounded-md">Free Slot Finder</TabsTrigger>
              <TabsTrigger value="locator" className="data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md rounded-md">Faculty Locator</TabsTrigger>
            </TabsList>
            <TabsContent value="schedule" className="mt-4 w-full p-0 md:w-auto">
              <Card className="bg-[#EFEEEA] w-full p-0 rounded-xl shadow-lg border-[1px] border-gray-400">
                <CardHeader>
                  <CardTitle className="font-bold text-2xl font-headline p-0 text-black">
                    Schedule for {selectedDate ? format(selectedDate, 'PPP') : '...'}
                  </CardTitle>
                  <CardDescription className="text-base text-gray-800 font-body pt-2">
                    {selectedDate ? `Showing schedule for ${format(selectedDate, 'EEEE')}. Select a specific semester and branch to see classes. Scroll sideways to check the room details.` : 'Select a date to see the schedule.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="">
                  {holidayForSelectedDate ? (
                    <div className="flex flex-col items-center justify-center text-center py-10">
                      <CalendarIcon className="h-12 w-12 text-primary mb-2" />
                      <p className="text-lg font-semibold">{holidayForSelectedDate.name}</p>
                      <p className="text-muted-foreground">Holiday</p>
                    </div>
                  ) : studentTimetableForDay.length > 0 ? (
                    <Table className='p-0'>
                      <TableHeader>
                        <TableRow className="border-b-gray-200 bg-[#102E50]">
                          <TableHead className="font-semibold text-white font-headline">Time</TableHead>
                          <TableHead className="font-semibold text-white font-headline">Course</TableHead>
                          <TableHead className="font-semibold text-white font-headline">Instructor</TableHead>
                          <TableHead className="font-semibold text-white font-headline">Room</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className='p-0'>
                        {studentTimetableForDay.map((item, index) => (
                            <TableRow
                              key={index}
                              className={cn("cursor-pointer", index % 2 === 0 ? 'bg-[#ADEED9] hover:bg-[#a1dece]' : 'bg-[#FFEDF3] hover:bg-[#ffe0eb]' )}
                              onClick={() => handleSlotClick(format(selectedDate!, 'EEEE'), item.time, item as TimetableEntry)}
                            >
                              <TableCell className="font-semibold text-gray-700">{item.time}</TableCell>
                              <TableCell className="font-semibold text-gray-800">
                                {courseMap[item.courseId]?.name}
                                {item.type !== 'Classroom' && <span className="text-gray-500 text-xs font-normal"> ({item.type})</span>}
                              </TableCell>
                              <TableCell className="text-gray-600">{'instructorName' in item ? item.instructorName : 'N/A'}</TableCell>
                              <TableCell className="text-gray-1000">{'roomName' in item ? item.roomName : 'N/A'}</TableCell>
                            </TableRow>
                          )
                        )}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center text-gray-500 font-body italic py-10">
                      <p>{getPlaceholderText()}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="finder" className="mt-4">
              <Card className="bg-[#FFF8F8] rounded-xl shadow-lg border-[1px] border-gray-400">
                  <CardHeader>
                      <CardTitle className="font-bold text-2xl font-headline text-gray-800 flex items-center"><ListChecks className="mr-3 h-6 w-6"/>Available Slots</CardTitle>
                      <CardDescription className="text-base text-gray-600 font-body pt-2">Find common free slots for a group. 'All' will find slots free for everyone in that category.</CardDescription>
                  </CardHeader>
                  <CardContent className="px-6 pb-6">
                    <div className="flex items-center justify-center min-h-[200px]">
                      {!selectedSemester || !selectedBranch ? (
                         <div className="text-center text-gray-500 font-body italic">
                            <p>Please select a semester and branch to find free slots.</p>
                        </div>
                      ) : freeSlotsForDay.length > 0 ? (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full">
                              {freeSlotsForDay.map(slot => (
                                  <div key={slot} className="flex items-center justify-center gap-3 text-lg font-semibold p-4 bg-[#DCEDC8] border border-gray-400 rounded-xl text-center shadow-md hover:shadow-lg hover:border-primary transition-all duration-300">
                                      <Clock className="h-6 w-6 text-accent" />
                                      <span className="text-gray-700">{slot}</span>
                                  </div>
                              ))}
                          </div>
                      ) : holidayForSelectedDate ? (
                          <div className="text-center text-gray-500 font-body italic">
                              <p>This day is a holiday.</p>
                          </div>
                      ) : (
                          <div className="text-center text-gray-500 font-body italic">
                              <p>No common free slots found for the selected group on this day.</p>
                          </div>
                      )}
                    </div>
                  </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="locator" className="mt-4">
                <Card className="bg-[#F6F0F0] rounded-xl shadow-lg border-[1px] border-gray-400">
                    <CardHeader>
                        <CardTitle className="font-bold text-2xl font-headline text-gray-800 flex items-center">
                            <UserSearch className="mr-3 h-6 w-6"/>
                            Faculty Locator
                        </CardTitle>
                        <CardDescription className="text-base text-gray-600 font-body pt-2">
                            Find out a faculty member's schedule for the selected date: {selectedDate ? format(selectedDate, 'PPP') : '...'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="px-6 pb-6 space-y-6">
                        <Combobox
                            options={facultyOptions}
                            value={locatorFacultyId!}
                            onValueChange={setLocatorFacultyId}
                            placeholder="Select a faculty member"
                            searchPlaceholder="Search faculty..."
                            emptyResultText="No faculty found."
                            triggerClassName="w-full md:w-[280px] animated-gradient-button h-12 text-base font-semibold font-headline text-white border-black focus:ring-primary"
                            allowDeselect={true}
                        />
                        {locatorFacultyId ? (
                            facultyScheduleForSelectedDay.length > 0 ? (
                                <Table>
                                    <TableHeader>
                                        <TableRow className='bg-[#211C84] pointer-events-none'>
                                            <TableHead className=' text-white'>Time Slot</TableHead>
                                            <TableHead className=' text-white'>Activity / Course</TableHead>
                                            <TableHead className=' text-white'>Group(s)</TableHead>
                                            <TableHead className=' text-white'>Location</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {facultyScheduleForSelectedDay.map((item, index) => (
                                            <TableRow key={index} className={cn("cursor-pointer", index % 2 === 0 ? 'bg-[#FBFFE4] pointer-events-none' : 'bg-[#9DC08B] pointer-events-none' )} >
                                                <TableCell>{item.time}</TableCell>
                                                <TableCell>
                                                    {item.courseName}
                                                    {item.type !== 'Classroom' && <span className="text-gray-500 text-xs font-normal"> ({item.type})</span>}
                                                </TableCell>
                                                <TableCell>{formatEnrolledGroupsForDisplay(item.enrolledGroups)}</TableCell>
                                                <TableCell>{item.roomName}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : (
                                <div className="text-center text-gray-500 font-body italic py-10">
                                    <p>This faculty member has no classes scheduled for this day.</p>
                                </div>
                            )
                        ) : (
                            <div className="text-center text-gray-500 font-body italic py-10">
                                <p>Please select a faculty member to view their schedule for the selected date.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    <Card className="mb-2 mt-10 p-0 w-[365px] md:w-full bg-[#FFEDFA] rounded-xl shadow-lg border border-black shrink-0">
                    
      {selectedSemester && selectedSemester !== 'all' && selectedBranch && selectedBranch !== 'all' && (
        <Card className="bg-[#FEF3E2] w-auto rounded-xl border-none p-0 overflow-auto">
          <CardHeader>
            <CardTitle className="font-bold text-2xl font-headline text-gray-800 flex items-center">
              <CalendarIcon className="mr-3 h-6 w-6"/>
              Weekly Schedule for {selectedDate ? `Week of ${format(startOfWeek(selectedDate, {weekStartsOn: 1}), 'PPP')}` : '...'}
            </CardTitle>
            <CardDescription className="text-base text-gray-600 font-body pt-2">
              Full week view for Semester {selectedSemester}, Branch {selectedBranch}.
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto h-auto">
            {selectedDate && (
              <TimetableGrid 
                timetable={studentTimetableForWeek} 
                onSlotClick={handleSlotClick} 
                startDate={startOfWeek(selectedDate, { weekStartsOn: 1 })}
              />
            )}
          </CardContent>
        </Card>
      )}
    </Card>
      <Dialog open={!!selectedSlotDetails} onOpenChange={() => setSelectedSlotDetails(null)}>
        <DialogContent className="rounded-lg overflow-auto p-0 mx-2 gap-0 [&>button]:text-primary-foreground [&>button]:opacity-80 [&>button:hover]:opacity-100">
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

            const labStartTime = timeSlot.split('-')[0];
            const labTimeSlotIndex = timeSlots.indexOf(timeSlot);
            const labEndTime = labTimeSlotIndex < timeSlots.length - 1 ? timeSlots[labTimeSlotIndex + 1].split('-')[1] : '';

            const details = [
                { label: "Day", value: day },
                { label: "Time Slot", value: entry.type === 'Lab' ? `${labStartTime}-${labEndTime}` : timeSlot },
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
    </div>
  );
}
