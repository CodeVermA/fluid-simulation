/**
 * GLSL shader sources for GPU-accelerated fluid simulation.
 * All shaders use WebGL2 (GLSL ES 3.00) with floating-point precision.
 */

/**
 * Vertex shader for full-screen quad rendering.
 * Converts clip-space positions [-1,1] to UV coordinates [0,1].
 */
export const VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec2 a_position;
out vec2 v_texCoord;

void main() {
    v_texCoord = a_position * 0.5 + 0.5;  // Convert from [-1,-1] to [0,0]
    gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

/**
 * Advection shader implementing semi-Lagrangian method.
 * Traces particles backward in time and samples using hardware bilinear interpolation.
 * Obstacle-aware: clamps backtraced position to prevent sampling through walls.
 */
export const ADVECT_SHADER = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_velocity;
uniform sampler2D u_source; // velocity or density
uniform sampler2D u_obstacles;
uniform vec2 u_texelSize;
uniform float u_dt;
uniform float u_dissipation;

out vec4 outColor;

void main() {
    // 1. Solid cells are empty.
    if (texture(u_obstacles, v_texCoord).r > 0.1) {
        outColor = vec4(0.0);
        return;
    }

    // 2. Trace Back (Method of Characteristics - Section 2.1)
    vec2 velocity = texture(u_velocity, v_texCoord).xy;
    vec2 previousCoord = v_texCoord - (velocity * u_dt * u_texelSize);

    // 3. Clamp to fluid domain to prevent mass loss at boundaries
    // If backtrace hits a wall, iteratively step back until we find fluid
    float wallAtSource = texture(u_obstacles, previousCoord).r;
    
    if (wallAtSource > 0.1) {
        // Instead of zeroing, clamp the backtrace to stay in fluid region
        // Try stepping back less aggressively
        vec2 delta = previousCoord - v_texCoord;
        float stepFactor = 0.9;
        
        for (int i = 0; i < 5; i++) {
            previousCoord = v_texCoord - (delta * stepFactor);
            wallAtSource = texture(u_obstacles, previousCoord).r;
            
            if (wallAtSource < 0.1) {
                break; // Found fluid region
            }
            stepFactor *= 0.8; // Reduce step further
        }
        
        // If still in wall after attempts, use current cell value (mass conservation)
        if (wallAtSource > 0.1) {
            previousCoord = v_texCoord;
        }
    }
    
    outColor = texture(u_source, previousCoord);

    // 4. Dissipation (Eq 247 in PDF)
    outColor *= u_dissipation;
}
`;

/**
 * Render shader for visualizing density field on screen.
 * Converts density texture to RGB output.
 */
export const RENDER_SHADER = `#version 300 es
precision highp float;

in vec2 v_texCoord;
uniform sampler2D u_texture;
out vec4 outColor;

void main() {
    vec4 color = texture(u_texture, v_texCoord);
    outColor = vec4(color.rgb, 1.0);
}
`;

/**
 * Splat shader for adding density or velocity at a point.
 * Uses Gaussian falloff for smooth, circular splats.
 */
export const SPLAT_SHADER = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_target;
uniform float u_aspectRatio;
uniform vec2 u_point;
uniform vec3 u_color;
uniform float u_radius;

out vec4 outColor;

void main() {
    vec2 p = v_texCoord - u_point;
    p.x *= u_aspectRatio;
    
    vec3 splat = u_color * exp(-dot(p, p) / u_radius);
    vec3 base = texture(u_target, v_texCoord).rgb;
    outColor = vec4(base + splat, 1.0);
}
`;

/**
 * Divergence shader for computing velocity field divergence.
 * Uses central differences to measure expansion/compression.
 * Obstacle-aware: treats solid boundaries properly.
 */
export const DIVERGENCE_SHADER = `#version 300 es
    precision highp float;

    in vec2 v_texCoord;
    uniform sampler2D u_velocity;
    uniform sampler2D u_obstacles;
    uniform vec2 u_texelSize;

    out vec4 outColor;

    void main() {
        if (texture(u_obstacles, v_texCoord).r > 0.1) {
            outColor = vec4(0.0);
            return;
        }

        // Neighbors
        float L = texture(u_velocity, v_texCoord - vec2(u_texelSize.x, 0.0)).x;
        float R = texture(u_velocity, v_texCoord + vec2(u_texelSize.x, 0.0)).x;
        float B = texture(u_velocity, v_texCoord - vec2(0.0, u_texelSize.y)).y;
        float T = texture(u_velocity, v_texCoord + vec2(0.0, u_texelSize.y)).y;

        // Obstacle Velocities are effectively 0 (No Slip/Free Slip masked at boundary)
        float oL = texture(u_obstacles, v_texCoord - vec2(u_texelSize.x, 0.0)).r;
        float oR = texture(u_obstacles, v_texCoord + vec2(u_texelSize.x, 0.0)).r;
        float oB = texture(u_obstacles, v_texCoord - vec2(0.0, u_texelSize.y)).r;
        float oT = texture(u_obstacles, v_texCoord + vec2(0.0, u_texelSize.y)).r;

        if (oL > 0.1) L = 0.0;
        if (oR > 0.1) R = 0.0;
        if (oB > 0.1) B = 0.0;
        if (oT > 0.1) T = 0.0;

        float div = 0.5 * (R - L + T - B);
        outColor = vec4(div, 0.0, 0.0, 1.0);
    }
`;

/**
 * Generalized Relaxation Shader (Jacobi).
 * Solves linear systems of form: x = ( alpha * sum(neighbors) + b ) / beta
 * * USED FOR:
 * 1. Diffusion (Eq 198): (I - v*dt*Laplacian) w3 = w2
 * 2. Projection (Eq 4): Laplacian q = div(w3)
 */
export const ITERATE_SHADER = `#version 300 es
    precision highp float;

    in vec2 v_texCoord;

    uniform sampler2D u_x; // Current solution estimate (x)
    uniform sampler2D u_b; // Center term (b)
    uniform sampler2D u_obstacles;
    uniform vec2 u_texelSize;
    
    uniform float u_alpha;
    uniform float u_beta;

    out vec4 outColor;

    void main() {
        // Neighbors
        vec4 L = texture(u_x, v_texCoord - vec2(u_texelSize.x, 0.0));
        vec4 R = texture(u_x, v_texCoord + vec2(u_texelSize.x, 0.0));
        vec4 B = texture(u_x, v_texCoord - vec2(0.0, u_texelSize.y));
        vec4 T = texture(u_x, v_texCoord + vec2(0.0, u_texelSize.y));

        vec4 bC = texture(u_b, v_texCoord);
        
        // Use Center Solution for Neumann BC
        vec4 xC = texture(u_x, v_texCoord);
        
        float oL = texture(u_obstacles, v_texCoord - vec2(u_texelSize.x, 0.0)).r;
        float oR = texture(u_obstacles, v_texCoord + vec2(u_texelSize.x, 0.0)).r;
        float oB = texture(u_obstacles, v_texCoord - vec2(0.0, u_texelSize.y)).r;
        float oT = texture(u_obstacles, v_texCoord + vec2(0.0, u_texelSize.y)).r;

        // If neighbor is wall, assume it has same value as center (Gradient = 0)
        if (oL > 0.1) L = xC;
        if (oR > 0.1) R = xC;
        if (oB > 0.1) B = xC;
        if (oT > 0.1) T = xC;

        // Standard Jacobi Iteration
        outColor = (L + R + B + T + (bC * u_alpha)) / u_beta;
    }
`;

/**
 * Gradient subtraction shader for projection step.
 * Removes pressure gradient from velocity to make field divergence-free.
 */
export const GRADIENT_SUBTRACT_SHADER = `#version 300 es
precision highp float;
in vec2 v_texCoord;
uniform sampler2D u_velocity;
uniform sampler2D u_pressure;
uniform sampler2D u_obstacles;
uniform vec2 u_texelSize;
out vec4 outColor;

void main() {
    if (texture(u_obstacles, v_texCoord).r > 0.1) {
        outColor = vec4(0.0);
        return;
    }

    float pL = texture(u_pressure, v_texCoord - vec2(u_texelSize.x, 0.0)).r;
    float pR = texture(u_pressure, v_texCoord + vec2(u_texelSize.x, 0.0)).r;
    float pB = texture(u_pressure, v_texCoord - vec2(0.0, u_texelSize.y)).r;
    float pT = texture(u_pressure, v_texCoord + vec2(0.0, u_texelSize.y)).r;
    float pC = texture(u_pressure, v_texCoord).r;

    float oL = texture(u_obstacles, v_texCoord - vec2(u_texelSize.x, 0.0)).r;
    float oR = texture(u_obstacles, v_texCoord + vec2(u_texelSize.x, 0.0)).r;
    float oB = texture(u_obstacles, v_texCoord - vec2(0.0, u_texelSize.y)).r;
    float oT = texture(u_obstacles, v_texCoord + vec2(0.0, u_texelSize.y)).r;

    // Enforce Neumann BC (dp/dn = 0) at walls
    if (oL > 0.1) pL = pC;
    if (oR > 0.1) pR = pC;
    if (oB > 0.1) pB = pC;
    if (oT > 0.1) pT = pC;

    vec2 vel = texture(u_velocity, v_texCoord).xy;
    vel.x -= 0.5 * (pR - pL);
    vel.y -= 0.5 * (pT - pB);

    outColor = vec4(vel, 0.0, 1.0);
}
`;

export const CURL_SHADER = `#version 300 es
    precision highp float;

    in vec2 v_texCoord;

    uniform sampler2D u_velocity;
    uniform vec2 u_texelSize;

    out vec4 outColor;

    void main() {
        // Get neighbors
        float L = texture(u_velocity, v_texCoord - vec2(u_texelSize.x, 0.0)).y;
        float R = texture(u_velocity, v_texCoord + vec2(u_texelSize.x, 0.0)).y;
        float T = texture(u_velocity, v_texCoord + vec2(0.0, u_texelSize.y)).x;
        float B = texture(u_velocity, v_texCoord - vec2(0.0, u_texelSize.y)).x;

        // Calculate Curl (Vorticity)
        // Ideally: (dy/dx - dx/dy)
        float vorticity = 0.5 * ((R - L) - (T - B));

        outColor = vec4(vorticity, 0.0, 0.0, 1.0);
    }
`;

/**
 * Boundary shader for enforcing velocity boundary conditions at walls.
 * Implements free-slip: normal velocity = 0, tangential velocity preserved with slight damping.
 */
export const BOUNDARY_SHADER = `#version 300 es
precision highp float;

in vec2 v_texCoord;

uniform sampler2D u_velocity;
uniform sampler2D u_obstacles;
uniform vec2 u_texelSize;
uniform float u_damping;

out vec4 outColor;

void main() {
    vec2 velocity = texture(u_velocity, v_texCoord).xy;
    
    // Solid cells have zero velocity
    if (texture(u_obstacles, v_texCoord).r > 0.1) {
        outColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }
    
    // Check neighbors for walls
    float oLeft = texture(u_obstacles, v_texCoord - vec2(u_texelSize.x, 0.0)).r;
    float oRight = texture(u_obstacles, v_texCoord + vec2(u_texelSize.x, 0.0)).r;
    float oBottom = texture(u_obstacles, v_texCoord - vec2(0.0, u_texelSize.y)).r;
    float oTop = texture(u_obstacles, v_texCoord + vec2(0.0, u_texelSize.y)).r;
    
    // Enforce No-Penetration:
    // If wall is to the LEFT, we cannot have NEGATIVE x velocity. -> max(v.x, 0.0)
    // If wall is to the RIGHT, we cannot have POSITIVE x velocity. -> min(v.x, 0.0)
    
    if (oLeft > 0.1) {
        velocity.x = max(velocity.x, 0.0); 
        velocity.y *= u_damping;
    }
    if (oRight > 0.1) {
        velocity.x = min(velocity.x, 0.0);
        velocity.y *= u_damping;
    }
    if (oBottom > 0.1) {
        velocity.y = max(velocity.y, 0.0);
        velocity.x *= u_damping;
    }
    if (oTop > 0.1) {
        velocity.y = min(velocity.y, 0.0);
        velocity.x *= u_damping;
    }
    
    outColor = vec4(velocity, 0.0, 1.0);
}
`;

export const VORTICITY_SHADER = `#version 300 es
    precision highp float;

    in vec2 v_texCoord;

    uniform sampler2D u_velocity;
    uniform sampler2D u_curl;
    uniform sampler2D u_obstacles;
    uniform vec2 u_texelSize;
    uniform float u_dt;
    uniform float u_curlStrength;

    out vec4 outColor;

    void main() {
        // Solid cells have zero velocity
        if (texture(u_obstacles, v_texCoord).r > 0.1) {
            outColor = vec4(0.0, 0.0, 0.0, 1.0);
            return;
        }
        
        // 1. Calculate Gradient of Curl Magnitude (The "slope" of the spin)
        float L = abs(texture(u_curl, v_texCoord - vec2(u_texelSize.x, 0.0)).x);
        float R = abs(texture(u_curl, v_texCoord + vec2(u_texelSize.x, 0.0)).x);
        float B = abs(texture(u_curl, v_texCoord - vec2(0.0, u_texelSize.y)).x);
        float T = abs(texture(u_curl, v_texCoord + vec2(0.0, u_texelSize.y)).x);
        float C = texture(u_curl, v_texCoord).x; // The sign tells us spin direction

        vec2 gradient = vec2(R - L, T - B) * 0.5;

        // 2. Normalize to get safe direction
        float len = length(gradient);
        if (len > 0.0001) {
            gradient /= len;
        }

        // 3. Apply force Perpendicular to the gradient
        vec2 forceDir = vec2(gradient.y, -gradient.x); 
        
        // 4. Integrate
        vec2 velocity = texture(u_velocity, v_texCoord).xy;
        vec2 newVelocity = velocity + forceDir * C * u_curlStrength * u_dt;

        outColor = vec4(newVelocity, 0.0, 1.0);
    }
`;
