'use client';

import { useRef, useState } from 'react';
import FluidCanvasGPU, { FluidCanvasGPUHandle } from "../components/FluidCanvasGPU";
import Link from "next/link";
import { BackIcon, ClearIcon } from '../components/Icons';
import {
  INTERACTION_MODE_LIST,
  InteractionMode as InteractionModeEnum,
  type InteractionMode,
} from '../types/interactionMode';

const SCREEN_RESOLUTION = [640, 360];

export default function GPUPage() {
  const canvasRef = useRef<FluidCanvasGPUHandle>(null);
  const [boundaries, setBoundaries] = useState({ top: true, bottom: true, left: true, right: true });
  const [isMenuExpanded, setIsMenuExpanded] = useState(false);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>(InteractionModeEnum.AddVelocity);
  const [hideObstacles, setHideObstacles] = useState(true);

  // Simulation parameters
  const [simulationParams, setSimulationParams] = useState({
    temperature: 0,
    velocity: { x: 0, y: 0 },
    viscosity: 0.0001,
    performance: 50,
    slipCondition: 0,
    penWidth: 5,
    vorticityStrength: 1,
  });

  const handleReset = () => {
    canvasRef.current?.reset();
  };

  return (
    <div className="flex h-screen bg-gradient-to-b from-gray-900 to-black text-white overflow-hidden relative">
      {/* Mobile Overlay */}
      {isMenuExpanded && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={() => setIsMenuExpanded(false)}
        />
      )}

      {/* Mobile Toggle Button */}
      <button
        onClick={() => setIsMenuExpanded(!isMenuExpanded)}
        className="md:hidden fixed top-4 left-4 z-50 bg-gray-800/90 backdrop-blur-sm border border-gray-600 text-white p-3 rounded-lg shadow-lg hover:bg-gray-700 transition-colors"
        aria-label="Toggle settings"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {isMenuExpanded ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Left Sidebar - Controls Panel */}
      <aside className={`
        w-90 bg-gray-800/40 backdrop-blur-sm border-r border-gray-700 flex flex-col overflow-y-auto
        md:relative md:translate-x-0
        fixed inset-y-0 left-0 z-40 transition-transform duration-300 ease-in-out
        ${isMenuExpanded ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Header Section */}
        <div className="p-6 border-b border-gray-700">
          <Link
            href="/"
            className="group text-blue-400 hover:text-blue-300 transition-colors duration-200 text-sm inline-flex items-center gap-2 mb-2"
          >
            {/* Arrow */}
            <BackIcon className="transition-transform duration-200 group-hover:-translate-x-0.5" />
            Home
          </Link>

          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-2">
            FLUID SIMULATION
          </h1>
          <div className="flex items-center justify-between gap-4">
            <p className="text-gray-400 text-xs">Real-time WebGL2 simulation</p>
            <button
              onClick={handleReset}
              className="flex items-center justify-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-400 bg-gray-900/60 backdrop-blur-md
                 transition-all duration-300 ease-out border border-gray-700 rounded-md cursor-pointer 
                 hover:text-rose-400 hover:bg-rose-950/80 hover:border-rose-900 
                 active:scale-95 shadow-lg whitespace-nowrap"
            >
              <ClearIcon className="w-3.5 h-3.5" />
              Reset
            </button>
          </div>
        </div>

        {/* Scrollable Controls Section */}


        <div className="flex-1 p-2 pb-15 space-y-4">
          {/* Interaction Mode */}
          <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-700 rounded-xl p-5 shadow-lg">
            <h3 className="text-base font-semibold text-cyan-400 mb-4">Interaction Mode</h3>
            <div className="space-y-2">
              {INTERACTION_MODE_LIST.map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setInteractionMode(id)}
                  className={`
                    w-full px-4 py-2.5 rounded-lg text-sm font-medium 
                    transition-all duration-200 ease-out
                    ${interactionMode === id
                      ? 'bg-cyan-600 text-white shadow-md'
                      : 'bg-gray-800/50 text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                    }
                  `}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Simulation Parameters */}
          <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-700 rounded-xl p-5 shadow-lg">
            <h3 className="text-base font-semibold text-cyan-400 mb-4 flex items-center gap-2">
              <span className="text-lg"></span> Simulation Parameters
            </h3>
            <div className="space-y-4">
              {/* Temperature Slider */}
              <div>
                <label className="text-gray-400 text-sm font-medium mb-2 block">
                  Temperature: <span className="text-cyan-400 font-mono">{simulationParams.temperature}</span>
                </label>
                <input
                  type="range"
                  value={simulationParams.temperature}
                  onChange={(e) => setSimulationParams({ ...simulationParams, temperature: Number(e.target.value) })}
                  min="-100"
                  max="100"
                  step="1"
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Cold</span>
                  <span>Hot</span>
                </div>
              </div>

              {/* Velocity Controls */}
              <div>
                <label className="text-gray-400 text-sm font-medium mb-2 block">Velocity</label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">X</label>
                    <input
                      type="number"
                      value={simulationParams.velocity.x}
                      onChange={(e) => setSimulationParams({ ...simulationParams, velocity: { ...simulationParams.velocity, x: Number(e.target.value) } })}
                      step="0.1"
                      className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg border border-gray-600 hover:border-cyan-500 focus:border-cyan-500 focus:outline-none transition-colors text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Y</label>
                    <input
                      type="number"
                      value={simulationParams.velocity.y}
                      onChange={(e) => setSimulationParams({ ...simulationParams, velocity: { ...simulationParams.velocity, y: Number(e.target.value) } })}
                      step="0.1"
                      className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg border border-gray-600 hover:border-cyan-500 focus:border-cyan-500 focus:outline-none transition-colors text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Viscosity */}
              <div className="flex flex-col gap-2 mt-4">
                <label className="text-sm font-medium text-white flex justify-between">
                  <span>Viscosity (μ)</span>
                  <span className="text-gray-400 font-mono">{simulationParams.viscosity.toFixed(4)}</span>
                </label>

                <input
                  type="number"
                  min="0.0001"
                  step="0.00005"
                  value={simulationParams.viscosity}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!Number.isNaN(val) && val >= 0.0001) {
                      setSimulationParams({ ...simulationParams, viscosity: val });
                    }
                  }}
                  className="w-full bg-gray-800 text-white border border-gray-600 rounded px-3 py-2 font-mono text-sm"
                  placeholder="Enter viscosity..."
                />

                <div className="grid grid-cols-4 gap-2 mt-1">
                  <button
                    onClick={() => setSimulationParams({ ...simulationParams, viscosity: 0.0001 })}
                    className={`text-xs py-1 rounded border ${simulationParams.viscosity === 0.0001 ? 'bg-blue-600 border-blue-400' : 'bg-gray-700 border-gray-600 hover:bg-gray-600'}`}
                  >
                    Smoke
                  </button>
                  <button
                    onClick={() => setSimulationParams({ ...simulationParams, viscosity: 0.002 })}
                    className={`text-xs py-1 rounded border ${simulationParams.viscosity === 0.002 ? 'bg-blue-600 border-blue-400' : 'bg-gray-700 border-gray-600 hover:bg-gray-600'}`}
                  >
                    Water
                  </button>
                  <button
                    onClick={() => setSimulationParams({ ...simulationParams, viscosity: 0.015 })}
                    className={`text-xs py-1 rounded border ${simulationParams.viscosity === 0.015 ? 'bg-blue-600 border-blue-400' : 'bg-gray-700 border-gray-600 hover:bg-gray-600'}`}
                  >
                    Oil
                  </button>
                  <button
                    onClick={() => setSimulationParams({ ...simulationParams, viscosity: 0.05 })}
                    className={`text-xs py-1 rounded border ${simulationParams.viscosity === 0.05 ? 'bg-blue-600 border-blue-400' : 'bg-gray-700 border-gray-600 hover:bg-gray-600'}`}
                  >
                    Honey
                  </button>
                </div>
              </div>

              {/* Pen Width Slider */}
              <div>
                <label className="text-gray-400 text-sm font-medium mb-2 block">
                  Pen Width: <span className="text-cyan-400 font-mono">{simulationParams.penWidth}</span>
                </label>
                <input
                  type="range"
                  value={simulationParams.penWidth}
                  onChange={(e) => setSimulationParams({ ...simulationParams, penWidth: Number(e.target.value) })}
                  min="1"
                  max="10"
                  step="1"
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Small</span>
                  <span>Large</span>
                </div>
              </div>

              {/* Slip Condition Slider */}
              <div>
                <label className="text-gray-400 text-sm font-medium mb-2 block">
                  Boundary Friction: <span className="text-cyan-400 font-mono">{simulationParams.slipCondition === 0 ? 'Slippery' : 'High Friction'}</span>
                </label>
                <div className="relative bg-gray-700 rounded-lg p-1 flex">
                  {/* Sliding background indicator */}
                  <div
                    className={`absolute inset-y-1 w-[calc(50%-4px)] bg-cyan-600 rounded-md transition-transform duration-300 ease-out ${simulationParams.slipCondition === 1 ? 'translate-x-full' : 'translate-x-0'
                      }`}
                  />

                  {/* Free-Slip Button */}
                  <button
                    onClick={() => setSimulationParams({ ...simulationParams, slipCondition: 0 })}
                    className={`relative z-10 flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${simulationParams.slipCondition === 0 ? 'text-white' : 'text-gray-400 hover:text-gray-200'
                      }`}
                  >
                    Free-Slip
                  </button>

                  {/* No-Slip Button */}
                  <button
                    onClick={() => setSimulationParams({ ...simulationParams, slipCondition: 1 })}
                    className={`relative z-10 flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${simulationParams.slipCondition === 1 ? 'text-white' : 'text-gray-400 hover:text-gray-200'
                      }`}
                  >
                    No-Slip
                  </button>
                </div>
              </div>

              {/* Vorticity Strength */}
              <div>
                <label className="text-gray-400 text-sm font-medium mb-2 block">
                  Vorticity Strength: <span className="text-cyan-400 font-mono">{simulationParams.vorticityStrength}x</span>
                </label>
                <input
                  type="range"
                  value={simulationParams.vorticityStrength}
                  onChange={(e) => setSimulationParams({ ...simulationParams, vorticityStrength: Number(e.target.value) })}
                  min="1"
                  max="5"
                  step="0.1"
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>None</span>
                  <span>High Turbulance</span>
                </div>
              </div>

              {/* Performance Slider */}
              <div>
                <label className="text-gray-400 text-sm font-medium mb-2 block">
                  Accuracy: <span className="text-cyan-400 font-mono">{simulationParams.performance}%</span>
                </label>
                <input
                  type="range"
                  value={simulationParams.performance}
                  onChange={(e) => setSimulationParams({ ...simulationParams, performance: Number(e.target.value) })}
                  min="0"
                  max="100"
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Faster</span>
                  <span>More Accurate</span>
                </div>
              </div>


            </div>
          </div>

          {/* Boundary Controls */}
          <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-700 rounded-xl p-4 shadow-lg">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-cyan-400 flex items-center gap-2">
                Toggle Walls/Obstacles
              </h3>
              <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer select-none whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={hideObstacles}
                  onChange={(e) => setHideObstacles(e.target.checked)}
                  className="w-4 h-4 accent-cyan-500 cursor-pointer"
                />
                Hide Obstacles
              </label>
            </div>
            {/* Switched to a 2-column grid to save vertical space */}
            <div className="grid grid-cols-2">
              {Object.entries(boundaries).map(([key, value]) => (
                <label key={key} className="flex items-center gap-2 text-gray-300 hover:text-white cursor-pointer transition-colors p-2 rounded-lg hover:bg-gray-700/30">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => setBoundaries({ ...boundaries, [key]: e.target.checked })}
                    className="w-4 h-4 accent-cyan-500 cursor-pointer"
                  />
                  <span className="text-sm">{key.charAt(0).toUpperCase() + key.slice(1)} Wall</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </aside>

      {/* Main Canvas Area */}
      <main className="flex-1 flex items-center justify-center p-4 md:p-8 w-full">
        <div className="flex items-center justify-center w-full h-full">
          <FluidCanvasGPU
            ref={canvasRef}
            width={SCREEN_RESOLUTION[0]}
            height={SCREEN_RESOLUTION[1]}
            boundaries={boundaries}
            interactionMode={interactionMode}
            hideObstacles={hideObstacles}
            simulationParams={simulationParams}
          />
        </div>
      </main>
    </div>
  );
}
