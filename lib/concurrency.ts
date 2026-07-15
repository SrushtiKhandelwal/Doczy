/**
 * Bounds how many Puppeteer (headless Chromium) conversions run at once.
 *
 * There's no job queue in this app (single EC2 instance, synchronous API
 * route), so unbounded concurrent Chromium launches can exhaust memory on a
 * small instance under real traffic. This is a lightweight in-process
 * semaphore, not a persistent queue: requests over the limit wait in-memory
 * for a free slot for a bounded time, then fail with a clear error instead of
 * piling up indefinitely.
 */

const MAX_CONCURRENT_RENDERS = parseInt(process.env.MAX_CONCURRENT_RENDERS ?? "2", 10);

export class ServerBusyError extends Error {}

let active = 0;
const waiters: Array<() => void> = [];

function acquire(timeoutMs: number): Promise<void> {
  if (active < MAX_CONCURRENT_RENDERS) {
    active++;
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const onSlot = () => {
      clearTimeout(timer);
      active++;
      resolve();
    };

    const timer = setTimeout(() => {
      const index = waiters.indexOf(onSlot);
      if (index !== -1) waiters.splice(index, 1);
      reject(
        new ServerBusyError(
          "The server is busy processing other conversions. Please try again shortly."
        )
      );
    }, timeoutMs);

    waiters.push(onSlot);
  });
}

function release(): void {
  active--;
  const next = waiters.shift();
  if (next) next();
}

export async function withRenderSlot<T>(
  fn: () => Promise<T>,
  timeoutMs = 60_000
): Promise<T> {
  await acquire(timeoutMs);
  try {
    return await fn();
  } finally {
    release();
  }
}
