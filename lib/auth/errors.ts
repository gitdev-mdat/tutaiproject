export class AuthError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 400
  ) {
    super(message);
  }
}

/**
 * Google proves who owns an email; a password account with the same email does
 * not, because nothing has verified it. Linking the two would hand the account,
 * and anything its email unlocks (such as ADMIN_EMAILS), to whoever registered
 * it first, so the Google sign-in is refused instead.
 */
export const ACCOUNT_LINK_REQUIRES_VERIFICATION = 'ACCOUNT_LINK_REQUIRES_VERIFICATION';

export function unverifiedAccountLinkError(): AuthError {
  return new AuthError(
    ACCOUNT_LINK_REQUIRES_VERIFICATION,
    'Email này đã gắn với một tài khoản mật khẩu chưa xác minh. Hãy đăng nhập bằng mật khẩu.',
    409
  );
}

/**
 * Reasons a signed-in account cannot link a Google account. Linking needs the
 * person to hold both the current session and the Google account, and never
 * moves an email or a Google account away from another Tú Tài account.
 */
export const GOOGLE_LINK_ERRORS = {
  GOOGLE_LINKED_ELSEWHERE: 'Tài khoản Google này đã gắn với một tài khoản Tú Tài khác.',
  ACCOUNT_HAS_OTHER_GOOGLE: 'Tài khoản của bạn đã liên kết với một tài khoản Google khác.',
  GOOGLE_EMAIL_IN_USE:
    'Email của tài khoản Google này đang được một tài khoản Tú Tài khác sử dụng.',
  GOOGLE_EMAIL_MISMATCH: 'Email của tài khoản Google khác với email bạn đã đăng ký.',
} as const;

export type GoogleLinkErrorCode = keyof typeof GOOGLE_LINK_ERRORS;

export function googleLinkError(code: GoogleLinkErrorCode): AuthError {
  return new AuthError(code, GOOGLE_LINK_ERRORS[code], 409);
}
