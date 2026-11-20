import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: keyof IUserPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    if (!user) return null;
    return data ? user[data] : user;
  },
);

export interface IUserPayload {
  id: string;
  email: string;
  roles: string[];
  status: string;
}
