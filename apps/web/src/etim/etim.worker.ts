import { processEtimJob, type EtimJobRequest, type EtimJobResponse } from './etimJob.js';

const scope = self as unknown as { postMessage(message: EtimJobResponse): void };

self.addEventListener('message', (event: MessageEvent<EtimJobRequest>) => {
  let response: EtimJobResponse;
  try {
    response = { ok: true, result: processEtimJob(event.data) };
  } catch (error) {
    response = { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  scope.postMessage(response);
});
