import { describe, expect, it } from 'vitest';
import { exceptionsText, filledText, isComplete, providesText, recordsText } from './sourceEntityText.js';

describe('source entity texts', () => {
  it('counts records, provided features, filled values and exception classes', () => {
    expect(recordsText(1)).toBe('1 record');
    expect(providesText(3)).toBe('provides 3 features');
    expect(filledText({ filled: 54, skipped: 0 }, 51)).toBe('54 of 51 values filled');
    expect(filledText({ filled: 48, skipped: 3 }, 51)).toBe('48 of 51 values filled, 3 skipped');
    expect(isComplete({ defaults: 48, skipped: 3 }, 51)).toBe(true);
    expect(exceptionsText({ exceptionClasses: [] })).toBe('');
    expect(exceptionsText({ exceptionClasses: ['EC1'] })).toBe('class exceptions in 1 class');
    expect(exceptionsText({ exceptionClasses: ['EC1', 'EC2'] })).toBe('class exceptions in 2 classes');
    expect(isComplete({ defaults: 50, skipped: 0 }, 51)).toBe(false);
  });
});
