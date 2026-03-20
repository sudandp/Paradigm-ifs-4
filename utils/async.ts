export const withTimeout = <T,>(promise: PromiseLike<T>, ms: number, message: string = 'Operation timed out'): Promise<T> => {
  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
  // Cast to any to avoid strict Promise.race vs PromiseLike issues in some environments
  return Promise.race([promise as any, timeout]);
};