/**
 * FPS utility functions for fluid simulation.
 */

export interface FPSTracker {
  frameCount: number;
  lastSampleTime: number;
  sampleIntervalMs: number;
}

/**
 * Creates a mutable FPS tracker object.
 *
 * @param sampleIntervalMs - Sampling window in milliseconds (default: 500)
 * @param startTimeMs - Initial timestamp in milliseconds (default: 0)
 */
export function createFPSTracker(
  sampleIntervalMs: number = 500,
  startTimeMs: number = 0,
): FPSTracker {
  return {
    frameCount: 0,
    lastSampleTime: startTimeMs,
    sampleIntervalMs,
  };
}

/**
 * Updates tracker with one rendered frame and returns FPS when sample window completes.
 * Returns null when more samples are still needed.
 *
 * @param tracker - Mutable FPS tracker object
 * @param nowMs - Current high-resolution timestamp in milliseconds
 */
export function sampleFPS(tracker: FPSTracker, nowMs: number): number | null {
  if (tracker.lastSampleTime === 0) {
    tracker.lastSampleTime = nowMs;
  }

  tracker.frameCount += 1;

  const elapsed = nowMs - tracker.lastSampleTime;
  if (elapsed < tracker.sampleIntervalMs) {
    return null;
  }

  const fps = Math.round((tracker.frameCount * 1000) / elapsed);
  tracker.frameCount = 0;
  tracker.lastSampleTime = nowMs;

  return fps;
}
