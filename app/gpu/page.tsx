'use client';

import { useEffect, useRef, useState } from 'react';
import FluidCanvasGPU, {
  type FluidCanvasGPUHandle,
  type VelocityControlMode,
} from "../components/SimulationCanvas";
import Link from "next/link";
import { BackIcon, ClearIcon, EraserIcon } from '../components/Icons';
import {
  INTERACTION_MODE_LIST,
  InteractionMode as InteractionModeEnum,
  type InteractionMode,
} from '../types/interactionMode';

const SCREEN_RESOLUTION = [432, 240];
const DISPLAY_SCALE = 2;

export default function GPUPage() {
  const canvasRef = useRef<FluidCanvasGPUHandle>(null);
  const [boundaries, setBoundaries] = useState({ top: true, bottom: true, left: true, right: true });
  const [isMenuExpanded, setIsMenuExpanded] = useState(false);
  const hasManualMenuPreference = useRef(false);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>(InteractionModeEnum.AddVelocity);
  const [obstacleEraser, setObstacleEraser] = useState(false);
  const [hideObstacles, setHideObstacles] = useState(true);
  const [velocityControlMode, setVelocityControlMode] = useState<VelocityControlMode>('manual');

  // Simulation parameters
  const [simulationParams, setSimulationParams] = useState({
    temperature: 0,
    velocity: { x: 10, y: 6 },
    viscosity: 0.0001,
    densityDiffusion: false,
    performance: 50,
    slipCondition: 0,
    penWidth: 5,
    vorticityStrength: 1,
  });
  const [velocityInputValues, setVelocityInputValues] = useState({
    x: '10',
    y: '6',
  });

  const handleVelocityInputChange = (axis: 'x' | 'y', value: string) => {
    setVelocityInputValues((current) => ({
      ...current,
      [axis]: value,
    }));

    if (value === '' || value === '-' || value === '.' || value === '-.') {
      return;
    }

    const nextValue = Number(value);
    if (Number.isNaN(nextValue)) {
      return;
    }

    setSimulationParams((current) => ({
      ...current,
      velocity: {
        ...current.velocity,
        [axis]: nextValue,
      },
    }));
  };

  const handleVelocityInputBlur = (axis: 'x' | 'y') => {
    const value = velocityInputValues[axis];
    if (value === '' || value === '-' || value === '.' || value === '-.') {
      setVelocityInputValues((current) => ({
        ...current,
        [axis]: String(simulationParams.velocity[axis]),
      }));
      return;
    }

    const nextValue = Number(value);
    if (Number.isNaN(nextValue)) {
      setVelocityInputValues((current) => ({
        ...current,
        [axis]: String(simulationParams.velocity[axis]),
      }));
      return;
    }

    setVelocityInputValues((current) => ({
      ...current,
      [axis]: String(nextValue),
    }));
  };

  const handleReset = () => {
    canvasRef.current?.reset();
  };

  useEffect(() => {
    const desktopMediaQuery = window.matchMedia('(min-width: 768px)');
    const syncMenuState = (matches: boolean) => {
      if (!hasManualMenuPreference.current) {
        setIsMenuExpanded(matches);
      }
    };

    syncMenuState(desktopMediaQuery.matches);

    const handleViewportChange = (event: MediaQueryListEvent) => {
      syncMenuState(event.matches);
    };

    desktopMediaQuery.addEventListener('change', handleViewportChange);

    return () => {
      desktopMediaQuery.removeEventListener('change', handleViewportChange);
    };
  }, []);

  const toggleMenu = () => {
    hasManualMenuPreference.current = true;
    setIsMenuExpanded((current) => !current);
  };

  const closeMenu = () => {
    hasManualMenuPreference.current = true;
    setIsMenuExpanded(false);
  };

  return (
    <div className="flex h-screen bg-gradient-to-b from-gray-900 to-black text-white overflow-hidden relative">
      {/* Mobile Overlay */}
      {isMenuExpanded && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={closeMenu}
        />
      )}

      {/* Sidebar Toggle Button */}
      <button
        onClick={toggleMenu}
        className={`
          fixed top-4 left-4 z-50 rounded-lg border border-gray-600 bg-gray-800/90 p-3 text-white shadow-lg backdrop-blur-sm
          transition-[left,background-color] duration-300 hover:bg-gray-700
          ${isMenuExpanded ? 'md:left-[21rem]' : 'md:left-4'}
        `}
        aria-label={isMenuExpanded ? 'Hide settings' : 'Show settings'}
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
      <div
        className={`
          relative h-full w-0 shrink-0 transition-[width] duration-300 ease-in-out md:min-h-0 md:overflow-hidden
          ${isMenuExpanded ? 'md:w-90' : 'md:w-0'}
        `}
      >
        <aside className={`
          h-full w-90 bg-gray-800/40 backdrop-blur-sm border-r border-gray-700 flex flex-col
          fixed inset-y-0 left-0 z-40 md:relative
          transition-transform duration-300 ease-in-out
          ${isMenuExpanded ? 'translate-x-0' : '-translate-x-full'}
        `}>
          {/* Header Section */}
          <div className="px-6 py-4 border-b border-gray-700">
            <Link
              href="/"
              className="group text-blue-400 hover:text-blue-300 transition-colors duration-200 text-sm inline-flex items-center gap-2 mb-1"
            >
              {/* Arrow */}
              <BackIcon className="transition-transform duration-200 group-hover:-translate-x-0.5" />
              Home
            </Link>

            <h1 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-1">
              FLUID SIMULATION
            </h1>
            <div className="flex items-center justify-between gap-3">
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


          <div className="simulation-scrollbar min-h-0 flex-1 overflow-y-auto p-2 pb-15 space-y-4">
            {/* Interaction Mode */}
            <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-700 rounded-xl p-5 shadow-lg">
              <h3 className="text-base font-semibold text-cyan-400 mb-4">Interaction Mode</h3>
              <div className="space-y-2">
                {INTERACTION_MODE_LIST.map(({ id, label }) => (
                  id === InteractionModeEnum.DrawObstacles ? (
                    <div key={id} className="grid grid-cols-[1fr_auto] gap-2">
                      <button
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
                      <button
                        onClick={() => {
                          setInteractionMode(InteractionModeEnum.DrawObstacles);
                          setObstacleEraser((prev) => !prev);
                        }}
                        className={`
                        px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ease-out whitespace-nowrap
                        ${obstacleEraser
                            ? 'bg-rose-600 text-white shadow-md'
                            : 'bg-gray-800/50 text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                          }
                      `}
                        aria-label={obstacleEraser ? 'Disable eraser' : 'Enable eraser'}
                        title={obstacleEraser ? 'Eraser enabled' : 'Eraser disabled'}
                      >
                        <EraserIcon />
                      </button>
                    </div>
                  ) : (
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
                  )
                ))}
              </div>
            </div>

            {/* Simulation Parameters */}
            <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-700 rounded-xl p-5 shadow-lg">
              <h3 className="text-base font-semibold text-cyan-400 mb-4 flex items-center gap-2">
                <span className="text-lg"></span> Simulation Parameters
              </h3>
              <div className="divide-y divide-gray-700/60 [&>div]:py-4 [&>div:first-child]:pt-0 [&>div:last-child]:pb-0">
                {/* Temperature Slider */}
                <div>
                  <label className="text-sm font-medium text-white flex justify-between">
                    <span>Temperature</span>
                    <span className="text-gray-400 font-mono">{simulationParams.temperature}</span>
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
                  <div className="flex items-center flex-wrap justify-between gap-2 mb-2">
                    <label className="text-sm font-medium text-white">
                      Velocity Input
                    </label>

                    <div className="relative bg-gray-700 rounded-lg p-1 flex">
                      <div
                        className={`absolute inset-y-1 w-[calc(50%-4px)] bg-cyan-600 rounded-md transition-transform duration-300 ease-out ${velocityControlMode === 'mouse' ? 'translate-x-full' : 'translate-x-0'
                          }`}
                      />

                      <button
                        type="button"
                        onClick={() => setVelocityControlMode('manual')}
                        className={`relative z-10 px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-200 ${velocityControlMode === 'manual' ? 'text-white' : 'text-gray-400 hover:text-gray-200'
                          }`}
                      >
                        Manual
                      </button>

                      <button
                        type="button"
                        onClick={() => setVelocityControlMode('mouse')}
                        className={`relative z-10 px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-200 ${velocityControlMode === 'mouse' ? 'text-white' : 'text-gray-400 hover:text-gray-200'
                          }`}
                      >
                        Mouse
                      </button>
                    </div>
                  </div>

                  {velocityControlMode === 'manual' && (
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">X</label>
                        <input
                          type="number"
                          value={velocityInputValues.x}
                          onChange={(e) => handleVelocityInputChange('x', e.target.value)}
                          onBlur={() => handleVelocityInputBlur('x')}
                          step="0.1"
                          className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg border border-gray-600 hover:border-cyan-500 focus:border-cyan-500 focus:outline-none transition-colors text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Y</label>
                        <input
                          type="number"
                          value={velocityInputValues.y}
                          onChange={(e) => handleVelocityInputChange('y', e.target.value)}
                          onBlur={() => handleVelocityInputBlur('y')}
                          step="0.1"
                          className="w-full bg-gray-800 text-white px-3 py-2 rounded-lg border border-gray-600 hover:border-cyan-500 focus:border-cyan-500 focus:outline-none transition-colors text-sm"
                        />
                      </div>
                    </div>
                  )}

                  {velocityControlMode === 'mouse' && (
                    <p className="mt-3 text-xs text-gray-400">
                      Velocity comes from your mouse speed and direction.
                    </p>
                  )}
                </div>

                {/* Viscosity */}
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-white flex justify-between">
                    <span>Viscosity</span>
                    <span className="text-gray-400 font-mono">{simulationParams.viscosity.toFixed(4)}</span>
                  </label>

                  <input
                    type="number"
                    min="0.0001"
                    step="0.0001"
                    value={simulationParams.viscosity}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!Number.isNaN(val) && val >= 0.0001) {
                        setSimulationParams({ ...simulationParams, viscosity: val });
                      }
                    }}
                    className="w-full bg-gray-800 text-white border border-gray-600 rounded px-3 py-2 font-mono text-sm"
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

                {/* Density Diffusion */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-white">
                      Density Diffusion
                    </label>

                    <button
                      type="button"
                      onClick={() =>
                        setSimulationParams({
                          ...simulationParams,
                          densityDiffusion: !simulationParams.densityDiffusion,
                        })
                      }
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-200 ${simulationParams.densityDiffusion
                        ? 'border-cyan-400 bg-cyan-500/80'
                        : 'border-gray-600 bg-gray-700'
                        }`}
                      aria-pressed={simulationParams.densityDiffusion}
                      aria-label={
                        simulationParams.densityDiffusion
                          ? 'Disable density diffusion'
                          : 'Enable density diffusion'
                      }
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-200 ${simulationParams.densityDiffusion
                          ? 'translate-x-6'
                          : 'translate-x-1'
                          }`}
                      />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">
                    {simulationParams.densityDiffusion ? 'Enabled. Requires more computational resources' : 'Disabled'}
                  </p>
                </div>

                {/* Pen Width Slider */}
                <div>
                  <label className="text-sm font-medium text-white flex justify-between">
                    <span>Pen Width</span>
                    <span className="text-gray-400 font-mono">{simulationParams.penWidth}</span>
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

                {/* Boundary Friction Toggle */}
                <div>
                  <div className="flex items-center flex-wrap justify-between gap-2 mb-2">
                    <label className="text-sm font-medium text-white">
                      Boundary Friction
                    </label>

                    <div className="relative flex w-40 shrink-0 rounded-md bg-gray-700 p-0.5">
                      <div
                        className={`absolute inset-y-0.5 w-[calc(50%-2px)] rounded-sm bg-cyan-600 transition-transform duration-300 ease-out ${simulationParams.slipCondition === 1 ? 'translate-x-full' : 'translate-x-0'
                          }`}
                      />

                      <button
                        type="button"
                        onClick={() => setSimulationParams({ ...simulationParams, slipCondition: 0 })}
                        className={`relative z-10 flex-1 rounded-sm px-2 py-1 text-xs font-medium transition-colors duration-200 ${simulationParams.slipCondition === 0 ? 'text-white' : 'text-gray-400 hover:text-gray-200'
                          }`}
                      >
                        Free-Slip
                      </button>

                      <button
                        type="button"
                        onClick={() => setSimulationParams({ ...simulationParams, slipCondition: 1 })}
                        className={`relative z-10 flex-1 rounded-sm px-2 py-1 text-xs font-medium transition-colors duration-200 ${simulationParams.slipCondition === 1 ? 'text-white' : 'text-gray-400 hover:text-gray-200'
                          }`}
                      >
                        No-Slip
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-gray-400">
                    {simulationParams.slipCondition === 0
                      ? 'Slippery: Only the object-facing velocity component is affected.'
                      : 'High Friction: Both x and y components are affected.'}
                  </p>
                </div>

                {/* Vorticity Strength */}
                <div>
                  <label className="text-sm font-medium text-white flex justify-between">
                    <span>Vorticity Strength</span>
                    <span className="text-gray-400 font-mono">{simulationParams.vorticityStrength}x</span>
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
                    <span>Normal</span>
                    <span>High Turbulence</span>
                  </div>
                </div>

                {/* Solver Iterations */}
                <div>
                  <label className="text-sm font-medium text-white flex justify-between">
                    <span>Solver Iterations</span>
                    <span className="text-gray-400 font-mono">{simulationParams.performance}</span>
                  </label>
                  <input
                    type="range"
                    value={simulationParams.performance}
                    onChange={(e) => setSimulationParams({ ...simulationParams, performance: Number(e.target.value) })}
                    min="10"
                    max="100"
                    className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Lower Accuracy</span>
                    <span>Max Accuracy</span>
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
      </div>

      {/* Main Canvas Area */}
      <main className="flex-1 flex items-center justify-center p-2 md:p-4 w-full">
        <div className="flex items-center justify-center w-full max-w-[95%] h-full">
          <FluidCanvasGPU
            ref={canvasRef}
            width={SCREEN_RESOLUTION[0]}
            height={SCREEN_RESOLUTION[1]}
            displayScale={DISPLAY_SCALE}
            boundaries={boundaries}
            interactionMode={interactionMode}
            obstacleEraser={obstacleEraser}
            hideObstacles={hideObstacles}
            simulationParams={simulationParams}
            velocityControlMode={velocityControlMode}
          />
        </div>
      </main>
    </div>
  );
}
