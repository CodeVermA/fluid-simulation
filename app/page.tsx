import FluidCanvas from "./components/FluidCanvas";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-900 text-white p-4">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm lg:flex mb-8">
        <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">
          Fluid Dynamics
        </h1>
        <p>Phase 1: Foundation</p>
      </div>

      <div className="relative flex place-items-center">
        {/* Pass the simulation resolution, not the screen size. 
            64x64 is good for the Week 2 CPU solver. */}
        <FluidCanvas width={64} height={64} />
      </div>

      <div className="mt-8 text-center text-gray-400">
        <p>Visualizing Navier-Stokes Equations</p>
      </div>
    </main>
  );
}