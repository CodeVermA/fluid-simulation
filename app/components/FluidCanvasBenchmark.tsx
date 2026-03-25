'use client';

import { useEffect, useRef, useState } from 'react';
import FluidCanvasGPU, {
  type FluidCanvasAutomation,
  type FluidCanvasFrameContext,
  type FluidCanvasRuntime,
} from './FluidCanvasGPU';
import { InteractionMode } from '../types/interactionMode';
import {
  BENCHMARK_DISPLAY_SCALE,
  BENCHMARK_DURATION_MS,
  BENCHMARK_RESOLUTION,
  BENCHMARK_SOLVER_ITERATIONS,
  appendBenchmarkFrameTime,
  applyBenchmarkWorkload,
  calculateBenchmarkMetrics,
  createBenchmarkFrameBuffer,
  createBenchmarkWorkloadState,
  detectBenchmarkDeviceInfo,
  type BenchmarkDeviceInfo,
  type BenchmarkFrameBuffer,
  type BenchmarkResult,
  type BenchmarkWorkloadState,
} from '../utils/benchmarkUtils';

const BENCHMARK_BOUNDARIES = {
  top: true,
  bottom: true,
  left: true,
  right: true,
};

const BENCHMARK_SIMULATION_PARAMS = {
  temperature: 35,
  velocity: { x: 18, y: 12 },
  viscosity: 0.0001,
  densityDiffusion: false,
  performance: BENCHMARK_SOLVER_ITERATIONS,
  slipCondition: 0,
  penWidth: 5,
  vorticityStrength: 1.8,
};

interface FluidCanvasBenchmarkProps {
  startOnMount: boolean;
  onComplete?: (result: BenchmarkResult) => void;
  onInitializationError?: (message: string) => void;
}

interface BenchmarkRunState {
  startedAtMs: number;
  lastFrameTimeMs: number;
  lastReportedProgress: number;
  frameTimesMs: BenchmarkFrameBuffer;
  workloadState: BenchmarkWorkloadState;
  deviceInfo: BenchmarkDeviceInfo;
  complete: boolean;
}

function beginBenchmarkRun(
  runtime: FluidCanvasRuntime,
  startedAtMs: number,
): BenchmarkRunState {
  runtime.solver.reset();
  runtime.solver.updateWalls(
    BENCHMARK_BOUNDARIES.top,
    BENCHMARK_BOUNDARIES.bottom,
    BENCHMARK_BOUNDARIES.left,
    BENCHMARK_BOUNDARIES.right,
  );

  return {
    startedAtMs,
    lastFrameTimeMs: startedAtMs,
    lastReportedProgress: 0,
    frameTimesMs: createBenchmarkFrameBuffer(),
    workloadState: createBenchmarkWorkloadState(),
    deviceInfo: detectBenchmarkDeviceInfo(runtime.solver.resources.gl),
    complete: false,
  };
}

function createBenchmarkResult(runState: BenchmarkRunState): BenchmarkResult {
  const metrics = calculateBenchmarkMetrics(
    runState.frameTimesMs.values,
    runState.frameTimesMs.length,
  );

  return {
    averageFps: metrics.averageFps,
    onePercentLowFps: metrics.onePercentLowFps,
    deviceMemory: runState.deviceInfo.deviceMemory,
    platformOs: runState.deviceInfo.platformOs,
    renderer: runState.deviceInfo.renderer,
    durationMs: BENCHMARK_DURATION_MS,
    sampledFrames: runState.frameTimesMs.length,
  };
}

export default function FluidCanvasBenchmark({
  startOnMount,
  onComplete,
  onInitializationError,
}: FluidCanvasBenchmarkProps) {
  const runtimeRef = useRef<FluidCanvasRuntime | null>(null);
  const callbacksRef = useRef({
    onComplete,
    onInitializationError,
  });
  const runStateRef = useRef<BenchmarkRunState | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    callbacksRef.current = {
      onComplete,
      onInitializationError,
    };
  }, [onComplete, onInitializationError]);

  const automation: FluidCanvasAutomation = {
    onReady: (runtime) => {
      runtimeRef.current = runtime;
      if (startOnMount) {
        runStateRef.current = beginBenchmarkRun(runtime, performance.now());
        setProgress(0);
        setError(null);
      } else {
        runStateRef.current = null;
      }
    },
    onBeforeStep: (context: FluidCanvasFrameContext) => {
      if (!startOnMount) {
        return false;
      }

      let currentRunState = runStateRef.current;

      if (!currentRunState) {
        const runtime: FluidCanvasRuntime = {
          solver: context.solver,
          utils: context.utils,
          width: context.width,
          height: context.height,
        };

        runtimeRef.current = runtime;
        currentRunState = beginBenchmarkRun(runtime, context.nowMs);
        runStateRef.current = currentRunState;
      }

      if (currentRunState.complete) {
        return false;
      }

      const frameTimeMs = context.nowMs - currentRunState.lastFrameTimeMs;
      let nextRunState: BenchmarkRunState = {
        ...currentRunState,
        lastFrameTimeMs: context.nowMs,
        frameTimesMs: appendBenchmarkFrameTime(
          currentRunState.frameTimesMs,
          frameTimeMs,
        ),
      };

      const elapsedMs = context.nowMs - nextRunState.startedAtMs;
      const nextProgress = Math.min(elapsedMs / BENCHMARK_DURATION_MS, 1);

      if (elapsedMs >= BENCHMARK_DURATION_MS) {
        nextRunState = {
          ...nextRunState,
          complete: true,
        };
        runStateRef.current = nextRunState;
        setProgress(1);
        callbacksRef.current.onComplete?.(createBenchmarkResult(nextRunState));
        return false;
      }

      const nextWorkloadState = applyBenchmarkWorkload({
        solver: context.solver,
        elapsedMs,
        canvasWidth: context.width,
        canvasHeight: context.height,
        state: nextRunState.workloadState,
      });
      nextRunState = {
        ...nextRunState,
        workloadState: nextWorkloadState,
      };

      if (
        nextProgress === 1 ||
        nextProgress - nextRunState.lastReportedProgress >= 0.01
      ) {
        nextRunState = {
          ...nextRunState,
          lastReportedProgress: nextProgress,
        };
        setProgress(nextProgress);
      }

      runStateRef.current = nextRunState;

      return true;
    },
  };

  const handleInitializationError = (message: string) => {
    setError(message);
    setProgress(0);
    callbacksRef.current.onInitializationError?.(message);
  };

  const progressPercent = Math.round(progress * 100);
  const isRunning = startOnMount && !error && progress < 1;
  const isIdle = !startOnMount && !error;

  return (
    <div className="relative mx-auto max-w-5xl">
      <FluidCanvasGPU
        width={BENCHMARK_RESOLUTION.width}
        height={BENCHMARK_RESOLUTION.height}
        displayScale={BENCHMARK_DISPLAY_SCALE}
        boundaries={BENCHMARK_BOUNDARIES}
        interactionMode={InteractionMode.AddVelocity}
        obstacleEraser={false}
        hideObstacles={false}
        simulationParams={BENCHMARK_SIMULATION_PARAMS}
        showFPS={false}
        interactive={false}
        automation={automation}
        onInitializationError={handleInitializationError}
      />

      {isIdle && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-gray-950/82 p-5 shadow-2xl backdrop-blur-md">
            <p className="text-sm font-semibold text-cyan-200">Benchmark ready</p>
            <p className="mt-2 text-sm text-gray-300">
              Click the start button above to begin the timed benchmark run.
            </p>
          </div>
        </div>
      )}

      {isRunning && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-cyan-500/30 bg-gray-950/85 p-5 shadow-2xl backdrop-blur-md">
            <div className="flex items-center justify-between gap-4 text-sm text-cyan-200">
              <span>Benchmark in progress</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-gray-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 transition-[width] duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="mt-3 text-sm text-gray-300">
              Running the scripted fluid workload and recording frame timing.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-rose-500/30 bg-gray-950/90 p-5 text-sm text-rose-100 shadow-2xl backdrop-blur-md">
            <p className="font-semibold text-rose-300">Benchmark unavailable</p>
            <p className="mt-2 text-gray-200">{error}</p>
          </div>
        </div>
      )}
    </div>
  );
}
