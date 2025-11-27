'use client';

import { useEffect, useRef } from 'react';
// We will import the solver here in Week 2
// import { FluidSolver } from '../simulation/cpu/FluidSolver';

interface Props {
  width: number;
  height: number;
}

export default function FluidCanvas({ width, height }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // --- INITIALIZATION ---
    console.log("Initializing Fluid Simulation...");
    // const solver = new FluidSolver(width, height);

    let animationId: number;

    // --- SIMULATION LOOP ---
    const loop = () => {
      // 1. Update Physics
      // solver.step();

      // 2. Draw
      // ctx.clearRect(0, 0, width, height); // Clear screen
      // solver.render(ctx); 
      
      // Temporary: Just prove it's running
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = 'cyan';
      ctx.fillText(`Sim Running: ${Date.now()}`, 20, 30);

      animationId = requestAnimationFrame(loop);
    };

    loop();

    // --- CLEANUP ---
    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [width, height]);

  return (
    <canvas 
      ref={canvasRef} 
      width={width} 
      height={height}
      className="border border-gray-700 shadow-lg rounded-lg"
      style={{ width: '512px', height: '512px' }} // Scale up visually
    />
  );
}