export type UserRole = 'student' | 'teacher' | 'admin';

export interface User {
  id: string;
  name: string;
  username: string;
  phoneNumber?: string;
  email?: string; // optional — kept for recovery/profile purposes only
  role: UserRole;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StudentProfile extends User {
  role: 'student';
  gradeLevel: number;
  schoolName?: string;
  targetScore?: number;
  weeklyStudyHours?: number;
}

export interface TeacherProfile extends User {
  role: 'teacher';
  bio?: string;
  subjects: string[];
  isVerified: boolean;
}

export interface AdminProfile extends User {
  role: 'admin';
  permissions: string[];
}

/** Payload sent to the login API */
export interface LoginPayload {
  username: string;
  password: string;
}

/** Payload sent to the register API */
export interface RegisterPayload {
  fullName: string;
  phoneNumber: string;
  username: string;
  password: string;
  // confirmPassword is validated client-side only; NOT sent to backend
}
