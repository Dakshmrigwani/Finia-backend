import assert from 'node:assert';
import { processTransactionJob } from '../src/workers/transaction.worker';
import { JOB_PROCESS_PDF_IMPORT, type ProcessPdfImportJobData } from '../src/queues/transaction.queue';
import type { Job } from 'bullmq';

async function runBullMQTests() {
  console.log('Running BullMQ Transaction Worker Tests...\n');

  // Test 1: Worker processTransactionJob rejects unknown job names
  console.log('Test 1: Worker rejects unknown job names...');
  const fakeUnknownJob = {
    id: 'test-job-999',
    name: 'unknown-job-type',
    data: {},
    attemptsMade: 0,
    opts: {},
  } as unknown as Job<ProcessPdfImportJobData, any, typeof JOB_PROCESS_PDF_IMPORT>;

  let threw = false;
  try {
    await processTransactionJob(fakeUnknownJob);
  } catch (err: any) {
    threw = true;
    assert.ok(err.message.includes('Unknown job name'));
  }
  assert.strictEqual(threw, true, 'Should throw error for unknown job names');
  console.log('  ✓ Unknown job names rejected properly');

  // Test 2: Progress updates are tracked across stages
  console.log('Test 2: Progress callback is called throughout stages...');
  const progressReports: { percent: number; step: string }[] = [];
  const fakeJob = {
    id: 'test-job-1',
    name: JOB_PROCESS_PDF_IMPORT,
    attemptsMade: 0,
    opts: { attempts: 3 },
    data: {
      userId: 'test-user-uuid',
      fileBufferBase64: Buffer.from('Non-empty fake buffer').toString('base64'),
      currency: 'USD ($)',
      originalFileName: 'statement.pdf',
    },
    updateProgress: async (prog: { percent: number; step: string }) => {
      progressReports.push(prog);
    },
  } as unknown as Job<ProcessPdfImportJobData, any, typeof JOB_PROCESS_PDF_IMPORT>;

  // When buffer cannot be parsed as a valid PDF text, it throws unprocessable entity
  // but verify progress was called before failing
  try {
    await processTransactionJob(fakeJob);
  } catch (err: any) {
    // Expected to fail on fake PDF buffer
    assert.ok(err.message.includes('No transactions could be detected') || err.message.includes('PDF'));
  }
  assert.ok(progressReports.length >= 1, 'Should have reported progress before failing on corrupt PDF');
  assert.strictEqual(progressReports[0].percent, 15, 'First stage should report 15%');
  console.log('  ✓ Progress reporting verified (%j)', progressReports[0]);

  console.log('\n🎉 ALL BULLMQ TESTS PASSED SUCCESSFULLY!');
  process.exit(0);
}

runBullMQTests().catch((err) => {
  console.error('BullMQ tests failed:', err);
  process.exit(1);
});
