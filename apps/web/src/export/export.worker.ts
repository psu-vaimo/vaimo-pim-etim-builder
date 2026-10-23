import { processExportJob, transferables, type ExportJobRequest, type ExportJobResponse } from './exportJob.js';

const scope = self as unknown as { postMessage(message: ExportJobResponse, transfer?: Transferable[]): void };

self.addEventListener('message', (event: MessageEvent<ExportJobRequest>) => {
  try {
    const result = processExportJob(event.data);
    scope.postMessage({ ok: true, result }, transferables(result));
  } catch (error) {
    scope.postMessage({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});
