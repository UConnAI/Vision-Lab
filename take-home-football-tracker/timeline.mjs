// Analyze the entire finite video, including a decodable sample near its end.
const END_MARGIN = 0.001;
const MAX_SAMPLES = 1_000_000;

export function videoEnd(duration) {
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new RangeError('Wait for a video with a finite, positive duration.');
  }
  const end = duration - Math.min(END_MARGIN, duration / 2);
  if (end >= duration && duration > END_MARGIN) {
    throw new RangeError('The video duration is too large to seek accurately.');
  }
  // Very small subnormal durations can round the subtraction back to duration.
  return end < duration ? Math.max(0, end) : 0;
}

export function sampleTimes(duration, fps = 10) {
  const end = videoEnd(duration);
  if (!Number.isFinite(fps) || fps <= 0) {
    throw new RangeError('Sampling rate must be finite and greater than zero.');
  }
  const lastIndex = Math.floor(end * fps);
  // Reject an unreasonable allocation rather than silently truncating a clip.
  if (!Number.isSafeInteger(lastIndex) || lastIndex + 2 > MAX_SAMPLES) {
    throw new RangeError('This video requires too many samples at this sampling rate.');
  }
  const times = [];
  for (let index = 0; index <= lastIndex; index++) {
    const time = index / fps;
    if (time <= end) times.push(time);
  }
  const last = times.at(-1);
  if (end > last) {
    // Avoid two effectively identical endpoint samples after floating rounding.
    if (times.length > 1 && end - last < 1e-9) times[times.length - 1] = end;
    else times.push(end);
  }
  return times;
}
