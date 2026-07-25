export const withTimeout = <T,>(promise: PromiseLike<T>, ms: number, message: string = 'Operation timed out'): Promise<T> => {
  let timerId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timerId = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([
    Promise.resolve(promise).finally(() => clearTimeout(timerId)),
    timeout
  ]);
};