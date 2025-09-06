

export type StudentGroup = {
  semester: number;
  branch: 'CSE' | 'DSAI' | 'ECE';
  section?: string;
};

export type Faculty = {
  id: string;
  name: string;
  courses: string[]; // array of course IDs
  password?: string;
};

export type Basket = {
  id: string;
  name: string;
  code: string;
};

export type Course = {
  id: string;
  name:string;
  code: string;
  enrolledGroups: StudentGroup[];
  studentCount: number;
  classroomHours: number; // Total for the semester
  tutorialHours: number; // Total for the semester
  labHours: number; // Total for the semester
  weeklyClassroomHours: number;
  weeklyTutorialHours: number;
  weeklyLabHours: number;
  startDate: Date;
  duration: 'Full' | 'Half-1' | 'Half-2';
  basketId?: string;
  requiresHardwareLab?: boolean;
};

export type Room = {
  id: string;
  name: string;
  type: 'Classroom' | 'Software Lab' | 'Hardware Lab';
  capacity: number;
};

export type Holiday = {
  id: string;
  dateRange: { from: Date; to?: Date };
  name: string;
  scope: 'all_except_first_sem' | 'only_first_sem';
};

export type Cancellation = {
  id: string;
  date: Date;
  timeSlot: string;
  reason: string;
  status: 'Rescheduled' | 'Cancelled' | 'Postponed';
  extraClassId?: string;
  // Details of the class that was cancelled, if applicable
  cancelledClasses?: { courseId: string; classType: 'Classroom' | 'Tutorial' | 'Lab' }[];
};

export type FacultyLeave = {
  id: string;
  facultyId: string;
  dateRange: { from: Date; to?: Date };
  reason: string;
};

export type ExtraClass = {
  id: string;
  courseId: string;
  facultyId?: string;
  date: Date;
  timeSlot: string;
  roomName: string;
  reason: string;
  linkedCancellationId?: string;
};

export type SemesterSettings = {
  startDate: Date;
  endDate: Date;
  seniorEndDate: Date;
}

export type ExamSchedule = {
  id: string; // e.g., "1-CSE"
  semester: number;
  branch: 'CSE' | 'DSAI' | 'ECE';
  midSemDate: Date;
  endSemDate: Date;
};

export type TimetableEntry = {
  courseId: string;
  facultyId?: string;
  roomId: string;
  type: 'Classroom' | 'Lab' | 'Tutorial';
};

export type Timetable = {
  [date: string]: { // YYYY-MM-DD
    [timeSlot: string]: TimetableEntry[] | undefined;
  };
};

export const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const timeSlots = ['09:00-10:00', '10:00-11:00', '11:00-12:00', '13:30-14:30', '14:30-15:30', '15:30-16:30', '17:00-18:00', '18:00-19:00'];
export const standardTimeSlots = timeSlots.slice(0, 7); // Excludes the 18:00-19:00 slot
export const displayTimeSlots = ['09:00-10:00', '10:00-11:00', '11:00-12:00', '12:00-13:30', '13:30-14:30', '14:30-15:30', '15:30-16:30', '16:30-17:00', '17:00-18:00', '18:00-19:00'];
export const semesters = [1, 2, 3, 4, 5, 6, 7, 8];
export const branches = ['CSE', 'DSAI', 'ECE'] as const;
export const sections = ['A', 'B', 'C'];

export type TimetableConflict = {
  type: string;
  description: string;
  details: Record<string, any>;
};

export type FeedbackItem = {
  id: string;
  name: string;
  email: string;
  description: string;
  images: {
    name: string;
    url: string;
  }[];
};

export type Notification = {
  id: string;
  message: string;
  timestamp: number;
};
