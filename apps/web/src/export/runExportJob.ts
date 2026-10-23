import type { ExportJobRequest, ExportJobResponse, ExportJobResult } from './exportJob.js';

export interface ExportJob {
  promise: Promise<ExportJobResult>;
  /** Stops the worker, the promise then never settles. */
  cancel: () => void;
}

/**
 * Builds the export in a Web Worker, a big project takes seconds. One worker
 * per job, so a newer job can cancel an older one.
 */
export function runExportJob(request: ExportJobRequest): ExportJob {
  const worker = new Worker(new URL('./export.worker.ts', import.meta.url), { type: 'module' });
  const promise = new Promise<ExportJobResult>((resolve, reject) => {
    worker.addEventListener('message', (event: MessageEvent<ExportJobResponse>) => {
      worker.terminate();
      if (event.data.ok) resolve(event.data.result);
      else reject(new Error(event.data.error));
    });
    worker.addEventListener('error', (event) => {
      worker.terminate();
      reject(new Error(event.message || 'The export worker failed'));
    });
  });
  worker.postMessage(request);
  return { promise, cancel: () => worker.terminate() };
}
