'use client';

import { useState } from 'react';
import Link from "next/link";
import FluidCanvasBenchmark from "../components/FluidCanvasBenchmark";
import { BackIcon } from '../components/Icons';
import {
  BENCHMARK_DURATION_MS,
  BENCHMARK_RESOLUTION,
  BENCHMARK_SOLVER_ITERATIONS,
  type BenchmarkResult,
} from '../utils/benchmarkUtils';

type BenchmarkStatus = 'idle' | 'running' | 'complete' | 'error';

export default function BenchmarkPage() {
  const [runId, setRunId] = useState(0);
  const [status, setStatus] = useState<BenchmarkStatus>('idle');
  const [result, setResult] = useState<BenchmarkResult | null>(null);

  const handleStart = () => {
    setResult(null);
    setStatus('running');
    setRunId((currentRunId) => currentRunId + 1);
  };

  const buttonLabel =
    status === 'running'
      ? 'Benchmark Running...'
      : runId === 0
        ? 'Start Benchmark'
        : status === 'error'
          ? 'Try Again'
          : 'Run Again';

  const benchmarkSummary = result
    ? [
        `Solver Iterations: ${BENCHMARK_SOLVER_ITERATIONS}`,
        `Average FPS: ${result.averageFps.toFixed(1)}`,
        `1% Low: ${result.onePercentLowFps.toFixed(1)}`,
        `Device Memory: ${result.deviceMemory}`,
        `Platform/OS: ${result.platformOs}`,
        `Renderer: ${result.renderer}`,
        `Sampled Frames: ${result.sampledFrames}`,
      ].join('\n')
    : '';

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.18),_transparent_32%),linear-gradient(180deg,_#111827_0%,_#030712_100%)] text-white">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 p-4 md:p-6">
        <header className="rounded-3xl border border-white/10 bg-gray-900/60 p-5 shadow-2xl backdrop-blur-sm md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-sm text-cyan-300 transition-colors duration-200 hover:text-cyan-200"
              >
                <BackIcon className="size-5" />
                Home
              </Link>
              <div>
                <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-300 to-blue-500 md:text-4xl">
                  GPU Benchmark
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-gray-300 md:text-base">
                  This page runs a fixed 60 second fluid workload with the same
                  resolution and solver iterations for everyone, then records benchmark
                  results from the live simulation.
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-gray-200">
                <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5">
                  Resolution: {BENCHMARK_RESOLUTION.width} x {BENCHMARK_RESOLUTION.height}
                </span>
                <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5">
                  Solver Iterations: {BENCHMARK_SOLVER_ITERATIONS}
                </span>
                <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5">
                  Duration: {BENCHMARK_DURATION_MS / 1000}s
                </span>
              </div>
            </div>

            <div className="flex flex-col items-start gap-3 lg:items-end">
              <button
                onClick={handleStart}
                disabled={status === 'running'}
                className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm font-medium text-cyan-200 transition-colors duration-200 hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:border-gray-700 disabled:bg-gray-900/60 disabled:text-gray-500"
              >
                {buttonLabel}
              </button>
              {result && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricCard label="Average FPS" value={result.averageFps.toFixed(1)} />
                  <MetricCard label="1% Low" value={result.onePercentLowFps.toFixed(1)} />
                  <MetricCard label="Device Memory" value={result.deviceMemory} />
                  <MetricCard label="Platform/OS" value={result.platformOs} />
                </div>
              )}
            </div>
          </div>

          {result && (
            <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-4 text-sm text-gray-300">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                Copy This Summary
              </p>
              <pre className="select-all whitespace-pre-wrap rounded-xl border border-white/10 bg-black/30 p-4 font-mono text-sm leading-6 text-gray-200">
                {benchmarkSummary}
              </pre>
            </div>
          )}
        </header>

        <section className="relative flex-1 rounded-3xl border border-white/10 bg-black/30 p-3 shadow-2xl backdrop-blur-sm md:p-5">
          <FluidCanvasBenchmark
            key={runId}
            startOnMount={runId > 0}
            onComplete={(nextResult) => {
              setResult(nextResult);
              setStatus('complete');
            }}
            onInitializationError={() => {
              setResult(null);
              setStatus('error');
            }}
          />
        </section>
      </div>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-32 rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-left">
      <p className="text-xs uppercase tracking-[0.2em] text-gray-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}
