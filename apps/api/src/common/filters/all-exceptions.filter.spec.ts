import type { ArgumentsHost } from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

// docs/specs/2026-08-28-02-notifications-system.md AC-1 ("file/system errors" trigger) — only a
// genuine 5xx should ever fan out a system_alert notification, it must never block/delay the HTTP
// response, and a failure inside notify() itself must never escape catch() (no recursive filter
// re-entry, no unhandled rejection).
function createHost(): ArgumentsHost {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const req = { traceId: 'trace-123' };
  return {
    switchToHttp: () => ({ getResponse: () => res, getRequest: () => req, getNext: () => undefined }),
  } as unknown as ArgumentsHost;
}

function createFakePrisma(admins: { id: bigint }[]) {
  return { user: { findMany: jest.fn(async () => admins) } };
}

describe('AllExceptionsFilter (system_alert wiring)', () => {
  it('notifies every admin with a system_alert on an unhandled (500) exception', async () => {
    const prisma = createFakePrisma([{ id: 1n }, { id: 2n }]);
    const notify = jest.fn(async () => undefined);
    const filter = new AllExceptionsFilter(prisma as never, { notify } as never);
    const host = createHost();

    filter.catch(new Error('database exploded'), host);
    // notify() is deliberately fire-and-forget (not awaited by catch()) — flush microtasks.
    await new Promise(process.nextTick);

    expect(notify).toHaveBeenCalledTimes(2);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ recipientUserId: '1', type: 'system_alert' }));
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ recipientUserId: '2', type: 'system_alert' }));
  });

  it('sends the HTTP response synchronously, without waiting on notify()', () => {
    const prisma = createFakePrisma([{ id: 1n }]);
    let resolveNotify: () => void = () => undefined;
    const notify = jest.fn(() => new Promise<void>((resolve) => (resolveNotify = resolve)));
    const filter = new AllExceptionsFilter(prisma as never, { notify } as never);
    const host = createHost();
    const res = host.switchToHttp().getResponse<{ status: jest.Mock; json: jest.Mock }>();

    filter.catch(new Error('slow to notify'), host);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalled();
    resolveNotify();
  });

  it('never lets a notify() failure escape catch() or affect the response', async () => {
    const prisma = createFakePrisma([{ id: 1n }]);
    const notify = jest.fn(async () => {
      throw new Error('notifications DB unreachable too');
    });
    const filter = new AllExceptionsFilter(prisma as never, { notify } as never);
    const host = createHost();

    expect(() => filter.catch(new Error('root cause'), host)).not.toThrow();
    await new Promise(process.nextTick);

    const res = host.switchToHttp().getResponse<{ status: jest.Mock; json: jest.Mock }>();
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('does not fire a system_alert for a 4xx/validation exception', async () => {
    const prisma = createFakePrisma([{ id: 1n }]);
    const notify = jest.fn(async () => undefined);
    const filter = new AllExceptionsFilter(prisma as never, { notify } as never);
    const host = createHost();

    filter.catch(new NotFoundException('not found'), host);
    await new Promise(process.nextTick);

    expect(notify).not.toHaveBeenCalled();
  });
});
