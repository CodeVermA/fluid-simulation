'use client';

import { useRef, useState } from 'react';
import FluidCanvas from "../components/FluidCanvas";
import Link from "next/link";
import { InteractionMode, INTERACTION_MODES } from '../types/interactionMode';

export default function CPUPage() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('simulate');

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
            CPU Fluid Solver
          </h1>
          <p className="text-gray-400 text-xs">Canvas2D implementation</p>
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

          {/* Simulation Info */}
          <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-700 rounded-xl p-5 shadow-lg">
            <h3 className="text-base font-semibold text-cyan-400 mb-4 flex items-center gap-2">
              <span className="text-lg">📊</span> Simulation Info
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center p-2 bg-gray-800/50 rounded-lg">
                <span className="text-gray-400">Grid Size:</span>
                <span className="font-mono text-cyan-400">64×64</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-gray-800/50 rounded-lg">
                <span className="text-gray-400">Renderer:</span>
                <span className="font-mono text-cyan-400">Canvas2D</span>
              </div>
              <div className="flex justify-between items-center p-2 bg-gray-800/50 rounded-lg">
                <span className="text-gray-400">Algorithm:</span>
                <span className="font-mono text-cyan-400">Stable Fluids</span>
              </div>
            </div>
          </div>

          {/* Performance Notes */}
          <div className="bg-gradient-to-br from-yellow-900/30 to-orange-900/30 backdrop-blur-sm border border-yellow-700/50 rounded-xl p-5 shadow-lg">
            <h3 className="text-base font-semibold text-yellow-300 mb-3 flex items-center gap-2">
              <span className="text-lg">⚠️</span> Performance
            </h3>
            <p className="text-gray-300 text-xs leading-relaxed">
              CPU implementation is limited to <strong>64×64</strong> grid resolution for optimal frame rate. For higher resolutions, use the GPU solver.
            </p>
          </div>

          {/* Interaction Help */}
          <div className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 backdrop-blur-sm border border-blue-700/50 rounded-xl p-5 shadow-lg">
            <h3 className="text-base font-semibold text-blue-300 mb-3">Interaction Guide</h3>
            <p className="text-gray-400 text-xs leading-relaxed">
              {interactionMode === 'simulate' ? (
                <><strong className="text-gray-300">Click and drag</strong> on the canvas to add fluid density and velocity to the simulation.</>
              ) : (
                <><strong className="text-gray-300">Click or drag</strong> to draw obstacles that block fluid flow.</>
              )}
            </p>
          </div>

          {/* Technical Details */}
          <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-700 rounded-xl p-5 shadow-lg">
            <h3 className="text-base font-semibold text-purple-400 mb-4 flex items-center gap-2">
              <span className="text-lg">🔬</span> Technical Details
            </h3>
            <div className="space-y-2 text-xs text-gray-400">
              <p><strong className="text-gray-300">Reference:</strong> Jos Stam's Stable Fluids (SIGGRAPH 1999)</p>
              <p><strong className="text-gray-300">Storage:</strong> Float32Array buffers</p>
              <p><strong className="text-gray-300">Boundary:</strong> 2-cell padding for edge conditions</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Canvas Area */}
      <main className="flex-1 flex items-center justify-center p-4 md:p-8 w-full">
        <div className="flex items-center justify-center w-full h-full">
          <FluidCanvas width={64} height={64} interactionMode={interactionMode} />
        </div>
      </main>
    </div>
  );
}
