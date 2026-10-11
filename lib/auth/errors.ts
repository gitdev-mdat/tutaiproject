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
