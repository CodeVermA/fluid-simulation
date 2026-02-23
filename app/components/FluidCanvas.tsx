'use client';

import { useEffect, useRef, useCallback } from 'react';
import { FluidSolver } from '../simulation/cpu/FluidSolver';
import { InteractionMode } from '../types/interactionMode';

// CONSTANTS
const SCALE_FACTOR = 8;
const TIME_STEP = 0.1;
const DENSITY_AMOUNT = 1;
const VELOCITY = { x: 0, y: 10 };

// TYPES
interface Props {
  width: number;
  height: number;
  interactionMode: InteractionMode;
}

interface GridCoordinates {
  x: number;
  y: number;
}

// HELPER FUNCTIONS
function getGridCoordinates(e: React.PointerEvent<HTMLCanvasElement>,): GridCoordinates {
  const rect = e.currentTarget.getBoundingClientRect();

  return {
    x: Math.floor((e.clientX - rect.left) / SCALE_FACTOR),
    y: Math.floor((e.clientY - rect.top) / SCALE_FACTOR),
  };
}

// COMPONENT
export default function FluidCanvas({ width, height, interactionMode }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null); // Canvas Element
  const solverRef = useRef<FluidSolver | null>(null); // Fluid Solver Instance
  const interactionModeRef = useRef(interactionMode); // Mode ref to avoid re-init

  // Update mode ref when prop changes (without triggering re-init)
  useEffect(() => {
    interactionModeRef.current = interactionMode;
  }, [interactionMode]);

  // Initialize Solver (only on mount or size change)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    console.log('Initializing CPU Fluid Solver...');
    solverRef.current = new FluidSolver(width); // Assuming square grid for simplicity

    return () => {
      console.log('Cleaning up CPU Solver...');
      solverRef.current = null;
    };
  }, [width, height]);

  // Animation Loop (runs independently of mode changes)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const loop = () => {
      if (solverRef.current) {
        solverRef.current.step(TIME_STEP);
        solverRef.current.render(ctx);
      }
      animationId = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, []); // Empty deps: runs once, never re-initializes

  // Event Handlers
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!solverRef.current) return;

    const { x, y } = getGridCoordinates(e);

    if (interactionModeRef.current === 'simulate') {
      solverRef.current.addDensity(y, x, DENSITY_AMOUNT);
      solverRef.current.addVelocity(y, x, VELOCITY.x, VELOCITY.y);
      console.log(`Added density at Grid: (${x}, ${y})`);
    } else if (interactionModeRef.current === 'draw-obstacles') {
      // TODO: Add obstacle drawing support for CPU solver
      console.log(`Draw obstacle at Grid: (${x}, ${y})`);
    }
  }, []); // No dependencies - reads from ref

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.buttons !== 1 || !solverRef.current) return; // Only respond to primary button drag

    const { x, y } = getGridCoordinates(e);

    if (interactionModeRef.current === 'simulate') {
      solverRef.current.addDensity(y, x, DENSITY_AMOUNT);
      solverRef.current.addVelocity(y, x, VELOCITY.x, VELOCITY.y);
      console.log(`Added density at Grid: (${x}, ${y})`);
    } else if (interactionModeRef.current === 'draw-obstacles') {
      // TODO: Add obstacle drawing support for CPU solver
      console.log(`Draw obstacle at Grid: (${x}, ${y})`);
    }
  }, []); // No dependencies - reads from ref


  // Render
  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="border border-gray-700 shadow-lg rounded-lg"
      style={{
        width: `${width * SCALE_FACTOR}px`,
        height: `${height * SCALE_FACTOR}px`,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
    />
  );
}