

'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect, useMemo, useRef } from 'react';
import { Course, Faculty, Room, Timetable, TimetableConflict, Holiday, Cancellation, FacultyLeave, SemesterSettings, FeedbackItem, ExtraClass, TimetableEntry, Basket } from '@/lib/types';
import { generateTimetableFromData } from '@/lib/scheduler';
import { add } from 'date-fns';
import { db } from '@/lib/firebase';
import { collection, doc, getDocs, writeBatch, setDoc, deleteDoc, Timestamp, getDoc } from 'firebase/firestore';
import { Loader } from '@/components/ui/loader';

interface TimetableContextType {
  courses: Course[];
  setCourses: React.Dispatch<React.SetStateAction<Course[]>>;
  faculty: Faculty[];
  setFaculty: React.Dispatch<React.SetStateAction<Faculty[]>>;
  facultyMap: Record<string, Faculty>;
  courseMap: Record<string, Course>;
  rooms: Room[];
  setRooms: React.Dispatch<React.SetStateAction<Room[]>>;
  holidays: Holiday[];
  setHolidays: React.Dispatch<React.SetStateAction<Holiday[]>>;
  cancellations: Cancellation[];
  setCancellations: React.Dispatch<React.SetStateAction<Cancellation[]>>;
  facultyLeaves: FacultyLeave[];
  setFacultyLeaves: React.Dispatch<React.SetStateAction<FacultyLeave[]>>;
  semesterSettings: SemesterSettings;
  setSemesterSettings: React.Dispatch<React.SetStateAction<SemesterSettings>>;
  timetable: Timetable;
  setTimetable: React.Dispatch<React.SetStateAction<Timetable>>;
  conflicts: TimetableConflict[];
  setConflicts: React.Dispatch<React.SetStateAction<TimetableConflict[]>>;
  feedbackItems: FeedbackItem[];
  setFeedbackItems: React.Dispatch<React.SetStateAction<FeedbackItem[]>>;
  extraClasses: ExtraClass[];
  setExtraClasses: React.Dispatch<React.SetStateAction<ExtraClass[]>>;
  baskets: Basket[];
  setBaskets: React.Dispatch<React.SetStateAction<Basket[]>>;
  facultyCancelAndReschedule: (
    originalClass: { entry: TimetableEntry; date: Date; timeSlot: string },
    cancellationReason: string,
    makeupClass: Omit<ExtraClass, 'id' | 'facultyId' | 'courseId' | 'linkedCancellationId'>
  ) => void;
  facultyPermanentCancel: (
    entry: TimetableEntry,
    date: Date,
    timeSlot: string,
  ) => void;
  revertPermanentCancellation: (cancellationId: string) => void;
  revertExtraClass: (extraClassId: string) => void;
  updateFacultyPassword: (facultyId: string, newPassword: string) => void;
  loading: boolean;
}

const TimetableContext = createContext<TimetableContextType | undefined>(undefined);

// Helper function to convert Firestore Timestamps to JS Dates
const deserializeDates = (data: any): any => {
    if (data === null || typeof data !== 'object') {
        return data;
    }

    if (data instanceof Timestamp) {
        return data.toDate();
    }

    if (Array.isArray(data)) {
        return data.map(deserializeDates);
    }
    
    const deserializedObject: { [key: string]: any } = {};
    for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            if (data[key] instanceof Timestamp) {
                deserializedObject[key] = data[key].toDate();
            } else if (typeof data[key] === 'object') {
                deserializedObject[key] = deserializeDates(data[key]);
            } else {
                deserializedObject[key] = data[key];
            }
        }
    }
    return deserializedObject;
};

// Helper function to convert JS Dates to Firestore Timestamps
const serializeDates = (data: any): any => {
    if (data === null || typeof data !== 'object') {
        return data;
    }

    if (data instanceof Date) {
        return Timestamp.fromDate(data);
    }
    
    if (Array.isArray(data)) {
        return data.map(serializeDates);
    }

    const serializedObject: { [key: string]: any } = {};
    for (const key in data) {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
             if (data[key] instanceof Date) {
                serializedObject[key] = Timestamp.fromDate(data[key]);
            } else if (typeof data[key] === 'object') {
                serializedObject[key] = serializeDates(data[key]);
            } else {
                serializedObject[key] = data[key];
            }
        }
    }
    return serializedObject;
};

const syncCollection = async (collectionName: string, data: any[]) => {
    const collectionRef = collection(db, collectionName);
    const batch = writeBatch(db);
    
    // Get all existing documents to delete them
    const snapshot = await getDocs(collectionRef);
    snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
    });
    
    // Add all current state documents
    data.forEach(item => {
        const docRef = doc(collectionRef, item.id);
        batch.set(docRef, serializeDates(item));
    });
    
    await batch.commit();
};

export const TimetableProvider = ({ children }: { children: ReactNode }) => {
  const [loading, setLoading] = useState(true);
  const isInitialLoad = useRef(true);

  const [courses, setCourses] = useState<Course[]>([]);
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [cancellations, setCancellations] = useState<Cancellation[]>([]);
  const [facultyLeaves, setFacultyLeaves] = useState<FacultyLeave[]>([]);
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[]>([]);
  const [extraClasses, setExtraClasses] = useState<ExtraClass[]>([]);
  const [baskets, setBaskets] = useState<Basket[]>([]);
  const [semesterSettings, setSemesterSettings] = useState<SemesterSettings>({
    startDate: new Date(),
    endDate: add(new Date(), { months: 4 }),
  });
  
  const [timetable, setTimetable] = useState<Timetable>({});
  const [conflicts, setConflicts] = useState<TimetableConflict[]>([]);

  // --- Data Fetching and Seeding ---
  useEffect(() => {
    const loadData = async () => {
        setLoading(true);
        isInitialLoad.current = true;
        try {
            const collectionsToFetch = [
                { name: 'courses', setter: setCourses },
                { name: 'faculty', setter: setFaculty },
                { name: 'rooms', setter: setRooms },
                { name: 'holidays', setter: setHolidays },
                { name: 'cancellations', setter: setCancellations },
                { name: 'facultyLeaves', setter: setFacultyLeaves },
                { name: 'feedbackItems', setter: setFeedbackItems },
                { name: 'extraClasses', setter: setExtraClasses },
                { name: 'baskets', setter: setBaskets },
            ];

            // Always fetch all data from Firestore
            for (const { name, setter } of collectionsToFetch) {
                const snapshot = await getDocs(collection(db, name));
                const data = snapshot.docs.map(doc => deserializeDates(doc.data()));
                setter(data as any);
            }
            
            // Fetch or create default settings
            const settingsDocRef = doc(db, 'settings', 'main');
            const settingsDoc = await getDoc(settingsDocRef);
            if (settingsDoc.exists()) {
                setSemesterSettings(deserializeDates(settingsDoc.data()) as SemesterSettings);
            } else {
                // If settings don't exist, create and set them
                const defaultSettings = {
                  startDate: new Date(),
                  endDate: add(new Date(), { months: 4 }),
                };
                await setDoc(settingsDocRef, serializeDates(defaultSettings));
                setSemesterSettings(defaultSettings);
            }
        } catch (error) {
            console.error("Error loading data from Firestore:", error);
        } finally {
            setLoading(false);
            // Use a timeout to ensure state updates from loading are processed before we allow syncing
            setTimeout(() => {
              isInitialLoad.current = false;
            }, 0);
        }
    };
    loadData();
  }, []);

  // --- Data Syncing ---
  const useFirestoreSync = (collectionName: string, data: any[]) => {
    useEffect(() => {
      if (isInitialLoad.current) return;
      syncCollection(collectionName, data);
    }, [data]);
  };

  useFirestoreSync('courses', courses);
  useFirestoreSync('faculty', faculty);
  useFirestoreSync('rooms', rooms);
  useFirestoreSync('holidays', holidays);
  useFirestoreSync('cancellations', cancellations);
  useFirestoreSync('facultyLeaves', facultyLeaves);
  useFirestoreSync('feedbackItems', feedbackItems);
  useFirestoreSync('extraClasses', extraClasses);
  useFirestoreSync('baskets', baskets);
  
  useEffect(() => {
    if (isInitialLoad.current) return;
    setDoc(doc(db, 'settings', 'main'), serializeDates(semesterSettings));
  }, [semesterSettings]);
  
  // --- Timetable Generation ---
  useEffect(() => {
    if (loading) return;
    const { timetable: newTimetable, conflicts: newConflicts } = generateTimetableFromData({
      courses,
      faculty,
      rooms,
      holidays,
      cancellations,
      facultyLeaves,
      semesterSettings,
      baskets,
      extraClasses,
    });
    setTimetable(newTimetable);
    setConflicts(newConflicts);
  }, [courses, faculty, rooms, holidays, cancellations, facultyLeaves, semesterSettings, baskets, extraClasses, loading]);

  const courseMap = useMemo(() =>
    courses.reduce((acc, course) => {
      acc[course.id] = course;
      return acc;
    }, {} as Record<string, Course>),
  [courses]);
  
  const facultyMap = useMemo(() =>
    faculty.reduce((acc, f) => {
      acc[f.id] = f;
      return acc;
    }, {} as Record<string, Faculty>),
  [faculty]);
  
  const facultyCancelAndReschedule = (
    originalClass: { entry: any; date: Date; timeSlot: string },
    cancellationReason: string,
    makeupClass: Omit<ExtraClass, 'id' | 'facultyId' | 'courseId' | 'linkedCancellationId'>
  ) => {
      const cancellationId = `cancel-${Date.now()}`;
      const extraClassId = `extra-${Date.now() + 1}`;

      const newCancellation: Cancellation = {
          id: cancellationId,
          date: originalClass.date,
          timeSlot: originalClass.timeSlot,
          reason: cancellationReason,
          extraClassId: extraClassId,
          status: 'Rescheduled',
      };
      setCancellations(prev => [...prev, newCancellation]);

      const newExtraClass: ExtraClass = {
          id: extraClassId,
          facultyId: originalClass.entry.facultyId!,
          courseId: originalClass.entry.courseId,
          date: makeupClass.date,
          timeSlot: makeupClass.timeSlot,
          roomName: makeupClass.roomName,
          reason: makeupClass.reason,
          linkedCancellationId: cancellationId,
      };
      setExtraClasses(prev => [...prev, newExtraClass]);
  };

  const facultyPermanentCancel = (
    entry: TimetableEntry,
    date: Date,
    timeSlot: string
  ) => {
    const newCancellation: Cancellation = {
      id: `cancel-${date.getTime()}-${timeSlot}`,
      date: date,
      timeSlot: timeSlot,
      reason: `Faculty-initiated permanent cancellation.`,
      status: 'Cancelled',
      cancelledClasses: [{ courseId: entry.courseId, classType: entry.type }],
    };
    setCancellations(prev => [...prev, newCancellation]);
  }
  
  const revertPermanentCancellation = (cancellationId: string) => {
    setCancellations(prev => prev.filter(c => c.id !== cancellationId));
  };


  const revertExtraClass = (extraClassId: string) => {
    const extraClassToRemove = extraClasses.find(ec => ec.id === extraClassId);
    if (!extraClassToRemove) return;
  
    setExtraClasses(prev => prev.filter(ec => ec.id !== extraClassId));
  
    if (extraClassToRemove.linkedCancellationId) {
        // Find the cancellation linked to this extra class
        const linkedCancellation = cancellations.find(c => c.id === extraClassToRemove.linkedCancellationId);
        if (!linkedCancellation) return;

        // Remove the cancellation
        setCancellations(prev => prev.filter(c => c.id !== linkedCancellation.id));
        
        // Check if the cancellation was due to a leave, and if so, find and remove the leave.
        if (linkedCancellation.reason.startsWith('FacultyLeave:')) {
            const reason = linkedCancellation.reason.replace('FacultyLeave: ', '');
            setFacultyLeaves(prev => prev.filter(fl => !(fl.reason === reason && fl.dateRange.from.getTime() <= linkedCancellation.date.getTime() && (fl.dateRange.to || fl.dateRange.from).getTime() >= linkedCancellation.date.getTime())));
        }
    }
  };

  const updateFacultyPassword = (facultyId: string, newPassword: string) => {
    setFaculty(prev =>
      prev.map(f => (f.id === facultyId ? { ...f, password: newPassword } : f))
    );
  };

  if (loading) {
    return (
        <div className="flex h-screen w-screen items-center justify-center">
            <Loader text="Loading Timetable Data..." />
        </div>
    )
  }

  const value = {
    courses, setCourses,
    faculty, setFaculty,
    facultyMap,
    courseMap,
    rooms, setRooms,
    holidays, setHolidays,
    cancellations, setCancellations,
    facultyLeaves, setFacultyLeaves,
    semesterSettings, setSemesterSettings,
    timetable, setTimetable,
    conflicts, setConflicts,
    feedbackItems, setFeedbackItems,
    extraClasses, setExtraClasses,
    baskets, setBaskets,
    facultyCancelAndReschedule,
    facultyPermanentCancel,
    revertPermanentCancellation,
    revertExtraClass,
    updateFacultyPassword,
    loading
  };

  return (
    <TimetableContext.Provider value={value}>
      {children}
    </TimetableContext.Provider>
  );
};

export const useTimetable = (): TimetableContextType => {
  const context = useContext(TimetableContext);
  if (context === undefined) {
    throw new Error('useTimetable must be used within a TimetableProvider');
  }
  return context;
};


