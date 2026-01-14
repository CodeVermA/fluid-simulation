# Fluid Dynamics Simulator

Real-time WebGL2 fluid simulator implementing **Jos Stam's Stable Fluids algorithm** (1999). Interactive visualization of the Navier-Stokes equations for incompressible fluid flow.

**University Dissertation Project** — Computational Fluid Dynamics

## Live Demo

**[Try it live on Vercel →](#)** https://fluid-simulation-eosin.vercel.app

## Quick Start

### Prerequisites

- Node.js 20+ and npm
- Modern browser with WebGL2 support

### Installation

```bash
# Clone the repository
git clone https://github.com/CodeVermA/fluid-simulation.git
cd fluid-simulation

# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and choose:

- `/cpu` — CPU-based solver. MAX 128x128 grid
- `/gpu` — GPU-accelerated solver. MAX 720p grid
### Build for Production

```bash
npm run build
npm start
```

## Architecture

```
app/
├── page.tsx                    # Landing page
├── cpu/page.tsx               # CPU solver demo
├── gpu/page.tsx               # GPU solver demo
├── components/
│   ├── FluidCanvas.tsx        # CPU: Canvas2D renderer
│   └── FluidCanvasGPU.tsx     # GPU: WebGL2 renderer
└── simulation/
    ├── cpu/FluidSolver.ts     # Float32Array implementation
    └── gpu/
        ├── FluidSolverGPU.ts  # WebGL2 Stable Fluids
        ├── GPUResources.ts    # FBO/shader/VAO manager
        └── shaders/
            └── fluidShaders.ts # GLSL ES 3.00 sources
```

## Algorithm Overview

Based on Jos Stam's **Stable Fluids** (SIGGRAPH 1999):

1. **Advection** — Semi-Lagrangian backward particle tracing
2. **Diffusion** — Implicit solve via Jacobi iteration
3. **Pressure Projection** — 3-stage incompressibility enforcement:
   - Compute divergence (∇·v)
   - Solve Poisson equation (∇²p = ∇·v)
   - Subtract pressure gradient (v_new = v - ∇p)
4. **Vorticity Confinement** — Amplify rotational motion lost to dissipation

## Tech Stack

- **Framework:** Next.js 16 (React 19)
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS 4
- **Graphics:** WebGL2 / Canvas2D
- **Deployment:** Vercel (static export)

## Performance

| Implementation | Resolution | Typical FPS |
| -------------- | ---------- | ----------- |
| CPU            | 128×128    | ~30 FPS     |
| GPU (WebGL2)   | 720p       | ~60 FPS     |

_Target: 60 FPS at 1024x720 (optimization in progress)_

## Academic Context

This project is part of a dissertation on real-time computational fluid dynamics. Key research areas:

- Numerical stability in grid-based solvers
- GPU acceleration techniques for PDE solvers
- Interactive visualization of complex physical systems

## References

- [Stable Fluids (Stam, 1999)](https://pages.cs.wisc.edu/~chaol/data/cs777/stam-stable_fluids.pdf)
- [Real-Time Fluid Dynamics for Games (Stam, 2003)](https://www.dgp.toronto.edu/public_user/stam/reality/Research/pdf/GDC03.pdf)
- [WebGL2 Specification](https://www.khronos.org/registry/webgl/specs/latest/2.0/)

## Development

```bash
# Run linter
npm run lint

# Type checking
npx tsc --noEmit

# Local build test
npm run build
```

## License

MIT License — See LICENSE file for details

## Acknowledgments
- Jos Stam for the Stable Fluids algorithm
- WebGL community for shader optimization techniques
- University supervisor for academic guidance

---

**Author:** Vasu Verma

**Institution:** The University of Edinburgh

**Year:** 2026
