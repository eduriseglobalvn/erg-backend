export interface ApiResponse<T> {
  statusCode: number;
  message: string;
  data?: T;
  errors?: any;
  timestamp: string;
  path: string;
}