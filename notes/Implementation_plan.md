# Real-Time WebGL Stable Fluids Simulation Plan

**Duration:** 2 Months (8 Weeks)

---

## Phase 1: Foundation (Weeks 1-2)

### Week 1 — Mathematical & Architectural Foundations

**Objectives:**

- [✔] Revisit incompressible Navier–Stokes equations
- [✔] Understand Stable Fluids algorithm components:
  - Semi-Lagrangian advection
  - Diffusion step
  - Pressure projection
- [✔] Choose rendering API (WebGL2 or WebGPU)
- [✔] Set up project skeleton (HTML/JS/GLSL structure)

**Deliverables:** Project skeleton, mathematical notes, solver pipeline sketch

---

### Week 2 — CPU Reference Solver

**Objectives:**

- [✔] Implement 64×64 CPU-based fluid solver in JavaScript
- [ ] Core components:
  - Semi-Lagrangian advection
  - Jacobi pressure solver
  - Velocity projection
- [✔] Create Canvas2D visualization
- [ ] Validate with divergence checks

**Deliverables:** Working CPU prototype with verified incompressibility

---

## Phase 2: GPU Implementation (Weeks 3-5)

### Week 3 — WebGL Foundations & Data Handling

**Objectives:**

- [ ] Implement GPU data structures:
  - Float textures for velocity/pressure fields
  - Framebuffer objects (FBOs)
  - Ping-pong buffer system
- [ ] Set up obstacle mask textures
- [ ] Create debug visualization tools
- [ ] Add RGB texture support (instead of single-channel float) to prepare for colored dye.

**Deliverables:** Functioning GPU data pipeline with debug displays

---

### Week 4 — GPU Solver: Advection + Forcing

**Objectives:**

- [ ] Implement advection shader (semi-Lagrangian)
- [ ] Add external force application:
  - Mouse interaction
  - Global force fields
- [ ] Visualize velocity field (vector field display)

**Deliverables:** Moving smoke simulation with correct velocity behavior

---

### Week 5 — Pressure Projection Pipeline

**Objectives:**

- [ ] Implement divergence computation shader
- [ ] Create Jacobi iterative pressure solver
- [ ] Implement gradient subtraction (projection step)
- [ ] Verify incompressibility

**Deliverables:** Incompressible flow with stable vortices

---

## Phase 3: The "Visuals & Toy Box" Update (Weeks 6-7)

### Week 6 — Advanced Rendering & Interactive Objects

**Objectives:**

- [ ] Implement RGB Dye Shader: Allow mixing colors(e.g., cyan and magenta dye streams mix to blue).
- [ ] Implement Lighting Shader: Use density gradients to calculate "normals" and apply fake 3D lighting/shadows.

- [ ] Draggable Obstacles: Implement a system to drag shapes (Circle, Square) with the mouse.

- [ ] Velocity Coupling: Moving an obstacle should "push" the fluid (two-way coupling).

**Deliverables:** Interactive, real-time demo with obstacle support

---

### Week 7 — The Scenario Engine & Polish

**Objectives:**

- [ ] Scenario Presets: Create a drop-down menu to load pre-set configs:

  - Wind Tunnel (High horizontal velocity).
  - Lava Lamp (Heat-based buoyancy simulation).
  - Paint Mixing (Random chaotic colors).

- [ ] Parameter Visualization: Toggle overlays for "Vorticity" (curl)
      and "Pressure" (divergence) to show the math behind the pretty colors
- [ ] GPU Profiling (essential for ensuring this runs smoothly)

**Deliverables:** Optimized solver with performance analysis

---

## Phase 4: Finalization (Week 8)

### Week 8 — Documentation & Completion

**Objectives:**

- [ ] Write comprehensive documentation:
  - Academic-style summary
  - Algorithm explanations
  - Performance benchmarks
- [ ] Clean and finalize repository
- [ ] Optional: Explore 3D extension possibilities

**Deliverables:** Polished, well-documented fluid simulation system

---

## Summary

| Phase              | Weeks | Focus                       |
| ------------------ | ----- | --------------------------- |
| Foundation         | 1-2   | Theory & CPU prototype      |
| GPU Implementation | 3-5   | WebGL solver core           |
| Refinement         | 6-7   | UI, optimization & features |
| Finalization       | 8     | Documentation & polish      |
