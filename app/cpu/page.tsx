import FluidCanvas from "../components/FluidCanvas";
import Link from "next/link";

export default function CPUPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-900 text-white p-4">
      {/* Header with Back Button */}
      <div className="w-full max-w-5xl mb-8">
        <Link
          href="/"
          className="text-cyan-400 hover:text-cyan-300 transition-colors duration-200 text-sm mb-4 inline-block"
        >
          ← Back to Home
        </Link>

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">
            CPU Based Solver
          </h1>
          <p className="text-gray-400 text-sm">64×64 Grid | Canvas2D</p>
        </div>
      </div>

      {/* Simulation Canvas */}
      <div className="relative flex place-items-center">
        <FluidCanvas width={64} height={64} />
      </div>

      {/* Info Section */}
      <div className="mt-8 text-center text-gray-400 max-w-2xl">
        <p className="mb-2">CPU-based reference implementation</p>
        <p className="text-sm text-gray-500">
          Click and drag to add fluid density and velocity
        </p>
      </div>
    </main>
  );
}
