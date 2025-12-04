'use client';

import { useEffect, useRef, useCallback } from 'react';
import { FluidSolver } from '../simulation/cpu/FluidSolver';

// CONSTANTS
const SCALE_FACTOR = 8;
const TIME_STEP = 0.1;
const DENSITY_AMOUNT = 1;
const VELOCITY = { x: 15, y: 0};

// TYPES
interface Props {
  width: number;
  height: number;
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
export default function FluidCanvas({ width, height }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null); // Canvas Element
  const solverRef = useRef<FluidSolver | null>(null); // Fluid Solver Instance
  let animationId: number;

  // Animation Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    console.log('Initializing Fluid Simulation...');
    
    solverRef.current = new FluidSolver(width); // Assuming square grid for simplicity

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
  }, [width, height]);

  // Event Handlers
  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!solverRef.current) return;

    const { x, y } = getGridCoordinates(e);
    solverRef.current.addDensity(y, x, DENSITY_AMOUNT);
    solverRef.current.addVelocity(y, x, VELOCITY.x, VELOCITY.y);

    console.log(`Added density at Grid: (${x}, ${y})`);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.buttons !== 1 || !solverRef.current) return; // Only respond to primary button drag

    const { x, y } = getGridCoordinates(e);
    solverRef.current.addDensity(y, x, DENSITY_AMOUNT);
    solverRef.current.addVelocity(y, x, VELOCITY.x, VELOCITY.y);

    console.log(`Added density at Grid: (${x}, ${y})`);
  }, []);
  

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