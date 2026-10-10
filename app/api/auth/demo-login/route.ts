import { POST as login } from '../login/route';

export async function POST(request: Request) {
  return login(request);
}
