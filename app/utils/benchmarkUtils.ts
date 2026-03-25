import { FluidSolverGPU } from "../simulation/FluidSolver";

export const BENCHMARK_DURATION_MS = 60_000;
export const BENCHMARK_SOLVER_ITERATIONS = 50;
export const BENCHMARK_DISPLAY_SCALE = 2;
const MAX_BENCHMARK_FRAME_SAMPLES = 120_000;
export const BENCHMARK_RESOLUTION = {
  width: 432,
  height: 240,
} as const;

export interface BenchmarkFrameBuffer {
  values: Float64Array;
  length: number;
}

export interface BenchmarkResult {
  averageFps: number;
  onePercentLowFps: number;
  deviceMemory: string;
  platformOs: string;
  renderer: string;
  durationMs: number;
  sampledFrames: number;
}

export interface BenchmarkDeviceInfo {
  deviceMemory: string;
  platformOs: string;
  renderer: string;
}

export interface BenchmarkWorkloadState {
  lastObstaclePhase: number;
}

export function createBenchmarkFrameBuffer(): BenchmarkFrameBuffer {
  return {
    // Preallocate once so frame sampling stays O(1) during the benchmark.
    values: new Float64Array(MAX_BENCHMARK_FRAME_SAMPLES),
    length: 0,
  };
}

export function appendBenchmarkFrameTime(
  buffer: BenchmarkFrameBuffer,
  frameTimeMs: number,
): BenchmarkFrameBuffer {
  if (frameTimeMs <= 0 || buffer.length >= buffer.values.length) {
    return buffer;
  }

  buffer.values[buffer.length] = frameTimeMs;

  return {
    values: buffer.values,
    length: buffer.length + 1,
  };
}

const OBSTACLE_PATTERNS: ReadonlyArray<
  ReadonlyArray<{ x: number; y: number; radius: number }>
> = [
  [
    { x: 0.28, y: 0.34, radius: 0.018 },
    { x: 0.52, y: 0.52, radius: 0.015 },
    { x: 0.74, y: 0.7, radius: 0.018 },
  ],
  [
    { x: 0.28, y: 0.68, radius: 0.016 },
    { x: 0.48, y: 0.4, radius: 0.02 },
    { x: 0.72, y: 0.28, radius: 0.016 },
  ],
  [
    { x: 0.2, y: 0.5, radius: 0.014 },
    { x: 0.4, y: 0.7, radius: 0.016 },
    { x: 0.6, y: 0.3, radius: 0.016 },
    { x: 0.8, y: 0.5, radius: 0.014 },
  ],
  [
    { x: 0.34, y: 0.26, radius: 0.017 },
    { x: 0.34, y: 0.74, radius: 0.017 },
    { x: 0.68, y: 0.5, radius: 0.02 },
  ],
];

export function createBenchmarkWorkloadState(): BenchmarkWorkloadState {
  return {
    lastObstaclePhase: -1,
  };
}

function drawObstaclePattern(
  solver: FluidSolverGPU,
  patternIndex: number,
  canvasWidth: number,
  canvasHeight: number,
) {
  solver.updateWalls(true, true, true, true);

  const pattern = OBSTACLE_PATTERNS[patternIndex % OBSTACLE_PATTERNS.length];
  for (const obstacle of pattern) {
    solver.drawObstacles(
      obstacle.x * canvasWidth,
      obstacle.y * canvasHeight,
      obstacle.radius,
      false,
    );
  }
}

export function applyBenchmarkWorkload({
  solver,
  elapsedMs,
  canvasWidth,
  canvasHeight,
  state,
}: {
  solver: FluidSolverGPU;
  elapsedMs: number;
  canvasWidth: number;
  canvasHeight: number;
  state: BenchmarkWorkloadState;
}): BenchmarkWorkloadState {
  const t = elapsedMs / 1000;

  const primaryX = canvasWidth * (0.5 + 0.27 * Math.sin(t * 0.9));
  const primaryY = canvasHeight * (0.5 + 0.22 * Math.cos(t * 1.2));
  const secondaryX = canvasWidth * (0.5 + 0.21 * Math.cos(t * 1.55 + 0.9));
  const secondaryY = canvasHeight * (0.5 + 0.24 * Math.sin(t * 1.35 + 0.6));
  const tertiaryX = canvasWidth * (0.5 + 0.18 * Math.sin(t * 2.2 + Math.PI / 4));
  const tertiaryY = canvasHeight * (0.5 + 0.2 * Math.cos(t * 1.8 + Math.PI / 6));

  solver.splat(
    solver.density,
    primaryX,
    primaryY,
    1.2,
    0.45,
    0.15,
    0.0016,
  );
  solver.splat(
    solver.velocity,
    primaryX,
    primaryY,
    18 * Math.cos(t * 1.6),
    15 * Math.sin(t * 1.9),
    0,
    0.0018,
  );
  solver.splat(
    solver.temperature,
    primaryX,
    primaryY,
    45 + 10 * Math.sin(t * 0.8),
    0,
    0,
    0.0013,
  );

  solver.splat(
    solver.density,
    secondaryX,
    secondaryY,
    0.15,
    0.7,
    1.2,
    0.0015,
  );
  solver.splat(
    solver.velocity,
    secondaryX,
    secondaryY,
    -16 * Math.sin(t * 1.4),
    17 * Math.cos(t * 1.5),
    0,
    0.0017,
  );

  solver.splat(
    solver.temperature,
    tertiaryX,
    tertiaryY,
    -32 - 8 * Math.cos(t * 1.1),
    0,
    0,
    0.0012,
  );
  solver.splat(
    solver.velocity,
    tertiaryX,
    tertiaryY,
    12 * Math.sin(t * 2.6),
    -14 * Math.cos(t * 2.1),
    0,
    0.0015,
  );

  const obstaclePhase = Math.floor(t / 8) % OBSTACLE_PATTERNS.length;
  if (state.lastObstaclePhase !== obstaclePhase) {
    drawObstaclePattern(solver, obstaclePhase, canvasWidth, canvasHeight);
    return {
      lastObstaclePhase: obstaclePhase,
    };
  }

  return state;
}

export function detectBenchmarkDeviceInfo(
  gl: WebGL2RenderingContext,
): BenchmarkDeviceInfo {
  const navigatorWithHints = navigator as Navigator & {
    userAgentData?: { platform?: string };
    deviceMemory?: number;
  };
  const platformOs = detectPlatformOs(navigatorWithHints);
  const deviceMemory = navigatorWithHints.deviceMemory
    ? `${navigatorWithHints.deviceMemory} GB`
    : "Unavailable";

  const debugRendererInfo = gl.getExtension("WEBGL_debug_renderer_info") as
    | { UNMASKED_RENDERER_WEBGL: number }
    | null;

  const renderer = debugRendererInfo
    ? String(gl.getParameter(debugRendererInfo.UNMASKED_RENDERER_WEBGL))
    : String(gl.getParameter(gl.RENDERER));

  return {
    deviceMemory,
    platformOs,
    renderer,
  };
}

function detectPlatformOs(
  navigatorWithHints: Navigator & {
    userAgentData?: { platform?: string };
  },
): string {
  const platformHint = navigatorWithHints.userAgentData?.platform;
  if (platformHint) {
    return platformHint;
  }

  const userAgent = navigator.userAgent.toLowerCase();
  const platform = navigator.platform.toLowerCase();

  if (/windows/.test(userAgent) || /win/.test(platform)) {
    return "Windows";
  }

  if (/android/.test(userAgent)) {
    return "Android";
  }

  if (/iphone|ipad|ipod/.test(userAgent)) {
    return "iOS";
  }

  if (/mac/.test(platform) || /mac os/.test(userAgent)) {
    return "macOS";
  }

  if (/linux/.test(platform) || /linux/.test(userAgent)) {
    return "Linux";
  }

  return navigator.platform || "Unavailable";
}

export function calculateBenchmarkMetrics(
  frameTimesMs: ArrayLike<number>,
  sampleCount: number = frameTimesMs.length,
): Pick<BenchmarkResult, "averageFps" | "onePercentLowFps"> {
  if (sampleCount === 0) {
    return {
      averageFps: 0,
      onePercentLowFps: 0,
    };
  }

  let totalFrameTimeMs = 0;
  const sampledFrameTimes = new Array<number>(sampleCount);

  for (let index = 0; index < sampleCount; index += 1) {
    const frameTime = frameTimesMs[index];
    totalFrameTimeMs += frameTime;
    sampledFrameTimes[index] = frameTime;
  }

  const averageFps = (sampleCount * 1000) / totalFrameTimeMs;

  const slowestFrameCount = Math.max(1, Math.ceil(sampleCount * 0.01));
  const slowestFrameTimes = sampledFrameTimes
    .sort((a, b) => b - a)
    .slice(0, slowestFrameCount);
  const averageSlowestFrameTimeMs =
    slowestFrameTimes.reduce((sum, frameTime) => sum + frameTime, 0) /
    slowestFrameTimes.length;

  return {
    averageFps: Number(averageFps.toFixed(1)),
    onePercentLowFps: Number((1000 / averageSlowestFrameTimeMs).toFixed(1)),
  };
}
