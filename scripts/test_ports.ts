import fetch from 'node-fetch';

export async function testPorts() {
  for (const port of [3000, 5173, 4000]) {
    try {
      const res = await fetch(`http://localhost:${port}/`, {
        signal: AbortSignal.timeout(2000)
      });
      console.log(`Port ${port} is UP! Status:`, res.status);
    } catch (e: any) {
      console.log(`Port ${port} error:`, e.message);
    }
  }
}
