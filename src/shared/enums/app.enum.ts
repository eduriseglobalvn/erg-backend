
export enum UserRole {
  ADMIN = 'admin',
  TEACHER = 'teacher',
  MEDIA = 'media',
  USER = 'user',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  BANNED = 'banned',
  PENDING = 'pending',
  BLOCKED = 'blocked',
}

export enum AuthProvider {
  LOCAL = 'local',
  GOOGLE = 'google',
  FACEBOOK = 'facebook',
  APPLE = 'apple',
  ADMIN_CREATED = 'admin_created',
}

export enum CourseStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
}

export enum PostStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived',
  PENDING = 'pending',
}

export enum ShiftType {
  TEACHING = 'teaching',
  OFFICE = 'office',
  MEETING = 'meeting',
  EVENT = 'event',
}

export enum ShiftStatus {
  SCHEDULED = 'scheduled',
  CHECKED_IN = 'checked_in',
  CHECKED_OUT = 'checked_out',
  ABSENT = 'absent',
  CANCELLED = 'cancelled',
}

export enum ReviewStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

export enum ApiProvider {
  GOOGLE = 'google', // Gemini
  OPENAI = 'openai', // GPT / DALL-E
  STABILITY = 'stability', // Stable Diffusion (Rẻ hơn OpenAI)2
  BANANA = 'banana', // Custom GPU Server (Banana.dev / RunPod)
  OTHER = 'other',
}
