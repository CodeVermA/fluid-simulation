import FluidCanvasGPU from "../components/FluidCanvasGPU";
import Link from "next/link";

export default function GPUPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-900 text-white p-4">
      {/* Header with Back Button */}
      <div className="w-full max-w-5xl mb-8">
        <Link 
          href="/" 
          className="text-blue-400 hover:text-blue-300 transition-colors duration-200 text-sm mb-4 inline-block"
        >
          ← Back to Home
        </Link>
        
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">
            GPU Based Solver
          </h1>
          <p className="text-gray-400 text-sm">512×512 Grid | WebGL2</p>
        </div>
      </div>

      {/* Simulation Canvas */}
      <div className="relative flex place-items-center">
        <FluidCanvasGPU />
      </div>

      {/* Info Section */}
      <div className="mt-8 text-center text-gray-400 max-w-2xl">
        <p className="mb-2">GPU-accelerated WebGL2 implementation</p>
        <p className="text-sm text-gray-500">
          Click and drag to add fluid density and velocity
        </p>
      </div>
    </main>
  );
}
