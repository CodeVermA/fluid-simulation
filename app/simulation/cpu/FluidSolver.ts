export class FluidSolver {
    width: number;
    height: number;
    // We will add density/velocity arrays here shortly

    constructor(width: number, height: number) {
        this.width = width;
        this.height = height;
        console.log(`CPU Solver created: ${width}x${height}`);
    }

    step(dt: number) {
        // Advect -> Diffuse -> Project
    }

    render(ctx: CanvasRenderingContext2D) {
        // Visualize density
    }
}