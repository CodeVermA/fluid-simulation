'use client';

import { useEffect, useRef } from 'react';
import { FluidSolverGPU } from '../simulation/gpu/FluidSolverGPU';
import { useState } from 'react';
import { FluidDebugger } from '../simulation/gpu/FluidDebugger';

const FORCE_MULTIPLIER = 5.0;
const SCREEN_RESOLUTION = [845, 480]; // [width, height]
const FPS = 60;

/**
 * Converts HSV color to RGB.
 * h: Hue [0, 1]
 * s: Saturation [0, 1]
 * v: Value [0, 1]
 * intensity: Multiplier for brightness [default 1.0]
 */
function HSVtoRGB(h: number, s: number, v: number, intensity: number = 1.0): { r: number; g: number; b: number } {
  let r, g, b, i, f, p, q, t;
  i = Math.floor(h * 6);
  f = h * 6 - i;
  p = v * (1 - s);
  q = v * (1 - f * s);
  t = v * (1 - (1 - f) * s);
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  return { r: (r!) * intensity, g: g! * intensity, b: b! * intensity };
}

export default function FluidCanvasGPU() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const solverRef = useRef<FluidSolverGPU | null>(null);
  const debuggerRef = useRef<FluidDebugger | null>(null);

  // Interaction State
  const isMouseDown = useRef(false);
  const mousePos = useRef({ x: 0, y: 0 });
  const lastMousePos = useRef({ x: 0, y: 0 });
  const hasSplatted = useRef(false); // Track if we've already splatted this frame

  const rgb = useRef({ r: 1, g: 1, b: 1 });
  const [boundaries, setBoundaries] = useState({ top: true, bottom: true, left: true, right: true });

  const [debugMode, setDebugMode] = useState<'normal' | 'divergence' | 'velocity' | 'obstacles'>('normal');
  const [massStats, setMassStats] = useState(0);
  const frameCount = useRef(0);

  // Main Animation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Initialize GPU Solver
    try {
      solverRef.current = new FluidSolverGPU(canvas, SCREEN_RESOLUTION[0], SCREEN_RESOLUTION[1]);
      solverRef.current.updateBoundaries(boundaries.top, boundaries.bottom, boundaries.left, boundaries.right);

      debuggerRef.current = new FluidDebugger(canvas.getContext('webgl2')!);
    } catch (e) {
      console.error("GPU Solver failed to init:", e);
      return;
    }

    let animationId: number;

    const loop = () => {
      if (solverRef.current) {
        const solver = solverRef.current;
        const debuggerTool = debuggerRef.current!;
        const dt = 1 / FPS; // Fixed timestep

        // Only splat if mouse moved (prevents continuous mass addition)
        if (isMouseDown.current && !hasSplatted.current) {
          const dx = (mousePos.current.x - lastMousePos.current.x) * FORCE_MULTIPLIER;
          const dy = (mousePos.current.y - lastMousePos.current.y) * FORCE_MULTIPLIER;

          // Only splat if there's actual movement
          const moved = Math.abs(dx) > (0.1 * FORCE_MULTIPLIER) || Math.abs(dy) > (0.1 * FORCE_MULTIPLIER);

          if (moved) {
            // A. Deposit density (dye)
            solver.splat(
              solver.density,
              mousePos.current.x,
              mousePos.current.y,
              rgb.current.r, rgb.current.g, rgb.current.b
            );

            // B. Add velocity impulse
            solver.splat(
              solver.velocity,
              mousePos.current.x,
              mousePos.current.y,
              dx, -dy, 0.0
            );

            hasSplatted.current = true;
          }
        }
        lastMousePos.current = { ...mousePos.current };

        // Curl & Vorticity
        solver.computeCurl(solver.velocity, solver.curl);
        solver.applyVorticity(solver.velocity, solver.curl, dt);
        solver.enforceBoundaries(0.99); // Enforce after vorticity

        // Step Simulation
        solver.step(dt);

        if (debugMode === 'normal') {
          solver.render();
        } else {
          debuggerRef.current!.render(solver, debugMode);
        }

        // Update Mass Stats every 15 frames
        frameCount.current++;
        if (frameCount.current % 15 === 0) {
          const mass = debuggerTool.measureMass(solver);
          setMassStats(mass);
        }
      }
      animationId = requestAnimationFrame(loop);
    };

    loop();

    return () => cancelAnimationFrame(animationId);
  }, [debugMode]);

  // Update boundaries when changed
  useEffect(() => {
    if (solverRef.current) {
      solverRef.current.updateBoundaries(boundaries.top, boundaries.bottom, boundaries.left, boundaries.right);
    }
  }, [boundaries]);


  // --- Mouse Handlers ---
  const handlePointerDown = (e: React.PointerEvent) => {
    // Update color based on time
    rgb.current = HSVtoRGB(((Date.now() / 20) % 360) / 360, 1.0, 1.0, 0.5);

    const rect = e.currentTarget.getBoundingClientRect(); // canvas bounds
    // Map from display coordinates to internal canvas resolution
    const x = ((e.clientX - rect.left) / rect.width) * SCREEN_RESOLUTION[0];
    const y = ((e.clientY - rect.top) / rect.height) * SCREEN_RESOLUTION[1];

    isMouseDown.current = true;
    mousePos.current = { x, y };
    lastMousePos.current = { x, y };
    hasSplatted.current = false; // Reset to allow first splat

    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isMouseDown.current) return;

    const rect = e.currentTarget.getBoundingClientRect();
    // Map from display coordinates to internal canvas resolution
    mousePos.current = {
      x: ((e.clientX - rect.left) / rect.width) * SCREEN_RESOLUTION[0],
      y: ((e.clientY - rect.top) / rect.height) * SCREEN_RESOLUTION[1]
    };

    // Allow splatting again since mouse moved
    hasSplatted.current = false;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isMouseDown.current = false;
    hasSplatted.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div className="relative flex flex-col items-center justify-center min-h-screen p-8 w-full bg-gradient-to-b from-gray-900 to-black">
      {/* Header */}
      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-2">
          GPU Fluid Solver
        </h2>
        <p className="text-gray-400 text-sm">Real-time WebGL2 simulation • Drag to interact</p>
      </div>

      {/* Main Canvas */}
      <canvas
        ref={canvasRef}
        width={SCREEN_RESOLUTION[0]}
        height={SCREEN_RESOLUTION[1]}
        className="border-2 border-gray-700 rounded-xl shadow-2xl cursor-crosshair bg-black w-full max-w-6xl hover:border-cyan-500/50 transition-colors duration-300"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />

      {/* Controls Panel */}
      <div className="mt-8 w-full max-w-6xl grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Boundary Controls */}
        <div className="bg-gray-800/60 backdrop-blur-sm border border-gray-700 rounded-xl p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-cyan-400 mb-4 flex items-center gap-2">
            <span className="text-xl"></span> Boundary Conditions
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2 text-gray-300 hover:text-white cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={boundaries.top}
                onChange={e => setBoundaries({ ...boundaries, top: e.target.checked })}
                className="w-4 h-4 accent-cyan-500"
              />
              <span>Top Wall</span>
            </label>
            <label className="flex items-center gap-2 text-gray-300 hover:text-white cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={boundaries.bottom}
                onChange={e => setBoundaries({ ...boundaries, bottom: e.target.checked })}
                className="w-4 h-4 accent-cyan-500"
              />
              <span>Bottom Wall</span>
            </label>
            <label className="flex items-center gap-2 text-gray-300 hover:text-white cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={boundaries.left}
                onChange={e => setBoundaries({ ...boundaries, left: e.target.checked })}
                className="w-4 h-4 accent-cyan-500"
              />
              <span>Left Wall</span>
            </label>
            <label className="flex items-center gap-2 text-gray-300 hover:text-white cursor-pointer transition-colors">
              <input
                type="checkbox"
                checked={boundaries.right}
                onChange={e => setBoundaries({ ...boundaries, right: e.target.checked })}
                className="w-4 h-4 accent-cyan-500"
              />
              <span>Right Wall</span>
            </label>
          </div>
        </div>

        {/* Debug Panel */}
        <div className="bg-gray-800/60 backdrop-blur-sm border border-gray-700 rounded-xl p-6 shadow-lg">
          <h3 className="text-lg font-semibold text-blue-400 mb-4 flex items-center gap-2">
            <span className="text-xl">🔍</span> Debug & Statistics
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Total Mass:</span>
              <span className="font-mono text-cyan-400 text-lg font-semibold">{massStats.toFixed(1)}</span>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-gray-400 text-sm">Visualization Mode:</label>
              <select
                value={debugMode}
                onChange={(e) => setDebugMode(e.target.value as any)}
                className="bg-gray-900 text-white p-2 rounded-lg border border-gray-600 hover:border-blue-500 focus:border-blue-500 focus:outline-none transition-colors cursor-pointer"
              >
                <option value="normal">Normal (Density)</option>
                <option value="divergence">Divergence Field</option>
                <option value="velocity">Velocity Vectors</option>
                <option value="obstacles">Obstacle Map</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}