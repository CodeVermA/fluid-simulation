# Fluid Dynamics Simulator

Real-time WebGL2 fluid simulation and benchmarking project built with Next.js 16 and React 19.

The app implements a GPU-based solver inspired by Jos Stam's Stable Fluids paper (1999), with:

- an interactive simulation page for exploring the flow field
- a fixed-workload benchmark page for collecting comparable performance results

This project was developed as part of a university dissertation focused on real-time computational fluid dynamics.

## Live Demo

- https://fluid-simulation-eosin.vercel.app

## Features

- Interactive GPU solver at `/gpu`
- Stable-fluids style simulation pipeline using advection, diffusion, pressure projection, buoyancy, and vorticity confinement
- Adjustable simulation controls for velocity, temperature, viscosity, vorticity strength, boundary friction, pen width, and solver iterations
- Obstacle drawing and erasing directly inside the simulation
- Dedicated benchmark mode at `/benchmark`
- Copyable benchmark summary including:
  - solver iterations
  - average FPS
  - 1% low
  - device memory
  - platform/OS
  - WebGL renderer
  - sampled frame count

## Routes

- `/` - landing page
- `/gpu` - interactive GPU fluid simulation
- `/benchmark` - fixed benchmark run for performance testing

## Quick Start

### Prerequisites

- Node.js 20+
- npm
- A modern browser with WebGL2 support

### Install and Run

```bash
git clone https://github.com/CodeVermA/fluid-simulation.git
cd fluid-simulation
npm install
npm run dev
```

Open `http://localhost:3000`.

### Production Build

```bash
npm run build
npm start
```

## Benchmark Mode

The benchmark page is designed to keep the run configuration the same for everyone:

- Resolution: `640 x 360`
- Solver Iterations: `50`
- Duration: `60s`

The benchmark starts only after clicking the start button and runs a scripted, non-interactive workload on top of the GPU solver. When the run completes, the app generates a copy-friendly summary for evaluation.

### Notes about benchmark metadata

- The reported renderer is the WebGL adapter selected by the browser, not necessarily the most powerful GPU installed in the machine.
- On hybrid laptops, the renderer may show the integrated GPU unless the browser is forced onto the discrete GPU by the OS/driver.
- `Device Memory` depends on browser support and may show as unavailable.
- Exact CPU model names are not exposed by standard browser APIs, so they are not included in the summary.

## Tech Stack

- Next.js 16
- React 19
- TypeScript 5
- Tailwind CSS 4
- WebGL2

## Project Structure

```text
app/
├── benchmark/
│   └── page.tsx
├── components/
│   ├── FluidCanvasBenchmark.tsx
│   ├── FluidCanvasGPU.tsx
│   └── Icons.tsx
├── gpu/
│   └── page.tsx
├── simulation/
│   ├── FluidPrograms.ts
│   ├── FluidSolver.ts
│   ├── FluidUtility.ts
│   ├── GPUResources.ts
│   └── shaders/
│       ├── SimulationShaders.ts
│       └── UtilityShaders.ts
├── types/
│   └── interactionMode.ts
├── utils/
│   ├── benchmarkUtils.ts
│   ├── colorUtils.ts
│   └── fpsUtils.ts
├── globals.css
├── layout.tsx
└── page.tsx
```

## Simulation Overview

The solver follows the familiar stable-fluids style update loop:

1. Apply buoyancy forces
2. Compute curl and add vorticity confinement
3. Advect velocity
4. Diffuse velocity
5. Project to enforce incompressibility
6. Advect density and temperature
7. Diffuse density and temperature

## Development

```bash
# Lint
npm run lint

# Type check
npx tsc --noEmit

# Production build
npm run build
```

### Build note

This project uses `next/font/google` for Geist fonts. Production builds may require network access so Next.js can fetch those font assets.

## References

- Stable Fluids (Stam, 1999): https://pages.cs.wisc.edu/~chaol/data/cs777/stam-stable_fluids.pdf
- Real-Time Fluid Dynamics for Games (Stam, 2003): https://www.dgp.toronto.edu/public_user/stam/reality/Research/pdf/GDC03.pdf
- WebGL 2.0 Specification: https://www.khronos.org/registry/webgl/specs/latest/2.0/

## Acknowledgments

- Jos Stam for the Stable Fluids algorithm
- The WebGL community for shader and GPU pipeline guidance
- Academic supervision and dissertation support

## Author

- Vasu Verma
- The University of Edinburgh
- 2026
