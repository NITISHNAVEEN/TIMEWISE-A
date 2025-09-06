

'use client';

import { useTimetable } from '@/context/TimetableProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useState, useMemo, useEffect } from 'react';
import { TimetableEntry, Course, Faculty, Room, timeSlots, StudentGroup } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BookOpenCheck, Calendar as CalendarIcon, DoorOpen } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format, isSameDay } from 'date-fns';
import { Combobox } from '@/components/ui/combobox';
import React from 'react';
import { cn } from '@/lib/utils';
import { Loader } from '@/components/ui/loader';

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

export default function ClassroomPage() {
  const { timetable, courses, faculty, rooms, holidays, courseMap } = useTimetable();
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [selectedSlotDetails, setSelectedSlotDetails] = useState<{ day: string; timeSlot: string; entry: TimetableEntry } | null>(null);

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

    const roomOptions = useMemo(() =>
        rooms.map(r => ({ value: r.id, label: `${r.name} (${r.type})` }))
    , [rooms]);

  const fullDayScheduleForRoom = useMemo(() => {
    if (!selectedRoomId || !selectedDate) return null;

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const daySchedule = timetable[dateStr];

    const labEntriesProcessed = new Set<string>();

    return timeSlots.map(slot => {
      const entries = daySchedule?.[slot];
      const entryForRoom = entries?.find(e => e.roomId === selectedRoomId);
      
      if (entryForRoom) {
        if (entryForRoom.type === 'Lab') {
          const labId = `${entryForRoom.courseId}-${entryForRoom.roomId}`;
          if (labEntriesProcessed.has(labId)) {
            // This is the second hour of a lab, which we don't show as a separate row
            return { timeSlot: slot, entry: entryForRoom, isContinuation: true };
          }
          labEntriesProcessed.add(labId);
        }
        return { timeSlot: slot, entry: entryForRoom, isContinuation: false };
      }
      
      return { timeSlot: slot, entry: null, isContinuation: false };
    });
  }, [selectedRoomId, selectedDate, timetable]);

  const holidayForSelectedDate = useMemo(() => {
    if (!selectedDate) return null;
    return holidays.find(h => isSameDay(h.date, selectedDate));
  }, [selectedDate, holidays]);
  
  const handleSlotClick = (day: string, timeSlot: string, entry: TimetableEntry) => {
    setSelectedSlotDetails({ day, timeSlot, entry });
  };

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <h1 className="text-3xl font-bold font-headline mb-4 flex items-center"><DoorOpen className="mr-3 h-8 w-8"/>Classroom Schedule</h1>
      <Card>
        <CardHeader>
          <CardTitle>View Classroom Schedule</CardTitle>
          <CardDescription>Select a classroom, then pick a date to view its schedule.</CardDescription>
          <div className="pt-4">
            <Combobox
                options={roomOptions}
                value={selectedRoomId!}
                onValueChange={(value) => setSelectedRoomId(value)}
                placeholder="Select Classroom"
                searchPlaceholder="Search classrooms..."
                emptyResultText="No classroom found."
                triggerClassName="w-full md:w-[280px]"
                allowDeselect={true}
            />
          </div>
        </CardHeader>
        <CardContent>
          {selectedRoomId ? (
            <div className="grid md:grid-cols-2 gap-8 mt-4 items-start">
              <Card className="rounded-lg border bg-card shadow-sm flex items-center justify-center p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  className='border-0 shadow-none'
                  modifiers={{ weekend: { dayOfWeek: [0, 6] } }}
                />
              </Card>
              <div>
                <Card>
                  <CardHeader>
                    <CardTitle>
                      Schedule for {selectedDate ? format(selectedDate, 'PPP') : '...'}
                    </CardTitle>
                    <CardDescription>
                      {selectedDate ? `Showing schedule for ${format(selectedDate, 'EEEE')}. Click on a slot to see details.` : 'Select a date to see the schedule.'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {holidayForSelectedDate ? (
                      <div className="flex flex-col items-center justify-center text-center h-48">
                        <CalendarIcon className="h-12 w-12 text-primary mb-2" />
                        <p className="text-lg font-semibold">{holidayForSelectedDate.name}</p>
                        <p className="text-muted-foreground">Holiday</p>
                      </div>
                    ) : fullDayScheduleForRoom ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Time Slot</TableHead>
                            <TableHead>Course</TableHead>
                            <TableHead>Group</TableHead>
                            <TableHead>Instructor</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {fullDayScheduleForRoom.filter(({ isContinuation }) => !isContinuation).map(({ timeSlot, entry }, index) => {
                            if (entry) {
                              const course = courseMap[entry.courseId];
                              const instructorName = entry.facultyId 
                                ? facultyMap[entry.facultyId]?.name 
                                : 'N/A';

                              const labStartTime = timeSlot.split('-')[0];
                              const labTimeSlotIndex = timeSlots.indexOf(timeSlot);
                              const labEndTime = labTimeSlotIndex < timeSlots.length - 1 ? timeSlots[labTimeSlotIndex + 1]?.split('-')[1] || '' : '';

                              return (
                                <TableRow 
                                  key={index} 
                                  className="cursor-pointer"
                                  onClick={() => handleSlotClick(format(selectedDate!, 'EEEE'), timeSlot, entry)}
                                >
                                  <TableCell>{entry.type === 'Lab' ? `${labStartTime}-${labEndTime}` : timeSlot}</TableCell>
                                  <TableCell>
                                    {course?.name}
                                    <span className="text-muted-foreground text-xs font-normal"> ({entry.type})</span>
                                  </TableCell>
                                  <TableCell>{course ? formatEnrolledGroupsForDisplay(course.enrolledGroups) : ''}</TableCell>
                                  <TableCell>{instructorName}</TableCell>
                                </TableRow>
                              )
                            } else {
                              return (
                                <TableRow key={index}>
                                  <TableCell>{timeSlot}</TableCell>
                                  <TableCell colSpan={3} className="text-center text-muted-foreground italic">
                                    - Free Slot -
                                  </TableCell>
                                </TableRow>
                              );
                            }
                          })}
                        </TableBody>
                      </Table>
                    ) : (
                      <div className="text-center text-muted-foreground py-8 h-48 flex items-center justify-center">
                        <Loader text="Loading schedule..." />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              <p>Please select a classroom to view its schedule.</p>
            </div>
          )}
        </CardContent>
      </Card>
      
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
            const room = roomMap[entry.roomId];

            const labStartTime = timeSlot.split('-')[0];
            const labTimeSlotIndex = timeSlots.indexOf(timeSlot);
            const labEndTime = labTimeSlotIndex < timeSlots.length - 1 ? timeSlots[labTimeSlotIndex + 1]?.split('-')[1] || '' : '';

            const details = [
                { label: "Day", value: day },
                { label: "Time Slot", value: entry.type === 'Lab' ? `${labStartTime}-${labEndTime}` : timeSlot },
                { label: "Course", value: course ? `${course.name} (${course.code})` + (entry.type !== 'Classroom' ? ` (${entry.type})` : '') : 'N/A' },
                { label: "Student Groups", value: course ? formatAllEnrolledGroups(course.enrolledGroups) : 'N/A' },
                { label: "Students", value: course?.studentCount },
                ...(facultyMember ? [{ label: "Faculty", value: facultyMember.name }] : []),
                { label: "Room", value: room ? `${room.name} (Cap: ${room.capacity})` : 'N/A' }
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
