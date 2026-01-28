// Đây là những gì Next.js sẽ nhận được để lưu vào Redux/Zustand/Context
export class SessionResponseDto {
  user!: {
    id: string;
    email: string;
    fullName: string;
    avatarUrl?: string;
    status: string; // 'active' | 'pending' | 'banned'
  };

  accessControl!: {
    roles: string[]; // Ví dụ: ['admin', 'teacher']
    permissions: string[]; // Ví dụ: ['user.create', 'post.delete', 'course.publish']
  };

  session!: {
    id: string; // ID của session trong DB (để revoke nếu cần)
    ipAddress?: string;
    lastActiveAt?: Date;
    expiresAt: Date;
  };

  system!: {
    serverTime: Date; // Để FE đồng bộ đồng hồ đếm ngược token
    version: string;
  };
}
