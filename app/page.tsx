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
          Visualising fluid dynamics using Jos Stam's Stable Fluids Algorithm (1999)
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl">
        {/* CPU Solver Card */}
        <Link href="/cpu">
          <div className="bg-gray-800 hover:bg-gray-700 transition-colors duration-300 rounded-lg p-8 border border-gray-700 hover:border-cyan-500 cursor-pointer shadow-lg">
            <h2 className="text-2xl font-bold mb-4 text-cyan-400">
              CPU Based Solver
            </h2>
            <p className="text-gray-300 mb-4">
              Use this if your computer does not support WebGL2 or if GPU performance is poor
            </p>
            <ul className="text-sm text-gray-400 space-y-2">
              <li>• 64×64 grid resolution</li>
              <li>• ~30 FPS performance</li>
            </ul>
          </div>
        </Link>

        {/* GPU Solver Card */}
        <Link href="/gpu">
          <div className="bg-gray-800 hover:bg-gray-700 transition-colors duration-300 rounded-lg p-8 border border-gray-700 hover:border-blue-500 cursor-pointer shadow-lg">
            <h2 className="text-2xl font-bold mb-4 text-blue-400">
              GPU Based Solver
            </h2>
            <p className="text-gray-300 mb-4">
              WebGL2 accelerated implementation with GLSL shaders
            </p>
            <ul className="text-sm text-gray-400 space-y-2">
              <li>• 512×512 grid resolution</li>
              <li>• ~60 FPS performance</li>
            </ul>
          </div>
        </Link>
      </div>
    </main>
  );
}