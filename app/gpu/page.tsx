'use client';

import { useRef, useState } from 'react';
import FluidCanvasGPU, { FluidCanvasGPUHandle } from "../components/FluidCanvasGPU";
import Link from "next/link";
import { InteractionMode, INTERACTION_MODES } from '../types/interactionMode';

const SCREEN_RESOLUTION = [845, 480] as const;

export default function GPUPage() {
  const canvasRef = useRef<FluidCanvasGPUHandle>(null);
  const [boundaries, setBoundaries] = useState({ top: true, bottom: true, left: true, right: true });
  const [debugMode, setDebugMode] = useState<'normal' | 'divergence' | 'velocity' | 'obstacles'>('normal');
  const [massStats, setMassStats] = useState(0);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('simulate');

  const handleReset = () => {
    canvasRef.current?.reset();
    setMassStats(0);
  };

  return (
    <div className="flex h-screen bg-gradient-to-b from-gray-900 to-black text-white overflow-hidden relative">
      {/* Mobile Overlay */}
      {isDrawerOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      {/* Mobile Toggle Button */}
      <button
        onClick={() => setIsDrawerOpen(!isDrawerOpen)}
        className="md:hidden fixed top-4 left-4 z-50 bg-gray-800/90 backdrop-blur-sm border border-gray-600 text-white p-3 rounded-lg shadow-lg hover:bg-gray-700 transition-colors"
        aria-label="Toggle settings"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {isDrawerOpen ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          )}
        </svg>
      </button>

      {/* Left Sidebar - Controls Panel */}
      <aside className={`
        w-80 bg-gray-800/40 backdrop-blur-sm border-r border-gray-700 flex flex-col overflow-y-auto
        md:relative md:translate-x-0
        fixed inset-y-0 left-0 z-40 transition-transform duration-300 ease-in-out
        ${isDrawerOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Header Section */}
        <div className="p-6 border-b border-gray-700">
          <Link
            href="/"
            className="text-blue-400 hover:text-blue-300 transition-colors duration-200 text-sm inline-flex items-center gap-2 mb-4"
          >
            ← Back to Home
          </Link>
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-2">
            GPU Fluid Solver
          </h1>
          <p className="text-gray-400 text-xs">Real-time WebGL2 simulation</p>
        </div>

        {/* Scrollable Controls Section */}
        <div className="flex-1 p-6 space-y-6">
          {/* Mode Switch */}
          <div className="bg-gradient-to-br from-purple-900/40 to-indigo-900/40 backdrop-blur-sm border border-purple-700/50 rounded-xl p-5 shadow-lg">
            <h3 className="text-base font-semibold text-purple-300 mb-4">Interaction Mode</h3>
            <div className="bg-gray-900/60 rounded-lg p-1 flex gap-1">
              {(Object.keys(INTERACTION_MODES) as InteractionMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setInteractionMode(mode)}
                  className={`
                    flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-200
                    ${interactionMode === mode
                      ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                    }
                  `}
                >
                  {INTERACTION_MODES[mode].label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-gray-400">
              {INTERACTION_MODES[interactionMode].description}
            </p>
          </div>

          {/* Simulation Controls */}
          <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-700 rounded-xl p-5 shadow-lg">
            <h3 className="text-base font-semibold text-cyan-400 mb-4 flex items-center gap-2">
              <span className="text-lg">⚡</span> Simulation
            </h3>
            <button
              onClick={handleReset}
              className="w-full px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold rounded-lg shadow-lg transition-all duration-200 transform hover:scale-105 active:scale-95 border border-red-500/50"
            >
              Reset Simulation
            </button>
          </div>

          {/* Boundary Controls */}
          <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-700 rounded-xl p-5 shadow-lg">
            <h3 className="text-base font-semibold text-cyan-400 mb-4 flex items-center gap-2">
              <span className="text-lg">🧱</span> Boundary Conditions
            </h3>
            <div className="space-y-2.5">
              {Object.entries(boundaries).map(([key, value]) => (
                <label key={key} className="flex items-center gap-3 text-gray-300 hover:text-white cursor-pointer transition-colors p-2 rounded-lg hover:bg-gray-700/30">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(e) => setBoundaries({ ...boundaries, [key]: e.target.checked })}
                    className="w-4 h-4 accent-cyan-500"
                  />
                  <span className="text-sm">{key.charAt(0).toUpperCase() + key.slice(1)} Wall</span>
                </label>
              ))}
            </div>
          </div>

          {/* Debug & Statistics Panel */}
          <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-700 rounded-xl p-5 shadow-lg">
            <h3 className="text-base font-semibold text-blue-400 mb-4 flex items-center gap-2">
              <span className="text-lg">🔍</span> Debug & Statistics
            </h3>
            <div className="space-y-4">
              <div className="bg-gray-800/50 p-3 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400 text-sm">Total Mass:</span>
                  <span className="font-mono text-cyan-400 text-lg font-semibold">{massStats.toFixed(1)}</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-gray-400 text-sm font-medium">Visualization Mode:</label>
                <select
                  value={debugMode}
                  onChange={(e) => setDebugMode(e.target.value as typeof debugMode)}
                  className="bg-gray-800 text-white p-2.5 rounded-lg border border-gray-600 hover:border-blue-500 focus:border-blue-500 focus:outline-none transition-colors cursor-pointer text-sm"
                >
                  <option value="normal">Normal (Density)</option>
                  <option value="divergence">Divergence Field</option>
                  <option value="velocity">Velocity Vectors</option>
                  <option value="obstacles">Obstacle Map</option>
                </select>
              </div>
            </div>
          </div>

          {/* Interaction Help */}
          <div className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 backdrop-blur-sm border border-blue-700/50 rounded-xl p-5 shadow-lg">
            <h3 className="text-base font-semibold text-blue-300 mb-3">Interaction Guide</h3>
            <p className="text-gray-400 text-xs leading-relaxed">
              {interactionMode === 'simulate' ? (
                <><strong className="text-gray-300">Drag</strong> on the canvas to add fluid velocity and density to the simulation.</>
              ) : (
                <><strong className="text-gray-300">Click or drag</strong> to draw obstacles that block fluid flow.</>
              )}
            </p>
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
            debugMode={debugMode}
            boundaries={boundaries}
            interactionMode={interactionMode}
            onMassUpdate={setMassStats}
          />
        </div>
      </main>
    </div>
  );
}
