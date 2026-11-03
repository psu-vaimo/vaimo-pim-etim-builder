import type { ParseResult } from '@vaimo-pim-etim-builder/core';
import type { EtimJobRequest, EtimJobResponse } from './etimJob.js';

/** Runs decoding and parsing in a Web Worker so large exports do not block the UI. One worker per job. */
export function runEtimJob(request: EtimJobRequest): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./etim.worker.ts', import.meta.url), { type: 'module' });
    worker.addEventListener('message', (event: MessageEvent<EtimJobResponse>) => {
      worker.terminate();
      if (event.data.ok) resolve(event.data.result);
      else reject(new Error(event.data.error));
    });
    worker.addEventListener('error', (event) => {
      worker.terminate();
      reject(new Error(event.message || 'The ETIM worker failed'));
    });
    worker.postMessage(
      request,
      request.files.map((f) => f.bytes),
    );
  });
}
