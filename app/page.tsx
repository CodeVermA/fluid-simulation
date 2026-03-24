import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-900 text-white p-4">
      {/* Header Section */}
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 mb-4">
          Fluid Dynamics Simulator
        </h1>
        <p className="text-gray-400 text-lg">
          Visualising fluid dynamics using Jos Stam&apos;s Stable Fluids Algorithm (1999)
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 max-w-4xl">

        {/* GPU Solver Card */}
        <Link href="/gpu">
          <div className="bg-gray-800 hover:bg-gray-700 transition-colors duration-300 rounded-lg p-8 border border-gray-700 hover:border-blue-500 cursor-pointer shadow-lg">
            <h2 className="text-2xl font-bold mb-4 text-blue-400">
              GPU Based Solver
            </h2>
            <p className="text-gray-300 mb-4">
              WebGL2 accelerated implementation with GLSL shaders
            </p>
          </div>
        </Link>

        {/* Performance Test Card */}
        <Link href="/benchmark">
          <div className="bg-gray-800 hover:bg-gray-700 transition-colors duration-300 rounded-lg p-8 border border-gray-700 hover:border-blue-500 cursor-pointer shadow-lg">
            <h2 className="text-2xl font-bold mb-4 text-blue-400">
              Performance Test
            </h2>
            <p className="text-gray-300 mb-4">
              This runs a predefined set of instructions to benchmark the GPU solver.
              <br />
              It is not interactive and is meant for performance testing only.
            </p>
          </div>
        </Link>
      </div>
    </main>
  );
}
