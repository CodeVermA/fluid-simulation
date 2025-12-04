export class FluidSolver {
  // Simulation Parameters
  readonly GRID_RES: number; // Grid resolution
  readonly GRID_PADDING: number = 2; // Padding for boundary conditions(act as walls)
  readonly ITERATIONS: number = 20; // Number of iterations for solvers

  // ImageData for rendering, [R,G,B,A] per pixel
  imageData: ImageData | null = null;

  // Array to store Fluid properties
  prev_density: Float32Array;
  curr_density: Float32Array;
  prev_velocityX: Float32Array;
  curr_velocityX: Float32Array;
  prev_velocityY: Float32Array;
  curr_velocityY: Float32Array;

  constructor(resolution: number) {
    this.GRID_RES = resolution;

    const size =
      (this.GRID_RES + this.GRID_PADDING) * (this.GRID_RES + this.GRID_PADDING);
    this.prev_density = new Float32Array(size);
    this.curr_density = new Float32Array(size);
    this.prev_velocityX = new Float32Array(size);
    this.curr_velocityX = new Float32Array(size);
    this.prev_velocityY = new Float32Array(size);
    this.curr_velocityY = new Float32Array(size);

    this.imageData = new ImageData(this.GRID_RES, this.GRID_RES);

    //this.injectTestDensity(); // For inital testing
    console.log(`CPU Solver created: ${resolution}x${resolution}`);
  }

  private injectTestDensity() {
    const mid = Math.floor(this.GRID_RES / 2);

    for (let r = mid - 1; r <= mid + 1; r++) {
      for (let c = mid - 1; c <= mid + 1; c++) {
        const gridIdx = this.idx2Dto1D(r + 1, c + 1); // +1 for padding offset
        this.curr_density[gridIdx] = 1.0;
      }
    }
  }

  /**
   * Adds density to a specific cell in the grid.
   * @param r vertical axis (row)
   * @param c horizontal axis (column)
   * @param amount amount of density to add (0.0 to 1.0)
   */
  addDensity(r: number, c: number, amount: number) {
    const gridIdx = this.idx2Dto1D(r + 1, c + 1); // +1 for padding offset
    this.curr_density[gridIdx] += amount;
  }

  /**
   * Adds velocity to a specific cell in the grid.
   * @param r vertical axis (row)
   * @param c horizontal axis (column)
   * @param amountX amount of velocity to add in X direction
   * @param amountY amount of velocity to add in Y direction
   */
  addVelocity(r: number, c: number, amountX: number, amountY: number) {
    const gridIdx = this.idx2Dto1D(r + 1, c + 1); // +1 for padding offset
    this.curr_velocityX[gridIdx] += amountX;
    this.curr_velocityY[gridIdx] += amountY;
  }

  /**
   *
   * @param b
   * @param x
   */
  private set_bnd(b: number, x: Float32Array) {
    // top and bottom rows (excluding corners)
    for (const row of [0, this.GRID_RES + this.GRID_PADDING - 1]) {
      for (let col = 1; col < this.GRID_RES + this.GRID_PADDING - 1; col++) {
        const idx = this.idx2Dto1D(row, col);
        const neighborIdx = this.idx2Dto1D(
          row === 0 ? 1 : this.GRID_RES + this.GRID_PADDING - 2,
          col
        );
        x[idx] = b === 2 ? -x[neighborIdx] : x[neighborIdx];
      }
    }

    // left and right walls (excluding corners)
    for (const col of [0, this.GRID_RES + this.GRID_PADDING - 1]) {
      for (let row = 1; row < this.GRID_RES + this.GRID_PADDING - 1; row++) {
        const idx = this.idx2Dto1D(row, col);
        const neighborIdx = this.idx2Dto1D(
          row,
          col === 0 ? 1 : this.GRID_RES + this.GRID_PADDING - 2
        );
        x[idx] = b === 1 ? -x[neighborIdx] : x[neighborIdx];
      }
    }

    // corners
    const maxIdx = this.GRID_RES + this.GRID_PADDING - 1;
    x[this.idx2Dto1D(0, 0)] =
      0.5 * (x[this.idx2Dto1D(1, 0)] + x[this.idx2Dto1D(0, 1)]);

    x[this.idx2Dto1D(0, maxIdx)] =
      0.5 * (x[this.idx2Dto1D(1, maxIdx)] + x[this.idx2Dto1D(0, maxIdx - 1)]);

    x[this.idx2Dto1D(maxIdx, 0)] =
      0.5 * (x[this.idx2Dto1D(maxIdx - 1, 0)] + x[this.idx2Dto1D(maxIdx, 1)]);

    x[this.idx2Dto1D(maxIdx, maxIdx)] =
      0.5 *
      (x[this.idx2Dto1D(maxIdx - 1, maxIdx)] +
        x[this.idx2Dto1D(maxIdx, maxIdx - 1)]);
  }

  /**
   *
   * @param b
   * @param x
   */
  private linSolve(
    b: number,
    curr_val: Float32Array,
    prev_val: Float32Array,
    a: number,
    c: number
  ) {
    for (let k = 0; k < this.ITERATIONS; k++) {
      for (let row = 1; row <= this.GRID_RES; row++) {
        for (let col = 1; col <= this.GRID_RES; col++) {
          const idx = this.idx2Dto1D(row, col);

          curr_val[idx] =
            (prev_val[idx] +
              a *
                (curr_val[this.idx2Dto1D(row - 1, col)] +
                  curr_val[this.idx2Dto1D(row + 1, col)] +
                  curr_val[this.idx2Dto1D(row, col - 1)] +
                  curr_val[this.idx2Dto1D(row, col + 1)])) /
            c;
        }
      }
    }

    this.set_bnd(b, curr_val);
  }

  advect(
    b: number,
    next_val: Float32Array,
    prev_val: Float32Array,
    velocityX: Float32Array,
    velocityY: Float32Array,
    dt: number
  ) {
    for (let row = 1; row <= this.GRID_RES; row++) {
      for (let col = 1; col <= this.GRID_RES; col++) {
        let dt0 = dt * this.GRID_RES;
        const idx = this.idx2Dto1D(row, col);

        // Backtrace to find source position
        let x = col - dt0 * velocityX[idx];
        let y = row - dt0 * velocityY[idx];

        // Clamp to grid boundaries
        x = Math.max(0.5, Math.min(x, this.GRID_RES + 0.5));
        y = Math.max(0.5, Math.min(y, this.GRID_RES + 0.5));

        // Get integer and fractional parts
        const i0 = Math.floor(x),
          i1 = i0 + 1;
        const j0 = Math.floor(y),
          j1 = j0 + 1;

        const s1 = x - i0,
          s0 = 1 - s1;
        const t1 = y - j0,
          t0 = 1 - t1;

        // Bilinear interpolation
        next_val[idx] =
          s0 *
            (t0 * prev_val[this.idx2Dto1D(j0, i0)] +
              t1 * prev_val[this.idx2Dto1D(j1, i0)]) +
          s1 *
            (t0 * prev_val[this.idx2Dto1D(j0, i1)] +
              t1 * prev_val[this.idx2Dto1D(j1, i1)]);
      }
    }
    this.set_bnd(b, next_val);
  }

  diffuse(
    b: number,
    curr_val: Float32Array,
    prev_val: Float32Array,
    diff: number,
    dt: number
  ) {
    const a = dt * diff * this.GRID_RES * this.GRID_RES;
    const c = 1 + 4 * a;
    this.linSolve(b, curr_val, prev_val, a, c);
  }

  project(
    velocityX: Float32Array,
    velocityY: Float32Array,
    p: Float32Array,
    div: Float32Array
  ) {
    // Compute divergence
    for (let row = 1; row <= this.GRID_RES; row++) {
      for (let col = 1; col <= this.GRID_RES; col++) {
        const idx = this.idx2Dto1D(row, col);
        div[idx] =
          (-0.5 *
            (velocityY[this.idx2Dto1D(row + 1, col)] -
              velocityY[this.idx2Dto1D(row - 1, col)] +
              velocityX[this.idx2Dto1D(row, col + 1)] -
              velocityX[this.idx2Dto1D(row, col - 1)])) /
          this.GRID_RES;
        p[idx] = 0;
      }
    }

    this.set_bnd(0, div);
    this.set_bnd(0, p);

    // Solve for pressure
    this.linSolve(0, p, div, 1, 4);

    // Subtract pressure gradient from velocity field
    for (let row = 1; row <= this.GRID_RES; row++) {
      for (let col = 1; col <= this.GRID_RES; col++) {
        const idx = this.idx2Dto1D(row, col);
        velocityX[idx] -=
          0.5 *
          this.GRID_RES *
          (p[this.idx2Dto1D(row, col + 1)] - p[this.idx2Dto1D(row, col - 1)]);
        velocityY[idx] -=
          0.5 *
          this.GRID_RES *
          (p[this.idx2Dto1D(row + 1, col)] - p[this.idx2Dto1D(row - 1, col)]);
      }
    }

    this.set_bnd(1, velocityX);
    this.set_bnd(2, velocityY);
  }

  step(dt: number) {
    const visc = 0.0001;
    const diff = 0.0001; // Smoke diffusion

    // 1. VELOCITY STEP
    // Diffuse X and Y velocity
    this.diffuse(1, this.prev_velocityX, this.curr_velocityX, visc, dt);
    this.diffuse(2, this.prev_velocityY, this.curr_velocityY, visc, dt);

    // Clean up
    this.project(
      this.prev_velocityX,
      this.prev_velocityY,
      this.curr_velocityX,
      this.curr_velocityY
    );

    // Advect X and Y velocity
    // Note: We advect FROM prev TO curr.
    this.advect(
      1,
      this.curr_velocityX,
      this.prev_velocityX,
      this.prev_velocityX,
      this.prev_velocityY,
      dt
    );
    this.advect(
      2,
      this.curr_velocityY,
      this.prev_velocityY,
      this.prev_velocityX,
      this.prev_velocityY,
      dt
    );

    // Clean up again
    this.project(
      this.curr_velocityX,
      this.curr_velocityY,
      this.prev_velocityX,
      this.prev_velocityY
    );

    // 2. DENSITY STEP
    // Diffuse density
    this.diffuse(0, this.prev_density, this.curr_density, diff, dt);

    // Advect density (Move smoke by velocity)
    this.advect(
      0,
      this.curr_density,
      this.prev_density,
      this.curr_velocityX,
      this.curr_velocityY,
      dt
    );
  }

  render(ctx: CanvasRenderingContext2D) {
    // Visualize density field
    const maxRGBValue = 255;
    for (let y = 0; y < this.GRID_RES; y++) {
      for (let x = 0; x < this.GRID_RES; x++) {
        const gridIdx = this.idx2Dto1D(y + 1, x + 1); // +1 for padding offset
        const pixelIdx = (x + y * this.GRID_RES) * 4; // 4 channels per pixel

        const densityValue = this.curr_density[gridIdx];
        const clampedValue =
          Math.min(Math.max(densityValue, 0), 1) * maxRGBValue;

        this.imageData!.data[pixelIdx] = clampedValue; // R
        this.imageData!.data[pixelIdx + 1] = clampedValue; // G
        this.imageData!.data[pixelIdx + 2] = clampedValue; // B
        this.imageData!.data[pixelIdx + 3] = maxRGBValue; // A
      }
    }

    ctx.putImageData(this.imageData!, 0, 0);
  }

  /**
   * @param y vertical axis (row)
   * @param x horizontal axis (column)
   * @returns Index in 1D array for given 2D coordinates
   */
  private idx2Dto1D(y: number, x: number): number {
    return x + y * (this.GRID_RES + this.GRID_PADDING);
  }
}
