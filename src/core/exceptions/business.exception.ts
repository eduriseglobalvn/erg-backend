import { HttpException, HttpStatus } from '@nestjs/common';

// Dùng cái này khi lỗi do Logic nghiệp vụ (không phải lỗi kỹ thuật)
export class BusinessException extends HttpException {
  constructor(
    message: string,
    errorCode?: string,
    statusCode = HttpStatus.BAD_REQUEST,
  ) {
    super(
      {
        message,
        errorCode, // Thêm mã lỗi để FE dễ handle (VD: USER_001)
      },
      statusCode,
    );
  }
}