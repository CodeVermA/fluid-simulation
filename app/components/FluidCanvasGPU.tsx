'use client';

import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { FluidSolverGPU } from '../simulation/gpu/FluidSolverGPU';
import { FluidDebugger } from '../simulation/gpu/FluidDebugger';
import { getColor } from '../utils/colorUtils';
import { InteractionMode } from '../types/interactionMode';

const FORCE_MULTIPLIER = 50.0;
const FPS = 60;

interface FluidCanvasGPUProps {
  width: number;
  height: number;
  debugMode: 'normal' | 'divergence' | 'velocity' | 'obstacles';
  boundaries: { top: boolean; bottom: boolean; left: boolean; right: boolean };
  interactionMode: InteractionMode;
  onMassUpdate?: (mass: number) => void;
}

export interface FluidCanvasGPUHandle {
  reset: () => void;
}

const FluidCanvasGPU = forwardRef<FluidCanvasGPUHandle, FluidCanvasGPUProps>(
  ({ width, height, debugMode, boundaries, interactionMode, onMassUpdate }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const solverRef = useRef<FluidSolverGPU | null>(null);
    const debuggerRef = useRef<FluidDebugger | null>(null);

    // Interaction State
    const isMouseDown = useRef(false);
    const mousePos = useRef({ x: 0, y: 0 });
    const lastMousePos = useRef({ x: 0, y: 0 });
    const hasSplatted = useRef(false);
    const colour = useRef({ r: 1, g: 1, b: 1 });
    const frameCount = useRef(0);

    // Mode State Refs (to avoid re-initialization on mode change)
    const debugModeRef = useRef(debugMode);
    const interactionModeRef = useRef(interactionMode);

    // Update Divergence | Velocity | Obstacles map
    useEffect(() => {
      debugModeRef.current = debugMode;
    }, [debugMode]);

    // Update Simulate | Draw-Obstacles mode
    useEffect(() => {
      interactionModeRef.current = interactionMode;
    }, [interactionMode]);

    // Expose reset method to parent
    useImperativeHandle(ref, () => ({
      reset: () => {
        if (solverRef.current) {
          solverRef.current.reset();
          frameCount.current = 0;
          onMassUpdate?.(0);
        }
      }
    }));

    // Initialize GPU Solver
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      console.log('Initializing GPU Solver...');

      try {
        solverRef.current = new FluidSolverGPU(canvas, width, height);
        solverRef.current.updateBoundaries(boundaries.top, boundaries.bottom, boundaries.left, boundaries.right);
        debuggerRef.current = new FluidDebugger(canvas.getContext('webgl2')!);
      } catch (e) {
        console.error("GPU Solver failed to init:", e);
        return;
      }

      return () => {
        // Cleanup solver resources when component unmounts or size changes
        console.log('Cleaning up GPU Solver...');
        solverRef.current = null;
        debuggerRef.current = null;
      };
    }, [width, height]); // Only re-init on size change

    // Main Animation Loop 
    useEffect(() => {
      let animationId: number;

      const loop = () => {
        if (solverRef.current && debuggerRef.current) {
          const solver = solverRef.current;
          const debuggerTool = debuggerRef.current;
          const dt = 1 / FPS; // Fixed timestep

          // Handle Mouse Interaction based on current mode (read from ref)
          if (isMouseDown.current && !hasSplatted.current) {
            const dx = (mousePos.current.x - lastMousePos.current.x) * FORCE_MULTIPLIER;
            const dy = (mousePos.current.y - lastMousePos.current.y) * FORCE_MULTIPLIER;

            // Only splat if there's actual movement
            const moved = Math.abs(dx) > (0.1 * FORCE_MULTIPLIER) || Math.abs(dy) > (0.1 * FORCE_MULTIPLIER);

            if (moved) {
              if (interactionModeRef.current === 'simulate') {
                // Simulate mode: Add fluid velocity and density
                // A. Deposit density (dye)
                solver.splat(
                  solver.density,
                  mousePos.current.x,
                  mousePos.current.y,
                  colour.current.r, colour.current.g, colour.current.b
                );

                // B. Add velocity impulse
                solver.splat(
                  solver.velocity,
                  mousePos.current.x,
                  mousePos.current.y,
                  dx, -dy, 0.0
                );
              } else if (interactionModeRef.current === 'draw-obstacles') {
                // Draw obstacles mode: Paint obstacles at cursor position
                solver.drawObstacles(
                  mousePos.current.x,
                  mousePos.current.y,
                  0.005 // Brush radius
                );
              }

              hasSplatted.current = true;
            }
          }
          lastMousePos.current = { ...mousePos.current };

          // Step Simulation
          solver.step(dt, true);

          // Render based on current debug mode (read from ref)
          if (debugModeRef.current === 'normal') {
            solver.render();
          } else {
            debuggerTool.render(solver, debugModeRef.current);
          }

          // Update Mass Stats every 60 frames
          frameCount.current++;
          if (frameCount.current % 60 === 0 && onMassUpdate) {
            const mass = debuggerTool.measureMass(solver);
            onMassUpdate(mass);
          }
        }
        animationId = requestAnimationFrame(loop);
      };

      loop();

      return () => cancelAnimationFrame(animationId);
    }, []); // Empty deps: runs once, never re-initializes

    // Update boundaries when changed
    useEffect(() => {
      if (solverRef.current) {
        solverRef.current.updateBoundaries(boundaries.top, boundaries.bottom, boundaries.left, boundaries.right);
      }
    }, [boundaries]);


    // --- Mouse Handlers ---
    const handlePointerDown = (e: React.PointerEvent) => {
      colour.current = getColor(Date.now());

      const rect = e.currentTarget.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * width;
      const y = ((e.clientY - rect.top) / rect.height) * height;

      isMouseDown.current = true;
      mousePos.current = { x, y };
      lastMousePos.current = { x, y };
      hasSplatted.current = false;

      e.currentTarget.setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
      if (!isMouseDown.current) return;

      const rect = e.currentTarget.getBoundingClientRect();
      mousePos.current = {
        x: ((e.clientX - rect.left) / rect.width) * width,
        y: ((e.clientY - rect.top) / rect.height) * height
      };

      hasSplatted.current = false;
    };

    const handlePointerUp = (e: React.PointerEvent) => {
      isMouseDown.current = false;
      hasSplatted.current = false;
      e.currentTarget.releasePointerCapture(e.pointerId);
    };

    return (
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className={`border-2 border-gray-700 rounded-xl shadow-2xl bg-black w-full max-w-6xl hover:border-cyan-500/50 transition-colors duration-300 ${interactionMode === 'simulate' ? 'cursor-crosshair' : 'cursor-cell'
          }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
    );
  }
);

FluidCanvasGPU.displayName = 'FluidCanvasGPU';
export default FluidCanvasGPU;