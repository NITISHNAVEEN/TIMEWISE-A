

'use client';

import { addDays, format, getDay, eachDayOfInterval, eachWeekOfInterval, nextDay, getMonth, isSameWeek } from 'date-fns';
import { Course, Timetable, TimetableConflict, TimetableEntry, timeSlots, standardTimeSlots, Cancellation, FacultyLeave, SemesterSettings, daysOfWeek, Basket, ExtraClass, Room, StudentGroup, ExamSchedule } from './types';

interface SchedulerInput {
    courses: Course[];
    faculty: any[];
    rooms: Room[];
    holidays: any[];
    cancellations: Cancellation[];
    facultyLeaves: FacultyLeave[];
    semesterSettings: SemesterSettings;
    baskets: Basket[];
    extraClasses: ExtraClass[];
    examSchedules: ExamSchedule[];
}

interface SchedulerOutput {
    timetable: Timetable;
    conflicts: TimetableConflict[];
}

const isHoliday = (date: Date, course: Course, holidays: any[]): boolean => {
    return holidays.some(h => {
        const from = new Date(h.dateRange.from);
        const to = h.dateRange.to ? new Date(h.dateRange.to) : new Date(h.dateRange.from);
        from.setHours(0, 0, 0, 0);
        to.setHours(23, 59, 59, 999);
        const checkDate = new Date(date);
        checkDate.setHours(12, 0, 0, 0);

        if (!(checkDate >= from && checkDate <= to)) {
            return false;
        }

        const isFirstSemCourse = course.enrolledGroups.every(g => g.semester === 1);

        if (h.scope === 'only_first_sem' && isFirstSemCourse) {
            return true;
        }
        if (h.scope === 'all_except_first_sem' && !isFirstSemCourse) {
            return true;
        }
        
        return false;
    });
};


const buildLeaveMap = (facultyLeaves: FacultyLeave[]) => {
    const leaveMap = new Map<string, Date[]>();

    facultyLeaves.forEach(leave => {
        if (!leaveMap.has(leave.facultyId)) {
            leaveMap.set(leave.facultyId, []);
        }
        const allDates = eachDayOfInterval({ start: leave.dateRange.from, end: leave.dateRange.to || leave.dateRange.from });
        leaveMap.get(leave.facultyId)!.push(...allDates);
    });
    
    return leaveMap;
}

const isOnLeave = (staffId: string, date: Date, leaveMap: Map<string, Date[]>): boolean => {
    const leaveDates = leaveMap.get(staffId);
    if (!leaveDates) return false;
    const dateStr = format(date, 'yyyy-MM-dd');
    return leaveDates.some(leaveDate => format(leaveDate, 'yyyy-MM-dd') === dateStr);
};

const isCancelled = (date: Date, timeSlot: string, cancellations: Cancellation[]): boolean => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return cancellations.some(c => format(c.date, 'yyyy-MM-dd') === dateStr && c.timeSlot === timeSlot);
};

export function generateTimetableFromData({ courses, faculty, rooms, holidays, cancellations, facultyLeaves, semesterSettings, baskets, extraClasses, examSchedules }: SchedulerInput): SchedulerOutput {
    const timetable: Timetable = {};
    const conflicts: TimetableConflict[] = [];
    const uniqueConflicts = new Map<string, TimetableConflict>();
    
    const addConflict = (conflict: TimetableConflict) => {
        const key = `${conflict.type}-${(conflict.details as any).courseId || ''}-${conflict.description}`;
        if (!uniqueConflicts.has(key)) {
            uniqueConflicts.set(key, conflict);
        }
    };
    
    if (!semesterSettings.startDate || !semesterSettings.endDate) {
        return { timetable, conflicts: [] };
    }
    
    const cleanSemesterStart = new Date(semesterSettings.startDate);
    cleanSemesterStart.setHours(0, 0, 0, 0);

    const cleanSemesterEnd = new Date(semesterSettings.endDate);
    cleanSemesterEnd.setHours(23, 59, 59, 999);
    
    const cleanSeniorSemesterEnd = new Date(semesterSettings.seniorEndDate);
    cleanSeniorSemesterEnd.setHours(23, 59, 59, 999);

    const examScheduleMap = new Map<string, ExamSchedule>();
    examSchedules.forEach(es => examScheduleMap.set(`${es.semester}-${es.branch}`, es));
    
    const scheduledHoursTracker: { [courseId: string]: { classroom: number; tutorial: number; lab: number; } } = {};
    courses.forEach(c => {
        scheduledHoursTracker[c.id] = { classroom: 0, tutorial: 0, lab: 0 };
    });

    const adjustedCourseTargets = new Map<string, { classroomHours: number, tutorialHours: number, labHours: number, weeklyClassroomHours: number, weeklyTutorialHours: number, weeklyLabHours: number }>();
    courses.forEach(c => {
        adjustedCourseTargets.set(c.id, {
            classroomHours: c.classroomHours,
            tutorialHours: c.tutorialHours,
            labHours: c.labHours,
            weeklyClassroomHours: c.weeklyClassroomHours,
            weeklyTutorialHours: c.weeklyTutorialHours,
            weeklyLabHours: c.weeklyLabHours,
        });
    });

    const permanentCancellations = cancellations.filter(c => c.status === 'Cancelled');
    permanentCancellations.forEach(cancellation => {
        if (cancellation.cancelledClasses) {
            cancellation.cancelledClasses.forEach(cancelledClass => {
                const courseTarget = adjustedCourseTargets.get(cancelledClass.courseId);
                const originalCourse = courses.find(c=>c.id === cancelledClass.courseId);
                if (courseTarget && originalCourse) {
                    let totalHours = 0;
                    switch(cancelledClass.classType) {
                        case 'Classroom': 
                            totalHours = originalCourse.classroomHours;
                            if (totalHours > 0 && courseTarget.classroomHours > 0) {
                                courseTarget.weeklyClassroomHours = (courseTarget.weeklyClassroomHours / courseTarget.classroomHours) * (courseTarget.classroomHours - 1);
                                courseTarget.classroomHours = Math.max(0, courseTarget.classroomHours - 1); 
                            }
                            break;
                        case 'Tutorial': 
                            totalHours = originalCourse.tutorialHours;
                            if (totalHours > 0 && courseTarget.tutorialHours > 0) {
                                courseTarget.weeklyTutorialHours = (courseTarget.weeklyTutorialHours / courseTarget.tutorialHours) * (courseTarget.tutorialHours - 1);
                                courseTarget.tutorialHours = Math.max(0, courseTarget.tutorialHours - 1); 
                            }
                            break;
                        case 'Lab': 
                             totalHours = originalCourse.labHours;
                            if (totalHours > 0 && courseTarget.labHours > 0) {
                                courseTarget.weeklyLabHours = (courseTarget.weeklyLabHours / courseTarget.labHours) * (courseTarget.labHours - 2);
                                courseTarget.labHours = Math.max(0, courseTarget.labHours - 2); 
                            }
                            break;
                    }
                }
            });
        }
    });
    
    const makeupClasses = extraClasses.filter(ec => ec.reason === 'Conflict Resolution');
    makeupClasses.forEach(mc => {
        if (scheduledHoursTracker[mc.courseId]) {
            const course = courses.find(c => c.id === mc.courseId);
            if (course) {
                const targets = adjustedCourseTargets.get(mc.courseId)!;
                const scheduled = scheduledHoursTracker[mc.courseId];

                // Infer makeup class type. Prioritize filling classroom shortage, then tutorial.
                if (scheduled.classroom < targets.classroomHours && course.weeklyClassroomHours > 0) {
                    scheduled.classroom++;
                } else if (scheduled.tutorial < targets.tutorialHours && course.weeklyTutorialHours > 0) {
                    scheduled.tutorial++;
                } else if (scheduled.lab < targets.labHours && course.weeklyLabHours > 0) {
                    scheduled.lab+=2;
                }
            }
        }
    });

    const leaveMap = buildLeaveMap(facultyLeaves);

    const semesterWeeks = eachWeekOfInterval(
        { start: cleanSemesterStart, end: cleanSeniorSemesterEnd }, // Iterate through the longest possible semester
        { weekStartsOn: 1 } // Monday
    );

    for (const weekStart of semesterWeeks) {
        
        const weekDaysInRange = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });
        
        const allWeeklySessions: { course: Course, type: 'Classroom' | 'Tutorial' | 'Lab', duration: number }[] = [];
        courses.forEach(course => {
            const targets = adjustedCourseTargets.get(course.id)!;
            
            const adjustedWeeklyClassroom = targets.weeklyClassroomHours;
            const adjustedWeeklyTutorial = targets.weeklyTutorialHours;
            const adjustedWeeklyLab = targets.weeklyLabHours;

            if (scheduledHoursTracker[course.id].classroom < targets.classroomHours) {
                for (let i = 0; i < adjustedWeeklyClassroom; i++) allWeeklySessions.push({ course, type: 'Classroom', duration: 1 });
            }
            if (scheduledHoursTracker[course.id].tutorial < targets.tutorialHours) {
                for (let i = 0; i < adjustedWeeklyTutorial; i++) allWeeklySessions.push({ course, type: 'Tutorial', duration: 1 });
            }
            if (scheduledHoursTracker[course.id].lab < targets.labHours) {
                for (let i = 0; i < adjustedWeeklyLab / 2; i++) allWeeklySessions.push({ course, type: 'Lab', duration: 2 });
            }
        });

        // Separate senior and first semester sessions
        const seniorSessions = allWeeklySessions.filter(s => s.course.enrolledGroups.some(g => g.semester > 1));
        const firstSemSessions = allWeeklySessions.filter(s => s.course.enrolledGroups.every(g => g.semester === 1));
        
        const branchPriority = { 'CSE': 1, 'DSAI': 2, 'ECE': 3 };
        
        const sortSessions = (sessions: typeof seniorSessions) => {
            sessions.sort((a, b) => {
                const aIsSeniorMultiGroup = a.course.enrolledGroups.some(g => g.semester > 1) && a.course.enrolledGroups.length > 1;
                const bIsSeniorMultiGroup = b.course.enrolledGroups.some(g => g.semester > 1) && b.course.enrolledGroups.length > 1;

                if (aIsSeniorMultiGroup && !bIsSeniorMultiGroup) return -1;
                if (!aIsSeniorMultiGroup && bIsSeniorMultiGroup) return 1;

                const aIsMultiGroup = a.course.enrolledGroups.length > 1;
                const bIsMultiGroup = b.course.enrolledGroups.length > 1;

                if (aIsMultiGroup && !bIsMultiGroup) return -1;
                if (!aIsMultiGroup && bIsMultiGroup) return 1;

                // Then, prioritize by branch
                const branchA = a.course.enrolledGroups[0].branch;
                const branchB = b.course.enrolledGroups[0].branch;
                if (branchPriority[branchA] !== branchPriority[branchB]) {
                    return branchPriority[branchA] - branchPriority[branchB];
                }

                // Finally, sort by student count
                return b.course.studentCount - a.course.studentCount;
            });
            return sessions;
        };
        
        const seniorLabSessions = seniorSessions.filter(s => s.type === 'Lab').sort((a, b) => {
             // Prioritize hardware labs
             const aIsHardware = a.course.requiresHardwareLab;
             const bIsHardware = b.course.requiresHardwareLab;
             if (aIsHardware && !bIsHardware) return -1;
             if (!bIsHardware && aIsHardware) return 1;

             // Prioritize labs for courses with multiple groups
             const aIsMultiGroup = a.course.enrolledGroups.length > 1;
             const bIsMultiGroup = b.course.enrolledGroups.length > 1;
             if (aIsMultiGroup && !bIsMultiGroup) return -1;
             if (!bIsMultiGroup && aIsMultiGroup) return 1;
             return 0; // No other sorting for labs
        });
        const seniorClassAndTutSessions = sortSessions(seniorSessions.filter(s => s.type !== 'Lab'));

        const weekSchedule: { [day: string]: { [time: string]: TimetableEntry[] | undefined } } = {};
        const scheduleTracker: { [day: string]: { [time: string]: { faculty: Set<string>, rooms: Set<string>, studentGroups: Map<string, string | null>, classTypes: Map<string, 'Classroom' | 'Lab' | 'Tutorial'>, groupIdsByFaculty: Map<string, Set<string>>, courseIds: Set<string> } } } = {};
        
        const allDaysOfWeekForScheduling = weekDaysInRange
            .map(d => ({ date: d, dayName: daysOfWeek[getDay(d)] }))
            .filter(({ date }) => {
                const day = getDay(date);
                // Standard Mon-Fri
                if (day > 0 && day < 6) return true;
                return false;
            });

        const dailyCourseSessionTypeTracker: { [dayName: string]: { [courseId: string]: Set<'Classroom' | 'Tutorial' | 'Lab'> } } = {};

        allDaysOfWeekForScheduling.forEach(({ dayName }) => {
            weekSchedule[dayName] = {};
            scheduleTracker[dayName] = {};
            dailyCourseSessionTypeTracker[dayName] = {};
            timeSlots.forEach(time => scheduleTracker[dayName][time] = { faculty: new Set(), rooms: new Set(), studentGroups: new Map(), classTypes: new Map(), groupIdsByFaculty: new Map(), courseIds: new Set() });
        });

        const studentDailyLoad: { [day: string]: { [groupId: string]: number } } = {};
        const facultyDailyLoad: { [day: string]: { [facultyId: string]: number } } = {};
        const facultyGroupHours: { [day: string]: { [facultyId: string]: { [groupId: string]: number } } } = {};

        allDaysOfWeekForScheduling.forEach(({ dayName }) => {
            studentDailyLoad[dayName] = {};
            facultyDailyLoad[dayName] = {};
            facultyGroupHours[dayName] = {};
        });

        const scheduleSession = (session: { course: Course, type: 'Classroom' | 'Tutorial' | 'Lab', duration: number }) => {
            const { course, type, duration } = session;

            const assignedFaculty = faculty.find(f => f.courses.includes(course.id));
            if (!assignedFaculty) { addConflict({ type: 'Missing Faculty', description: `Course ${course.code} has no assigned faculty.`, details: { courseId: course.id } }); return; }
            
            const studentGroupIds = course.enrolledGroups.map(g => `${g.semester}-${g.branch}${g.section ? `-${g.section}`: ''}`);
            studentGroupIds.forEach(id => { allDaysOfWeekForScheduling.forEach(({ dayName }) => { if (!studentDailyLoad[dayName][id]) studentDailyLoad[dayName][id] = 0; }); });
            allDaysOfWeekForScheduling.forEach(({ dayName }) => { 
                if (!facultyDailyLoad[dayName][assignedFaculty.id]) facultyDailyLoad[dayName][assignedFaculty.id] = 0; 
                if (!facultyGroupHours[dayName][assignedFaculty.id]) facultyGroupHours[dayName][assignedFaculty.id] = {};
                studentGroupIds.forEach(id => {
                    if (!facultyGroupHours[dayName][assignedFaculty.id][id]) facultyGroupHours[dayName][assignedFaculty.id][id] = 0;
                });
            });
            
            let studentCountForRoom = course.studentCount;
            const hasSections = course.enrolledGroups.some(g => g.section);
            if (hasSections && (type === 'Lab' || type === 'Tutorial')) {
                const sectionCount = new Set(course.enrolledGroups.map(g => g.section).filter(Boolean)).size;
                if (sectionCount > 0) studentCountForRoom = Math.ceil(course.studentCount / sectionCount);
            }
            
            let bestSlot: { dayName: string; time: string; room: Room; score: number } | null = null;

            for (const { dayName, date } of allDaysOfWeekForScheduling) {
                if (!dailyCourseSessionTypeTracker[dayName][course.id]) {
                    dailyCourseSessionTypeTracker[dayName][course.id] = new Set();
                }

                // RULE: No two sessions of the same type for the same course on the same day.
                if (dailyCourseSessionTypeTracker[dayName][course.id].has(type)) {
                    continue;
                }

                const cleanDate = new Date(date);
                cleanDate.setHours(0, 0, 0, 0);
                const cleanCourseStart = new Date(course.startDate);
                cleanCourseStart.setHours(0, 0, 0, 0);

                if (cleanDate < cleanCourseStart) continue;

                const isSeniorCourse = course.enrolledGroups.some(g => g.semester > 1);
                const courseEndDate = isSeniorCourse ? cleanSeniorSemesterEnd : cleanSemesterEnd;
                if (cleanDate < cleanSemesterStart || cleanDate > courseEndDate) continue;
                
                let isAfterMidSem = false;
                for (const group of course.enrolledGroups) {
                    const examSchedule = examScheduleMap.get(`${group.semester}-${group.branch}`);
                    if (examSchedule) {
                        const midSemDate = new Date(examSchedule.midSemDate); midSemDate.setHours(0,0,0,0);
                        const endSemDate = new Date(examSchedule.endSemDate); endSemDate.setHours(23,59,59,999);
                        if (course.duration === 'Half-1' && cleanDate > midSemDate) continue;
                        if (course.duration === 'Half-2' && cleanDate < midSemDate) continue;
                        if (cleanDate > endSemDate) continue;
                        if (cleanDate > midSemDate) isAfterMidSem = true;
                    }
                }
                
                if (isHoliday(date, course, holidays) || isOnLeave(assignedFaculty.id, date, leaveMap)) continue;

                const isFirstSemDsaiOrEce = course.enrolledGroups.length > 0 &&
                    course.enrolledGroups.some(g => g.semester === 1 && (g.branch === 'DSAI' || g.branch === 'ECE'));
                
                const applicableTimeSlots = timeSlots;
                
                for (let i = 0; i < applicableTimeSlots.length; i++) {
                    const time = applicableTimeSlots[i];
                    
                    if (time === '09:00-10:00' && isFirstSemDsaiOrEce) {
                        continue;
                    }

                    // RULE: After 1st sem mid-sem, no multi-group (>2) courses in 9-10 slot.
                    const isFirstSemCourse = course.enrolledGroups.every(g => g.semester === 1);
                    if (isFirstSemCourse && isAfterMidSem && course.enrolledGroups.length > 2 && time === '09:00-10:00') {
                        continue;
                    }

                    // RULE: Reserve 6-7pm slot for 1st sem DSAI/ECE only (and conflict resolution, handled elsewhere)
                    if (time === '18:00-19:00' && !isFirstSemDsaiOrEce) {
                        continue;
                    }
                    
                    if (isFirstSemCourse && isAfterMidSem && time === '18:00-19:00') {
                        continue;
                    }

                    // RULE: No 2 consecutive hours with the same group
                    if (i > 0) {
                        const prevSlot = applicableTimeSlots[i-1];
                        const facultyGroupsPrevSlot = scheduleTracker[dayName][prevSlot]?.groupIdsByFaculty.get(assignedFaculty.id);
                        if (facultyGroupsPrevSlot) {
                            const groupConflict = studentGroupIds.some(id => facultyGroupsPrevSlot.has(id));
                            if (groupConflict) continue;
                        }
                    }

                    // RULE: No two sessions for the same course consecutively
                    if (i > 0) {
                        const prevSlot = applicableTimeSlots[i - 1];
                        if(scheduleTracker[dayName][prevSlot]?.courseIds.has(course.id)) {
                            continue;
                        }
                    }
                    if (i < applicableTimeSlots.length - 1) {
                         const nextSlot = applicableTimeSlots[i + 1];
                         if (scheduleTracker[dayName][nextSlot]?.courseIds.has(course.id)) {
                            continue;
                         }
                    }
                    
                    // RULE: No 3 consecutive teaching hours for faculty (including labs)
                    const facultyId = assignedFaculty.id;
                    const isFacultyBusy = (slot: string) => scheduleTracker[dayName][slot]?.faculty.has(facultyId);
                    const isFacultyLab = (slot: string) => scheduleTracker[dayName][slot]?.classTypes.get(facultyId) === 'Lab';

                    // Check if current slot is already busy
                    if (isFacultyBusy(time)) continue; 
                    if (type === 'Lab' && (i + 1 >= applicableTimeSlots.length || isFacultyBusy(applicableTimeSlots[i+1]))) continue;

                    if (type === 'Lab') { // If scheduling a 2-hr lab
                        const prevSlot = i > 0 ? applicableTimeSlots[i - 1] : null;
                        const nextSlot = i + 2 < applicableTimeSlots.length ? applicableTimeSlots[i + 2] : null;

                        if (prevSlot && isFacultyBusy(prevSlot)) continue; // Slot before lab is busy
                        if (nextSlot && isFacultyBusy(nextSlot)) continue; // Slot after lab is busy

                    } else { // If scheduling a 1-hr class/tutorial
                        const prevSlot = i > 0 ? applicableTimeSlots[i-1] : null;
                        const prev2Slot = i > 1 ? applicableTimeSlots[i-2] : null;
                        const nextSlot = i + 1 < applicableTimeSlots.length ? applicableTimeSlots[i+1] : null;

                        // Check for lab immediately before this class
                        if (prevSlot && isFacultyLab(prevSlot)) {
                             if (prev2Slot && isFacultyBusy(prev2Slot) && scheduleTracker[dayName][prevSlot].classTypes.get(facultyId) === 'Lab' && scheduleTracker[dayName][prev2Slot].classTypes.get(facultyId) === 'Lab') {
                                continue;
                            }
                        }
                        // Check for lab immediately after this class
                        if (nextSlot && isFacultyLab(nextSlot)) continue;

                        // Check for 2 classes before or after this one
                        if (prevSlot && prev2Slot && isFacultyBusy(prevSlot) && isFacultyBusy(prev2Slot) && !isFacultyLab(prevSlot) && !isFacultyLab(prev2Slot)) continue;
                        if (nextSlot && isFacultyBusy(nextSlot) && isFacultyBusy(time) && !isFacultyLab(nextSlot)) {
                           const next2Slot = i + 2 < applicableTimeSlots.length ? applicableTimeSlots[i + 2] : null;
                           if (next2Slot && isFacultyBusy(next2Slot) && !isFacultyLab(next2Slot)) continue;
                        }

                        if ((prevSlot && isFacultyBusy(prevSlot) && !isFacultyLab(prevSlot)) && (nextSlot && isFacultyBusy(nextSlot) && !isFacultyLab(nextSlot))) continue;
                    }


                    if (isCancelled(date, time, cancellations)) continue;
                    
                    const hasStudentConflict = (slot: string) => studentGroupIds.some(groupId => {
                        const scheduledBasketId = scheduleTracker[dayName][slot]?.studentGroups.get(groupId);
                        return scheduledBasketId !== undefined && (course.basketId ? course.basketId !== scheduledBasketId : true);
                    });

                    let isConflict = false;
                    if (duration === 1) {
                        if (!scheduleTracker[dayName][time]) continue;
                        isConflict = scheduleTracker[dayName][time].faculty.has(assignedFaculty.id) || hasStudentConflict(time);
                    } else { 
                        if (i >= applicableTimeSlots.length - 1 || time === '11:00-12:00' || time === '15:30-16:30') continue;
                        const time2 = applicableTimeSlots[i + 1];
                        if (isCancelled(date, time2, cancellations)) continue;
                        if (!scheduleTracker[dayName][time] || !scheduleTracker[dayName][time2]) continue;
                        isConflict = scheduleTracker[dayName][time].faculty.has(assignedFaculty.id) || scheduleTracker[dayName][time2].faculty.has(assignedFaculty.id) || hasStudentConflict(time) || hasStudentConflict(time2);
                    }
                    if (isConflict) continue;

                    let availableRoom: Room | undefined;
                    const findSmallestRoom = (suitableRooms: Room[], dayName: string, timeSlotsToCheck: string[]) => {
                        return suitableRooms.find(r => timeSlotsToCheck.every(t => !scheduleTracker[dayName][t]?.rooms.has(r.id)));
                    };

                    if (type === 'Lab') {
                        const requiredLabType = course.requiresHardwareLab ? 'Hardware Lab' : 'Software Lab';
                        const suitableRooms = rooms.filter(r => r.type === requiredLabType && r.capacity >= studentCountForRoom).sort((a, b) => a.capacity - b.capacity);
                        if (suitableRooms.length === 0) { addConflict({ type: 'Resource Shortage', description: `No suitable ${requiredLabType} rooms for ${course.code}.`, details: { courseId: course.id } }); continue; }
                        const time2 = applicableTimeSlots[i + 1];
                        availableRoom = findSmallestRoom(suitableRooms, dayName, [time, time2]);
                    } else {
                        const suitableRooms = rooms.filter(r => r.type === 'Classroom' && r.capacity >= studentCountForRoom).sort((a, b) => a.capacity - b.capacity);
                        if (suitableRooms.length === 0) { addConflict({ type: 'Resource Shortage', description: `No suitable classroom for ${course.code} (capacity: ${studentCountForRoom}).`, details: { courseId: course.id } }); continue; }
                        availableRoom = findSmallestRoom(suitableRooms, dayName, [time]);
                    }

                    if (availableRoom) {
                        let score = 100;
                        studentGroupIds.forEach(id => { score -= (studentDailyLoad[dayName][id] || 0) * 20; });
                        score -= (facultyDailyLoad[dayName][assignedFaculty.id] || 0) * 5;
                        if (dayName === 'Monday' || dayName === 'Friday') score -= 5;
                        if (i > 0 && studentGroupIds.some(id => scheduleTracker[dayName][applicableTimeSlots[i-1]]?.studentGroups.has(id))) score += 30;
                        if (i < applicableTimeSlots.length - 1 && studentGroupIds.some(id => scheduleTracker[dayName][applicableTimeSlots[i+1]]?.studentGroups.has(id))) score += 30;
                        if (course.basketId) { const timeIndex = applicableTimeSlots.indexOf(time); if (timeIndex < 3) score -= 50; else score += 30; }
                        if (course.enrolledGroups.length > 0 && course.enrolledGroups.every(g => g.semester === 1) && isHoliday(date, course, holidays)) score += 500;
                        
                        // Minor priority for 1st sem CSE labs in 9-11 slot after mid-sem
                        const isFirstSemCse = course.enrolledGroups.every(g => g.semester === 1 && g.branch === 'CSE');
                        if (isFirstSemCse && type === 'Lab' && isAfterMidSem && time === '09:00-10:00') {
                            score += 20; // Add a minor bonus
                        }

                        if (!bestSlot || score > bestSlot.score) bestSlot = { dayName, time, room: availableRoom, score };
                    }
                }
            }

            if (bestSlot) {
                const { dayName, time, room } = bestSlot;
                const newEntry: TimetableEntry = { courseId: course.id, facultyId: assignedFaculty.id, roomId: room.id, type };
                if (duration === 1) {
                    if (!weekSchedule[dayName][time]) weekSchedule[dayName][time] = [];
                    weekSchedule[dayName][time]!.push(newEntry);
                    studentGroupIds.forEach(id => {
                        scheduleTracker[dayName][time].studentGroups.set(id, course.basketId || null);
                        studentDailyLoad[dayName][id]++;
                        facultyGroupHours[dayName][assignedFaculty.id][id]++;
                    });
                    scheduleTracker[dayName][time].rooms.add(room.id);
                    scheduleTracker[dayName][time].faculty.add(assignedFaculty.id);
                    scheduleTracker[dayName][time].courseIds.add(course.id);
                    dailyCourseSessionTypeTracker[dayName][course.id].add(type);
                    scheduleTracker[dayName][time].classTypes.set(assignedFaculty.id, type);
                    if (!scheduleTracker[dayName][time].groupIdsByFaculty.has(assignedFaculty.id)) scheduleTracker[dayName][time].groupIdsByFaculty.set(assignedFaculty.id, new Set());
                    studentGroupIds.forEach(id => scheduleTracker[dayName][time].groupIdsByFaculty.get(assignedFaculty.id)!.add(id));
                    facultyDailyLoad[dayName][assignedFaculty.id]++;
                } else {
                    const time2 = timeSlots[timeSlots.indexOf(time) + 1];
                    [time, time2].forEach(slot => {
                        if (!weekSchedule[dayName][slot]) weekSchedule[dayName][slot] = [];
                        weekSchedule[dayName][slot]!.push(newEntry);
                        studentGroupIds.forEach(id => scheduleTracker[dayName][slot].studentGroups.set(id, course.basketId || null));
                        scheduleTracker[dayName][slot].rooms.add(room.id);
                        scheduleTracker[dayName][slot].faculty.add(assignedFaculty.id);
                        scheduleTracker[dayName][slot].courseIds.add(course.id);
                        scheduleTracker[dayName][slot].classTypes.set(assignedFaculty.id, type);
                        if (!scheduleTracker[dayName][slot].groupIdsByFaculty.has(assignedFaculty.id)) scheduleTracker[dayName][slot].groupIdsByFaculty.set(assignedFaculty.id, new Set());
                        studentGroupIds.forEach(id => scheduleTracker[dayName][slot].groupIdsByFaculty.get(assignedFaculty.id)!.add(id));
                    });
                    studentGroupIds.forEach(id => { 
                        studentDailyLoad[dayName][id] += 2; 
                        facultyGroupHours[dayName][assignedFaculty.id][id] += 2;
                    });
                    facultyDailyLoad[dayName][assignedFaculty.id] += 2;
                    dailyCourseSessionTypeTracker[dayName][course.id].add(type);
                }
                return true;
            }
            return false;
        };

        // Schedule senior labs
        const unScheduledSeniorLabs = seniorLabSessions.filter(session => !scheduleSession(session));

        // Schedule senior classes and tutorials
        const unScheduledSeniorClasses = seniorClassAndTutSessions.filter(session => !scheduleSession(session));

        const firstSemCseSessions = firstSemSessions.filter(s => s.course.enrolledGroups.some(g => g.branch === 'CSE'));
        const firstSemOtherSessions = firstSemSessions.filter(s => s.course.enrolledGroups.every(g => g.branch !== 'CSE'));
        
        // Special handling for 1st Sem CSE at 9-10 AM
        for (const { dayName, date } of allDaysOfWeekForScheduling) {
            const cleanDate = new Date(date);
            cleanDate.setHours(0, 0, 0, 0);
            const slot9to10 = '09:00-10:00';
            const nextSlot = '10:00-11:00';

            const isSlotOccupiedByCse = ["1-CSE-A", "1-CSE-B", "1-CSE-C"].some(group =>
                scheduleTracker[dayName][slot9to10]?.studentGroups.has(group)
            );
            if (isSlotOccupiedByCse) continue;
            
            const isDayInvalid = isCancelled(date, slot9to10, cancellations) || 
                                 (firstSemCseSessions.length > 0 && isHoliday(date, firstSemCseSessions[0].course, holidays));

            if (isDayInvalid) continue;
        
            let scheduledInSlot = false;
            for (let i = 0; i < firstSemCseSessions.length; i++) {
                const session = firstSemCseSessions[i];
                const { course, type, duration } = session;

                if (!dailyCourseSessionTypeTracker[dayName][course.id]) {
                    dailyCourseSessionTypeTracker[dayName][course.id] = new Set();
                }

                if (dailyCourseSessionTypeTracker[dayName][course.id].has(type)) continue;

                const cleanCourseStart = new Date(course.startDate);
                cleanCourseStart.setHours(0, 0, 0, 0);
                if (cleanDate < cleanCourseStart) continue;

                const assignedFaculty = faculty.find(f => f.courses.includes(course.id));
                if (!assignedFaculty || isOnLeave(assignedFaculty.id, date, leaveMap) || scheduleTracker[dayName][slot9to10]?.faculty.has(assignedFaculty.id)) continue;
                
                let availableRoom: Room | undefined;
                if (type === 'Lab') {
                    if (isCancelled(date, nextSlot, cancellations) || scheduleTracker[dayName][nextSlot]?.faculty.has(assignedFaculty.id)) continue;
                    const requiredLabType = course.requiresHardwareLab ? 'Hardware Lab' : 'Software Lab';
                    const suitableRooms = rooms.filter(r => r.type === requiredLabType && r.capacity >= course.studentCount).sort((a, b) => a.capacity - b.capacity);
                    availableRoom = suitableRooms.find(r => ![slot9to10, nextSlot].some(s => scheduleTracker[dayName][s]?.rooms.has(r.id)));
                } else {
                    const suitableRooms = rooms.filter(r => r.type === 'Classroom' && r.capacity >= course.studentCount).sort((a, b) => a.capacity - b.capacity);
                    availableRoom = suitableRooms.find(r => !scheduleTracker[dayName][slot9to10]?.rooms.has(r.id));
                }

                if (availableRoom) {
                    const newEntry: TimetableEntry = { courseId: course.id, facultyId: assignedFaculty.id, roomId: availableRoom.id, type };
                    const studentGroupIds = course.enrolledGroups.map(g => `${g.semester}-${g.branch}${g.section ? `-${g.section}` : ''}`);

                    if (duration === 1) { // Classroom or Tutorial
                        if (!weekSchedule[dayName][slot9to10]) weekSchedule[dayName][slot9to10] = [];
                        weekSchedule[dayName][slot9to10]!.push(newEntry);
                        studentGroupIds.forEach(id => { scheduleTracker[dayName][slot9to10].studentGroups.set(id, course.basketId || null); if (!studentDailyLoad[dayName][id]) studentDailyLoad[dayName][id] = 0; studentDailyLoad[dayName][id]++; });
                        scheduleTracker[dayName][slot9to10].rooms.add(availableRoom.id);
                        scheduleTracker[dayName][slot9to10].faculty.add(assignedFaculty.id);
                        scheduleTracker[dayName][slot9to10].courseIds.add(course.id);
                        dailyCourseSessionTypeTracker[dayName][course.id].add(type);
                    } else { // Lab
                        [slot9to10, nextSlot].forEach(slot => {
                            if (!weekSchedule[dayName][slot]) weekSchedule[dayName][slot] = [];
                            weekSchedule[dayName][slot]!.push(newEntry);
                            studentGroupIds.forEach(id => { if (!scheduleTracker[dayName][slot]) scheduleTracker[dayName][slot] = { faculty: new Set(), rooms: new Set(), studentGroups: new Map(), classTypes: new Map(), groupIdsByFaculty: new Map(), courseIds: new Set() }; scheduleTracker[dayName][slot].studentGroups.set(id, course.basketId || null) });
                            scheduleTracker[dayName][slot].rooms.add(availableRoom!.id);
                            scheduleTracker[dayName][slot].faculty.add(assignedFaculty.id);
                            scheduleTracker[dayName][slot].courseIds.add(course.id);
                        });
                        studentGroupIds.forEach(id => { if (!studentDailyLoad[dayName][id]) studentDailyLoad[dayName][id] = 0; studentDailyLoad[dayName][id] += 2; });
                        dailyCourseSessionTypeTracker[dayName][course.id].add(type);
                    }
                    firstSemCseSessions.splice(i, 1);
                    scheduledInSlot = true;
                    break;
                }
            }
        }

        const unScheduledFirstSem = firstSemOtherSessions.concat(firstSemCseSessions).filter(session => !scheduleSession(session));

        // Combine all unscheduled sessions and process them for timetable
        const allUnscheduled = [...unScheduledSeniorLabs, ...unScheduledSeniorClasses, ...unScheduledFirstSem];

        for (const { date, dayName } of allDaysOfWeekForScheduling) {
            const dateStr = format(date, 'yyyy-MM-dd');
            const weeklyDaySchedule = weekSchedule[dayName];
            if (!weeklyDaySchedule) continue;

            const processedInDay = new Set<string>();

            for (const time of timeSlots) {
                const entries = weeklyDaySchedule[time];
                if (entries) {
                    for (const entry of entries) {
                        const sessionKey = `${entry.courseId}-${entry.type}-${entry.roomId}`;
                        if (processedInDay.has(sessionKey)) continue;

                        const targets = adjustedCourseTargets.get(entry.courseId)!;
                        let shouldSchedule = false;

                        switch (entry.type) {
                            case 'Classroom': shouldSchedule = scheduledHoursTracker[entry.courseId].classroom < targets.classroomHours; break;
                            case 'Tutorial': shouldSchedule = scheduledHoursTracker[entry.courseId].tutorial < targets.tutorialHours; break;
                            case 'Lab': shouldSchedule = scheduledHoursTracker[entry.courseId].lab < targets.labHours; break;
                        }

                        if (shouldSchedule) {
                            processedInDay.add(sessionKey);
                            if (!timetable[dateStr]) timetable[dateStr] = {};
                            if (!timetable[dateStr][time]) timetable[dateStr][time] = [];
                            timetable[dateStr][time]!.push(entry);

                            if (entry.type === 'Lab') {
                                const timeIndex = timeSlots.indexOf(time);
                                if (timeIndex + 1 < timeSlots.length) {
                                    const nextTime = timeSlots[timeIndex + 1];
                                    if (!timetable[dateStr][nextTime]) timetable[dateStr][nextTime] = [];
                                    timetable[dateStr][nextTime]!.push(entry);
                                }
                            }
                            switch (entry.type) {
                                case 'Classroom': scheduledHoursTracker[entry.courseId].classroom += 1; break;
                                case 'Tutorial': scheduledHoursTracker[entry.courseId].tutorial += 1; break;
                                case 'Lab': scheduledHoursTracker[entry.courseId].lab += 2; break;
                            }
                        }
                    }
                }
            }
        }
    }
    
    // Final conflict check after all scheduling is done
    const examViolationHours: Record<string, { afterMidSem: number, beforeMidSem: number, afterEndSem: number }> = {};
    courses.forEach(c => examViolationHours[c.id] = { afterMidSem: 0, beforeMidSem: 0, afterEndSem: 0 });

    Object.entries(timetable).forEach(([dateStr, daySchedule]) => {
        const date = new Date(dateStr);
        date.setHours(12, 0, 0, 0); // Set date to noon to avoid timezone issues

        const processedEntriesInDay = new Set<string>();

        Object.values(daySchedule).forEach(slotEntries => {
            (slotEntries || []).forEach(entry => {
                const uniqueEntryKey = `${entry.courseId}-${entry.type}-${entry.roomId}`;
                if (processedEntriesInDay.has(uniqueEntryKey)) return;
                
                const course = courses.find(c => c.id === entry.courseId);
                if (!course) return;

                // This check should only be done once per course, per day, regardless of groups
                if (course.enrolledGroups.length > 0) {
                    processedEntriesInDay.add(uniqueEntryKey);
                    const representativeGroup = course.enrolledGroups[0];
                    const examSchedule = examScheduleMap.get(`${representativeGroup.semester}-${representativeGroup.branch}`);
                    
                    if (examSchedule) {
                        const midSemDate = new Date(examSchedule.midSemDate);
                        midSemDate.setHours(0, 0, 0, 0);
                        const endSemDate = new Date(examSchedule.endSemDate);
                        endSemDate.setHours(23, 59, 59, 999);
                        const duration = entry.type === 'Lab' ? 2 : 1;

                        if (course.duration === 'Half-1' && date > midSemDate) {
                            examViolationHours[course.id].afterMidSem += duration;
                        }
                        if (course.duration === 'Half-2' && date < midSemDate) {
                            examViolationHours[course.id].beforeMidSem += duration;
                        }
                        if (date > endSemDate) {
                            examViolationHours[course.id].afterEndSem += duration;
                        }
                    }
                }
            });
        });
    });
    
    courses.forEach(course => {
        const violations = examViolationHours[course.id];
        if (violations.afterMidSem > 0) {
            addConflict({ type: 'Scheduling Period Violation', description: `First-half course ${course.code} has ${Math.round(violations.afterMidSem / course.enrolledGroups.length)} hour(s) scheduled after the mid-semester exam date.`, details: { courseId: course.id, violationHours: Math.round(violations.afterMidSem / course.enrolledGroups.length) } });
        }
        if (violations.beforeMidSem > 0) {
            addConflict({ type: 'Scheduling Period Violation', description: `Second-half course ${course.code} has ${Math.round(violations.beforeMidSem / course.enrolledGroups.length)} hour(s) scheduled before the mid-semester exam date.`, details: { courseId: course.id, violationHours: Math.round(violations.beforeMidSem / course.enrolledGroups.length) } });
        }
        if (violations.afterEndSem > 0) {
            addConflict({ type: 'Scheduling Period Violation', description: `Course ${course.code} has ${Math.round(violations.afterEndSem / course.enrolledGroups.length)} hour(s) scheduled after the end-semester exam date.`, details: { courseId: course.id, violationHours: Math.round(violations.afterEndSem / course.enrolledGroups.length) } });
        }

        const scheduled = scheduledHoursTracker[course.id];
        const targets = adjustedCourseTargets.get(course.id)!;
        
        const classDeficit = targets.classroomHours - scheduled.classroom;
        const tutDeficit = targets.tutorialHours - scheduled.tutorial;
        const labDeficit = targets.labHours - scheduled.lab;

        if (classDeficit > 0) {
            addConflict({
                type: 'Semester Hour Shortage',
                description: `Course ${course.code} is short by ${classDeficit} classroom hour(s) for the semester.`,
                details: { courseId: course.id, deficit: classDeficit, type: 'Classroom' }
            });
        }
        if (tutDeficit > 0) {
            addConflict({
                type: 'Semester Hour Shortage',
                description: `Course ${course.code} is short by ${tutDeficit} tutorial hour(s) for the semester.`,
                details: { courseId: course.id, deficit: tutDeficit, type: 'Tutorial' }
            });
        }
        if (labDeficit > 0) {
            addConflict({
                type: 'Semester Hour Shortage',
                description: `Course ${course.code} is short by ${labDeficit} lab hour(s) for the semester.`,
                details: { courseId: course.id, deficit: labDeficit, type: 'Lab' }
            });
        }
    });

    return { timetable, conflicts: Array.from(uniqueConflicts.values()) };
}
