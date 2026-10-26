import {features} from './core.mjs';

// Explain the existing feature-window gates without weakening them or filling
// missing observations with simulated values.
export function assessEarlyEvidence(samples, cutoff, lockTime, reveal) {
  const recent = samples.filter(sample => sample.t <= cutoff && sample.t >= cutoff - 450);
  const count = recent.length;
  const spanMs = count ? recent.at(-1).t - recent[0].t : 0;
  const ageMs = count ? cutoff - recent.at(-1).t : null;
  const deadlineMissed = lockTime >= reveal;
  const x = deadlineMissed ? null : features(samples, cutoff);
  let reason, message;
  if (deadlineMissed) {
    reason = 'missed-deadline';
    message = 'The browser reached the lock at or after SHOW. This round cannot count as an early prediction. Keep the tab active and close heavy background work before retrying.';
  } else if (count < 4) {
    reason = 'too-few-frames';
    message = `Only ${count} usable early frame${count === 1 ? '' : 's'} in the last 450 ms; at least 4 are needed. Keep the tab active. In camera mode, keep the full hand visible and check that tracking is ready.`;
  } else if (ageMs > 150) {
    reason = 'stale-frames';
    message = `The newest usable frame was ${Math.round(ageMs)} ms before the cutoff; it must be within 150 ms. Tracking stopped too early or the browser paused. Keep the hand visible through the lock and retry.`;
  } else if (spanMs < 100) {
    reason = 'short-window';
    message = `The usable frames span only ${Math.round(spanMs)} ms; at least 100 ms are needed to estimate change over time. Let tracking settle, then record a new full movement round.`;
  } else {
    reason = 'ready';
    message = `${count} usable early frames span ${Math.round(spanMs)} ms; the newest is ${Math.round(ageMs)} ms before the cutoff. The timing/data checks passed. This does not establish that the guess is correct.`;
  }
  return {x, quality:{reason, count, spanMs, ageMs, lockDelayMs:Math.max(0, lockTime-cutoff), actualLeadMs:Math.max(0,reveal-lockTime)}, message};
}
