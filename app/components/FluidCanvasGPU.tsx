'use client';

import { useEffect, useRef } from 'react';
import { FluidSolverGPU } from '../simulation/gpu/FluidSolverGPU';

const FORCE_MULTIPLIER = 3.0;
const SCREEN_RESOLUTION = [1280, 720]; // [width, height]
const FPS = 165;

export default function FluidCanvasGPU() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const solverRef = useRef<FluidSolverGPU | null>(null);

  // Interaction State
  const isMouseDown = useRef(false);
  const mousePos = useRef({ x: 0, y: 0 });
  const lastMousePos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Initialize GPU Solver
    try {
        solverRef.current = new FluidSolverGPU(canvas, SCREEN_RESOLUTION[0], SCREEN_RESOLUTION[1]);
    } catch (e) {
        console.error("GPU Solver failed to init:", e);
        return;
    }

    let animationId: number;

    const loop = () => {
      if (solverRef.current) {
        const solver = solverRef.current;
        const dt = 1/FPS; // Fixed timestep

        if (isMouseDown.current) {
            const dx = (mousePos.current.x - lastMousePos.current.x) * FORCE_MULTIPLIER;
            const dy = (mousePos.current.y - lastMousePos.current.y) * FORCE_MULTIPLIER;

            // A. Splat White Dye into Density
            solver.splat(
                solver.density, 
                mousePos.current.x, 
                mousePos.current.y, 
                1.0, 1.0, 1.0 // White
            );

            // B. Splat Impulse into Velocity
            solver.splat(
                solver.velocity,
                mousePos.current.x,
                mousePos.current.y,
                dx, -dy, 0.0 // x=dx, y=-dy
            );
        }
        lastMousePos.current = { ...mousePos.current };

        // 1. Calculate Curl
        solver.computeCurl(solver.velocity, solver.curl);
        // 2. Apply Vorticity Confinement (Boost the swirls)
        solver.applyVorticity(solver.velocity, solver.curl, dt);
        // 3. Advect Velocity (Momentum)
        solver.advect(solver.velocity, solver.velocity, dt);
        // 4. Project
        solver.project();
        // 5. Advect Density (Dye)
        solver.advect(solver.density, solver.velocity, dt);

        solver.render();
      }
      animationId = requestAnimationFrame(loop);
    };

    loop();

    return () => cancelAnimationFrame(animationId);
  }, []);

  // --- Mouse Handlers ---
  const handlePointerDown = (e: React.PointerEvent) => {
    const rect = e.currentTarget.getBoundingClientRect(); // canvas bounds
    // Map from display coordinates to internal canvas resolution
    const x = ((e.clientX - rect.left) / rect.width) * SCREEN_RESOLUTION[0];
    const y = ((e.clientY - rect.top) / rect.height) * SCREEN_RESOLUTION[1];
    
    isMouseDown.current = true;
    mousePos.current = { x, y };
    lastMousePos.current = { x, y };
    
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
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isMouseDown.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  return (
    <div className="flex flex-col items-center justify-center p-4 w-full">
        <h2 className="text-xl font-bold mb-4 text-white">GPU Fluid Solver</h2>
        <canvas 
            ref={canvasRef}
            width={SCREEN_RESOLUTION[0]}
            height={SCREEN_RESOLUTION[1]}
            className="border border-gray-600 rounded-lg shadow-2xl cursor-crosshair bg-black w-full max-w-4xl"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
        />
        <p className="mt-2 text-gray-400 text-sm">Drag to inject fluid. Watch the swirls!</p>
    </div>
  );
}