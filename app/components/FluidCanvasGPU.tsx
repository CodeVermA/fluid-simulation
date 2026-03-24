'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { FluidSolverGPU } from '../simulation/FluidSolver';
import { FluidUtils } from '../simulation/FluidUtility';
import { getColor } from '../utils/colorUtils';
import { createFPSTracker, sampleFPS } from '../utils/fpsUtils';
import { InteractionMode as InteractionModeEnum, type InteractionMode } from '../types/interactionMode';

const FPS = 165;
const MIN_SPLAT_RADIUS = 0.0001;

export interface FluidCanvasSimulationParams {
  temperature: number;
  velocity: { x: number; y: number };
  viscosity: number;
  slipCondition: number;
  penWidth: number;
  vorticityStrength: number;
  performance: number;
}

export interface FluidCanvasRuntime {
  solver: FluidSolverGPU;
  utils: FluidUtils;
  width: number;
  height: number;
}

export interface FluidCanvasFrameContext extends FluidCanvasRuntime {
  nowMs: number;
  dt: number;
  interactionMode: InteractionMode;
  simulationParams: FluidCanvasSimulationParams;
}

export interface FluidCanvasAutomation {
  onReady?: (runtime: FluidCanvasRuntime) => void;
  onBeforeStep?: (context: FluidCanvasFrameContext) => boolean | void;
}

interface FluidCanvasGPUProps {
  width: number;
  height: number;
  boundaries: { top: boolean; bottom: boolean; left: boolean; right: boolean };
  interactionMode: InteractionMode;
  obstacleEraser: boolean;
  hideObstacles: boolean;
  simulationParams: FluidCanvasSimulationParams;
  showFPS?: boolean;
  interactive?: boolean;
  automation?: FluidCanvasAutomation;
  onInitializationError?: (message: string) => void;
}

export interface FluidCanvasGPUHandle {
  reset: () => void;
}

const FluidCanvasGPU = forwardRef<FluidCanvasGPUHandle, FluidCanvasGPUProps>(
  (
    {
      width,
      height,
      boundaries,
      interactionMode,
      obstacleEraser,
      hideObstacles,
      simulationParams,
      showFPS = true,
      interactive = true,
      automation,
      onInitializationError,
    },
    ref,
  ) => {
    const [fpsDisplay, setFpsDisplay] = useState(0);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const solverRef = useRef<FluidSolverGPU | null>(null);
    const fluidUtilsRef = useRef<FluidUtils | null>(null);

    const canvasSizeRef = useRef({ width, height });
    const boundariesRef = useRef(boundaries);
    const interactionModeRef = useRef<InteractionMode>(interactionMode);
    const obstacleEraserRef = useRef(obstacleEraser);
    const hideObstaclesRef = useRef(hideObstacles);
    const simulationParamsRef = useRef(simulationParams);
    const showFPSRef = useRef(showFPS);
    const interactiveRef = useRef(interactive);
    const automationRef = useRef(automation);
    const onInitializationErrorRef = useRef(onInitializationError);
    const fpsTrackerRef = useRef(createFPSTracker(500));

    const isMouseDown = useRef(false);
    const mousePos = useRef({ x: 0, y: 0 });
    const lastMousePos = useRef({ x: 0, y: 0 });
    const hasSplatted = useRef(false);
    const colour = useRef({ r: 1, g: 1, b: 1 });

    useEffect(() => {
      canvasSizeRef.current = { width, height };
    }, [width, height]);

    useEffect(() => {
      boundariesRef.current = boundaries;
    }, [boundaries]);

    useEffect(() => {
      interactionModeRef.current = interactionMode;
    }, [interactionMode]);

    useEffect(() => {
      hideObstaclesRef.current = hideObstacles;
    }, [hideObstacles]);

    useEffect(() => {
      obstacleEraserRef.current = obstacleEraser;
    }, [obstacleEraser]);

    useEffect(() => {
      simulationParamsRef.current = simulationParams;
    }, [simulationParams]);

    useEffect(() => {
      showFPSRef.current = showFPS;
    }, [showFPS]);

    useEffect(() => {
      interactiveRef.current = interactive;
    }, [interactive]);

    useEffect(() => {
      automationRef.current = automation;
    }, [automation]);

    useEffect(() => {
      onInitializationErrorRef.current = onInitializationError;
    }, [onInitializationError]);

    useImperativeHandle(ref, () => ({
      reset: () => {
        if (solverRef.current) {
          solverRef.current.reset();
          solverRef.current.updateWalls(
            boundariesRef.current.top,
            boundariesRef.current.bottom,
            boundariesRef.current.left,
            boundariesRef.current.right,
          );
        }
      },
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      try {
        const solver = new FluidSolverGPU(canvas, width, height);
        const utils = new FluidUtils(solver.resources);

        solverRef.current = solver;
        fluidUtilsRef.current = utils;

        solver.updateWalls(
          boundariesRef.current.top,
          boundariesRef.current.bottom,
          boundariesRef.current.left,
          boundariesRef.current.right,
        );

        automationRef.current?.onReady?.({
          solver,
          utils,
          width,
          height,
        });
      } catch (e) {
        const message =
          e instanceof Error ? e.message : 'Unable to initialize GPU solver';
        onInitializationErrorRef.current?.(message);
        return;
      }

      return () => {
        solverRef.current = null;
        fluidUtilsRef.current = null;
      };
    }, [width, height]);

    useEffect(() => {
      let animationId: number;

      fpsTrackerRef.current = createFPSTracker(500, performance.now());

      const loop = () => {
        const solver = solverRef.current;
        const utils = fluidUtilsRef.current;

        if (solver && utils) {
          const nowMs = performance.now();
          const dt = 1 / FPS;
          const mode = interactionModeRef.current;
          const params = simulationParamsRef.current;
          const freeSlip = params.slipCondition === 0;
          const viscosity = params.viscosity;
          const vorticityMultiplier = params.vorticityStrength;
          const iterations = params.performance;
          const splatRadius = MIN_SPLAT_RADIUS * params.penWidth;

          if (interactiveRef.current && isMouseDown.current && !hasSplatted.current) {
            const dx = mousePos.current.x - lastMousePos.current.x;
            const dy = mousePos.current.y - lastMousePos.current.y;
            const moved = Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1;

            if (moved) {
              if (mode === InteractionModeEnum.AddVelocity) {
                solver.splat(
                  solver.density,
                  mousePos.current.x,
                  mousePos.current.y,
                  colour.current.r,
                  colour.current.g,
                  colour.current.b,
                  splatRadius,
                );
                solver.splat(
                  solver.velocity,
                  mousePos.current.x,
                  mousePos.current.y,
                  params.velocity.x,
                  params.velocity.y,
                  0.0,
                  splatRadius,
                );
              } else if (mode === InteractionModeEnum.DrawObstacles) {
                solver.drawObstacles(
                  mousePos.current.x,
                  mousePos.current.y,
                  splatRadius * 0.25,
                  obstacleEraserRef.current,
                );
              } else if (mode === InteractionModeEnum.ChangeTemp) {
                solver.splat(
                  solver.temperature,
                  mousePos.current.x,
                  mousePos.current.y,
                  params.temperature,
                  0.0,
                  0.0,
                  splatRadius,
                );
              }

              hasSplatted.current = true;
            }
          }

          lastMousePos.current = { ...mousePos.current };

          const shouldAdvanceSimulation =
            automationRef.current?.onBeforeStep?.({
              solver,
              utils,
              width: canvasSizeRef.current.width,
              height: canvasSizeRef.current.height,
              nowMs,
              dt,
              interactionMode: mode,
              simulationParams: params,
            }) !== false;

          if (shouldAdvanceSimulation) {
            solver.step(dt, freeSlip, viscosity, vorticityMultiplier, iterations);

            switch (mode) {
              case InteractionModeEnum.VelocityVectors:
                utils.renderVelocityArrows(solver);
                break;

              default:
                solver.render(hideObstaclesRef.current);
                break;
            }
          } else {
            solver.render(hideObstaclesRef.current);
          }

          if (showFPSRef.current) {
            const measuredFps = sampleFPS(fpsTrackerRef.current, nowMs);
            if (measuredFps !== null) {
              setFpsDisplay(measuredFps);
            }
          }
        }

        animationId = requestAnimationFrame(loop);
      };

      loop();

      return () => cancelAnimationFrame(animationId);
    }, []);

    useEffect(() => {
      if (solverRef.current) {
        solverRef.current.updateWalls(
          boundaries.top,
          boundaries.bottom,
          boundaries.left,
          boundaries.right,
        );
      }
    }, [boundaries]);

    const handlePointerDown = (e: React.PointerEvent) => {
      if (!interactive) return;

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
      if (!interactive || !isMouseDown.current) return;

      const rect = e.currentTarget.getBoundingClientRect();
      mousePos.current = {
        x: ((e.clientX - rect.left) / rect.width) * width,
        y: ((e.clientY - rect.top) / rect.height) * height,
      };

      hasSplatted.current = false;
    };

    const handlePointerUp = (e: React.PointerEvent) => {
      if (!interactive) return;

      isMouseDown.current = false;
      hasSplatted.current = false;
      e.currentTarget.releasePointerCapture(e.pointerId);
    };

    return (
      <div className="relative w-full max-w-7xl">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className={`border-2 border-gray-700 rounded-xl shadow-2xl bg-black w-full transition-colors duration-300 ${
            interactive ? 'hover:border-cyan-500/50 cursor-crosshair' : 'cursor-default'
          }`}
          onPointerDown={interactive ? handlePointerDown : undefined}
          onPointerMove={interactive ? handlePointerMove : undefined}
          onPointerUp={interactive ? handlePointerUp : undefined}
        />
        {showFPS && (
          <div className="pointer-events-none absolute top-3 right-3 rounded-md border border-gray-600 bg-gray-900/80 px-2 py-1 text-xs font-medium text-cyan-300 backdrop-blur-sm">
            FPS: {fpsDisplay}
          </div>
        )}
      </div>
    );
  },
);

FluidCanvasGPU.displayName = 'FluidCanvasGPU';

export default FluidCanvasGPU;
