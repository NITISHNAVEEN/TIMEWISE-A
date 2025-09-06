
'use client';

import React from 'react';
import { useTimetable } from '@/context/TimetableProvider';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Timetable, TimetableEntry, displayTimeSlots, ExtraClass, StudentGroup, Course } from '@/lib/types';
import { addDays, format, getDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { Coffee, Utensils } from 'lucide-react';

interface TimetableGridProps {
  timetable: Timetable;
  onSlotClick?: (day: string, timeSlot: string, entry: TimetableEntry) => void;
  startDate: Date;
}

function formatEnrolledGroupsForDisplay(groups: StudentGroup[]): string {
    if (!groups || groups.length === 0) return 'N/A';
    
    const formattedGroups = groups.map(g => `S${g.semester} ${g.branch}${g.section ? `-${g.section}` : ''}`);

    if (formattedGroups.length > 2) {
        return `${formattedGroups.slice(0, 2).join(', ')}...`;
    }
    
    return formattedGroups.join(', ');
}


export function TimetableGrid({ timetable, onSlotClick, startDate }: TimetableGridProps) {
  const { courses, faculty, rooms, extraClasses } = useTimetable();

  const courseMap = React.useMemo(() => 
    courses.reduce((acc, course) => {
        acc[course.id] = course;
        return acc;
    }, {} as Record<string, Course>), 
  [courses]);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startDate, i));

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="w-[110px] font-semibold">Time</TableHead>
            {weekDays.map(day => (
              <TableHead key={day.toISOString()} className="font-semibold w-[140px] md:w-fit text-center">
                {format(day, 'EEEE')}
                <div className="text-xs font-normal text-muted-foreground">{format(day, 'MMM d')}</div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {displayTimeSlots.map((slot, index) => {
            const isLunchBreak = slot === '12:00-13:30';
            const isSnacksBreak = slot === '16:30-17:00';
            const isBreak = isLunchBreak || isSnacksBreak;

            if (isBreak) {
              return (
                <TableRow key={slot} className="bg-secondary/50 hover:bg-secondary/50">
                  <TableCell className="font-semibold font-mono text-muted-foreground align-middle text-xs text-center">
                    {slot}
                  </TableCell>
                  <TableCell colSpan={7} className="text-center font-semibold text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      {isLunchBreak ? <Utensils className="h-4 w-4" /> : <Coffee className="h-4 w-4" />}
                      {isLunchBreak ? 'Lunch Break' : 'Snacks Break'}
                    </div>
                  </TableCell>
                </TableRow>
              )
            }

            return (
              <TableRow key={slot} className={cn(index % 2 === 0 ? 'bg-background' : 'bg-muted/30', 'hover:bg-muted/50')}>
                <TableCell className="font-semibold font-mono text-muted-foreground align-top pt-3 text-xs">{slot}</TableCell>
                {weekDays.map(day => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const dayName = format(day, 'EEEE');

                  const regularEntries = timetable[dateStr]?.[slot];
                  const extraClassEntries = extraClasses.filter(ec => format(ec.date, 'yyyy-MM-dd') === dateStr && ec.timeSlot === slot);
                  
                  if ((!regularEntries || regularEntries.length === 0) && extraClassEntries.length === 0) {
                    return <TableCell key={dateStr} className="p-2 align-top h-full"></TableCell>;
                  }

                  return (
                    <TableCell key={dateStr} className="p-2 align-top">
                      <div className="flex flex-col gap-2">
                         {regularEntries?.map((entry, index) => {
                          const course = courses.find(c => c.id === entry.courseId);
                          const prof = entry.facultyId ? faculty.find(f => f.id === entry.facultyId) : null;
                          const room = rooms.find(r => r.id === entry.roomId);
                          
                          const staffName = prof?.name || 'Unknown Staff';

                          const handleClick = () => {
                            if (onSlotClick) {
                              onSlotClick(dayName, slot, entry);
                            }
                          };
                          
                          return (
                            <div key={`regular-${index}`} onClick={handleClick} className={`bg-card overflow-hidden rounded-lg p-2 shadow border transition-all duration-200 h-full ${onSlotClick ? 'cursor-pointer hover:shadow-lg hover:scale-105 hover:z-10' : ''}`}>
                                <p className="text-sm font-semibold text-foreground leading-tight">
                                  {course?.name || 'Unknown Course'}
                                </p>
                                <p className="text-xs  text-muted-foreground">{staffName}</p>
                                <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
                                   {course && (
                                    <p>{formatEnrolledGroupsForDisplay(course.enrolledGroups)}</p>
                                   )}
                                   <p>{room?.name || 'N/A'}</p>
                                </div>
                                 {entry.type !== 'Classroom' && <p className="text-xs font-medium text-primary/100 border-primary/100 bg-primary/20 rounded-full px-2 py-0.5 mt-2 inline-block">{entry.type}</p>}
                            </div>
                          );
                        })}
                        {extraClassEntries.map((entry, index) => {
                          const course = courseMap[entry.courseId];
                          const prof = faculty.find(f => f.id === entry.facultyId);

                          const isMakeup = entry.reason === 'Conflict Resolution';
                          let makeupType: 'Classroom' | 'Tutorial' | null = null;
                          if (isMakeup && course) {
                              // Infer type based on what the course needs more of
                              if (course.weeklyClassroomHours > 0) makeupType = 'Classroom';
                              else if (course.weeklyTutorialHours > 0) makeupType = 'Tutorial';
                          }
                          
                          const handleClick = () => {
                            if (onSlotClick) {
                              // We need to create a synthetic TimetableEntry-like object for the dialog
                              const syntheticEntry = { 
                                ...entry,
                                type: makeupType || 'Classroom',
                                roomName: entry.roomName,
                                roomId: '', // Indicate it's not a standard entry
                              };
                              onSlotClick(dayName, slot, syntheticEntry as any);
                            }
                          };
                          
                          return (
                            <div 
                              key={`extra-${index}`}
                              onClick={handleClick}
                              className={cn(
                                "rounded-lg p-2 shadow border h-full transition-all duration-200",
                                onSlotClick ? 'cursor-pointer hover:shadow-lg hover:scale-105 hover:z-10' : '',
                                isMakeup ? 'bg-green-100 border-green-300' : 'bg-accent/10'
                              )}
                            >
                                <p className="text-sm font-semibold text-foreground leading-tight">
                                  {course?.name || 'Unknown Course'}
                                </p>
                                <p className="text-xs text-muted-foreground">{prof?.name || 'Unknown Staff'}</p>
                                <div className="text-xs text-muted-foreground mt-2 space-y-0.5">
                                   {course && (
                                    <p>{formatEnrolledGroupsForDisplay(course.enrolledGroups)}</p>
                                   )}
                                   <p>{entry.roomName}</p>
                                </div>
                                 <p className={cn(
                                  "text-xs font-medium rounded-full px-2 py-0.5 mt-2 inline-block",
                                  isMakeup ? 'bg-green-200 text-green-800' : 'text-accent-foreground bg-accent/80'
                                 )}>
                                  {isMakeup ? `Makeup (${makeupType})` : 'Extra Class'}
                                </p>
                            </div>
                          );
                        })}
                      </div>
                    </TableCell>
                  );
                })}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  );
}
