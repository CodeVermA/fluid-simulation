'use client';

import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { FluidSolverGPU } from '../simulation/gpu/FluidSolverGPU';
import { FluidUtils } from '../simulation/gpu/FluidUtility';
import { getColor } from '../utils/colorUtils';
import { InteractionMode as InteractionModeEnum, type InteractionMode } from '../types/interactionMode';

const FPS = 60;
const MIN_SPLAT_RADIUS = 0.0001;

interface FluidCanvasGPUProps {
  width: number;
  height: number;
  boundaries: { top: boolean; bottom: boolean; left: boolean; right: boolean };
  interactionMode: InteractionMode;
  hideObstacles: boolean;
  simulationParams: {
    velocity: { x: number; y: number };
    viscosity: number;
    slipCondition: number;
    penWidth: number;
    vorticityStrength: number;
    performance: number;
  };
}

export interface FluidCanvasGPUHandle {
  reset: () => void;
}

const FluidCanvasGPU = forwardRef<FluidCanvasGPUHandle, FluidCanvasGPUProps>(
  ({ width, height, boundaries, interactionMode, hideObstacles, simulationParams }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const solverRef = useRef<FluidSolverGPU | null>(null);
    const fluidUtilsRef = useRef<FluidUtils | null>(null);

    // Refs to avoid stale closures in the animation loop
    const interactionModeRef = useRef<InteractionMode>(interactionMode);
    const hideObstaclesRef = useRef(hideObstacles);
    const simulationParamsRef = useRef(simulationParams);

    // Interaction State
    const isMouseDown = useRef(false);
    const mousePos = useRef({ x: 0, y: 0 });
    const lastMousePos = useRef({ x: 0, y: 0 });
    const hasSplatted = useRef(false);
    const colour = useRef({ r: 1, g: 1, b: 1 });

    // Update interaction mode
    useEffect(() => {
      interactionModeRef.current = interactionMode;
    }, [interactionMode]);

    useEffect(() => {
      hideObstaclesRef.current = hideObstacles;
    }, [hideObstacles]);

    // Update simulation params
    useEffect(() => {
      simulationParamsRef.current = simulationParams;
    }, [simulationParams]);

    // Expose reset method to parent
    useImperativeHandle(ref, () => ({
      reset: () => {
        if (solverRef.current) {
          solverRef.current.reset();
          solverRef.current.updateWalls(boundaries.top, boundaries.bottom, boundaries.left, boundaries.right);
        }
      }
    }));

    // Initialize GPU Solver & Debugger
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      console.log('Initializing GPU Solver...');

      try {
        solverRef.current = new FluidSolverGPU(canvas, width, height);
        fluidUtilsRef.current = new FluidUtils(solverRef.current.resources);
      } catch (e) {
        console.error("GPU Solver failed to init:", e);
        return;
      }

      solverRef.current.updateWalls(boundaries.top, boundaries.bottom, boundaries.left, boundaries.right);

      return () => {
        console.log('Cleaning up GPU Solver...');
        solverRef.current = null;
        fluidUtilsRef.current = null;
      };
    }, [width, height]); // Only re-init on size change

    // Main Animation Loop
    useEffect(() => {
      let animationId: number;

      const loop = () => {
        const solver = solverRef.current;
        const utils = fluidUtilsRef.current;

        if (solver && utils) {
          const dt = 1 / FPS;
          const mode = interactionModeRef.current;
          const params = simulationParamsRef.current;

          const freeSlip = params.slipCondition === 0;
          const viscosity = params.viscosity;
          const vorticityStrength = params.vorticityStrength;
          // Map performance 0–100% → 0-100 Jacobi iterations
          const iterations = params.performance;
          const splatRadius = MIN_SPLAT_RADIUS * params.penWidth;

          // --- Mouse Interaction ---
          if (isMouseDown.current && !hasSplatted.current) {
            const dx = mousePos.current.x - lastMousePos.current.x;
            const dy = mousePos.current.y - lastMousePos.current.y;
            const moved = Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1;

            if (moved) {
              if (mode === InteractionModeEnum.AddFluid) {
                // Mode 0: Normal simulation — add dye and velocity
                solver.splat(
                  solver.density,
                  mousePos.current.x, mousePos.current.y,
                  colour.current.r, colour.current.g, colour.current.b,
                  splatRadius,
                );
                solver.splat(
                  solver.velocity,
                  mousePos.current.x, mousePos.current.y,
                  params.velocity.x, params.velocity.y, 0.0,
                  splatRadius,
                );
              } else if (mode === InteractionModeEnum.DrawObstacles) {
                // Mode 2: Draw Obstacles
                solver.drawObstacles(
                  mousePos.current.x, mousePos.current.y,
                  0.005 + (params.penWidth / 10) * 0.015,
                );
              }
              else if (mode === InteractionModeEnum.AddHeat) {
                // Mode 1: Add Heat (increases temperature, which creates buoyancy forces)
                solver.splat(
                  solver.temperature,
                  mousePos.current.x, mousePos.current.y,
                  1.0, 0.0, 0.0, // Red channel = temperature
                  splatRadius,
                );
              }
              hasSplatted.current = true;
            }
          }
          lastMousePos.current = { ...mousePos.current };

          // --- Step Simulation ---
          solver.step(dt, freeSlip, viscosity, vorticityStrength, iterations);

          // --- Render based on interaction mode ---
          switch (mode) {
            case InteractionModeEnum.DivergenceField: // Debug view: Divergence field
              utils.renderDivergence(solver);
              break;
            case InteractionModeEnum.VelocityVectors: // Debug view: Velocity vectors
              utils.renderVelocityArrows(solver);
              break;
            case InteractionModeEnum.AddFluid:
            case InteractionModeEnum.AddHeat:
            case InteractionModeEnum.DrawObstacles:
            default: // Default simulation render
              solver.render(hideObstaclesRef.current);
              break;
          }
        }
        animationId = requestAnimationFrame(loop);
      };

      loop();

      return () => cancelAnimationFrame(animationId);
    }, []); // Empty deps: runs once, uses refs for mutable values

    // Update boundaries when changed
    useEffect(() => {
      if (solverRef.current) {
        solverRef.current.updateWalls(boundaries.top, boundaries.bottom, boundaries.left, boundaries.right);
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
        className="border-2 border-gray-700 rounded-xl shadow-2xl bg-black w-full max-w-6xl hover:border-cyan-500/50 transition-colors duration-300 cursor-crosshair"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />
    );
  }
);

FluidCanvasGPU.displayName = 'FluidCanvasGPU';
export default FluidCanvasGPU;