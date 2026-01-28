export enum ApiMessage {
  // --- AUTH MODULE ---
  REGISTER_SUCCESS = 'Đăng ký tài khoản thành công',
  LOGIN_SUCCESS = 'Đăng nhập thành công',
  LOGOUT_SUCCESS = 'Đăng xuất thành công',
  REFRESH_TOKEN_SUCCESS = 'Cấp lại token thành công',
  GET_PROFILE_SUCCESS = 'Lấy thông tin cá nhân thành công',
  UNAUTHORIZED = 'Truy cập không được phép',
  GET_CURRENT_SESSION_SUCCESS = 'Lấy thông tin Session thành công',
  LOGIN_REQUIRED = 'Vui lòng đăng nhập để tiếp tục',
  TOKEN_EXPIRED = 'Phiên đăng nhập đã hết hạn',
  TOKEN_INVALID = 'Token không hợp lệ hoặc sai định dạng',
  ERROR = 'Có lỗi xảy ra',

  // --- PERMISSION / ERROR ---
  FORBIDDEN = 'Bạn không có quyền thực hiện hành động này',
  ROLE_REQUIRED = 'Yêu cầu quyền quản trị viên',

  // --- USER MODULE ---
  UPDATE_PROFILE_SUCCESS = 'Cập nhật hồ sơ thành công',
  CHANGE_PASSWORD_SUCCESS = 'Đổi mật khẩu thành công',
  GET_SESSIONS_SUCCESS = 'Lấy danh sách phiên đăng nhập thành công',
  REVOKE_SESSION_SUCCESS = 'Đăng xuất thiết bị thành công',

  // --- COMMON / SYSTEM ---
  SUCCESS = 'Thao tác thành công',
  VALIDATION_ERROR = 'Dữ liệu không hợp lệ',
}