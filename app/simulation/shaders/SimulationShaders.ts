/**
 * Fluid Simulation Shaders (GLSL ES 3.00)
 *
 * WebGL2 shader programs inspired from Jos Stam's Stable Fluids algorithm (1999).
 * All shaders operate on 2D textures representing fluid quantities (velocity, density, pressure).
 */

// Common constants and macros
const SHADER_CONSTANTS = `
#define ZERO vec4(0.0) // Used for solid cells and empty density
#define OBSTACLE_THRESHOLD 0.5

#define OFFSETX vec2(u_texelSize.x, 0.0)
#define OFFSETY vec2(0.0, u_texelSize.y)
`;

/**
 * Standard fullscreen quad vertex shader. Maps normalized device coordinates [-1,1]
 * to texture coordinates [0,1] for fragment shaders.
 */
export const VERTEX_SHADER = `#version 300 es
precision highp float;

layout(location = 0) in vec2 a_position; // Setting the index of the attribute to 0
out vec2 v_texCoord; // Current pixel the shader is running on

void main() {
    v_texCoord = a_position * 0.5 + 0.5;  // Convert from [-1,-1] to [0,0]
    gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

/**
 * Visualizes a texture to the screen framebuffer. Typically used to render the
 * density field (dye) to make the fluid motion visible.
 *
 * Uniforms:
 *   - u_texture (sampler2D): Source texture to display
 */
export const RENDER_SHADER = `#version 300 es
precision highp float;

in vec2 v_texCoord;
uniform sampler2D u_texture;
uniform sampler2D u_obstacles;
uniform bool u_hideObstacles;
out vec4 outColor;

void main() {
    float obstacle = texture(u_obstacles, v_texCoord).r;
    if (obstacle > 0.5) {
        vec3 obstacleColor = u_hideObstacles ? vec3(0.0) : vec3(1.0);
        outColor = vec4(obstacleColor, 1.0);
        return;
    }

    vec4 color = texture(u_texture, v_texCoord);
    outColor = vec4(color.rgb, 1.0);
}
`;

/**
 * Adds a Gaussian splat to a texture, used for mouse interaction. Can splat
 * colored dye (density) or directional force (velocity).
 *
 * Uniforms:
 *   - u_target (sampler2D): Texture to splat onto (density or velocity)
 *   - u_aspectRatio (float): Canvas width/height ratio to correct circular splats
 *   - u_point (vec2): Splat center in UV coordinates [0,1]
 *   - u_color (vec3): RGB color for density OR (dx, dy, 0) for velocity impulse
 *   - u_radius (float): Gaussian falloff radius (default ~0.0002 in UV space)
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
 * Advects a quantity (velocity or density) through the velocity field using
 * semi-Lagrangian method with RK2 integration. Core of Stable Fluids algorithm.
 *
 * Uniforms:
 *   - u_velocity (sampler2D): Velocity field to trace through
 *   - u_source (sampler2D): Quantity to advect (velocity or density texture)
 *   - u_obstacles (sampler2D): Obstacle mask (1.0 = solid, 0.0 = fluid)
 *   - u_texelSize (vec2): (1/width, 1/height) for neighbor sampling
 *   - u_dt (float): Timestep (default 1/60 seconds)
 */
export const ADVECT_SHADER = `#version 300 es
precision highp float;

${SHADER_CONSTANTS}

in vec2 v_texCoord;

uniform sampler2D u_velocity;
uniform sampler2D u_source; // velocity or density
uniform sampler2D u_obstacles;

uniform float u_dissipation; 
uniform vec2 u_texelSize;
uniform float u_dt;

out vec4 outColor;

void main() {
    // 1. Solid cells are empty.
    if (texture(u_obstacles, v_texCoord).r > OBSTACLE_THRESHOLD) {
        outColor = ZERO;
        return;
    }

    // 2. Backtrace using RK2
    vec2 velocity = texture(u_velocity, v_texCoord).xy;

    vec2 midPos = v_texCoord - (0.5 * u_dt * velocity * u_texelSize);
    midPos = clamp(midPos, vec2(0.0), vec2(1.0)); // Stay within bounds
    vec2 midVelocity = texture(u_velocity, midPos).xy;
    
    vec2 prevPos = v_texCoord - (u_dt * midVelocity * u_texelSize);
    prevPos = clamp(prevPos, vec2(0.0), vec2(1.0)); // Stay within bounds

    // 3. Hit obstacle during backtrace
    if (texture(u_obstacles, prevPos).x > OBSTACLE_THRESHOLD) {
        outColor = ZERO; 
    } else {
        outColor = texture(u_source, prevPos) * u_dissipation;
    }
}`;

/**
 * Jacobi iteration for solving linear systems Ax = b. Used for both pressure
 * projection (incompressibility) and diffusion. Requires multiple passes with
 * ping-pong buffers.
 *
 * Uniforms:
 *   - u_x (sampler2D): Current solution estimate
 *   - u_b (sampler2D): Right-hand side
 *   - u_obstacles (sampler2D): Obstacle mask
 *   - u_alpha (float): Stencil coefficient
 *   - u_beta (float): Diagonal coefficient
 *   - u_isPressure (bool): TRUE for pressure projection, FALSE for diffusion
 *   - u_freeSlip (bool): TRUE for free-slip BC (reflect tangential), FALSE for no-slip
 *   - u_texelSize (vec2): (1/width, 1/height)
 */
export const ITERATE_SHADER = `#version 300 es
    precision highp float;

    ${SHADER_CONSTANTS}
    #define NOSLIP vec4(1.0, 0.0, 0.0, 1.0)

    in vec2 v_texCoord;

    uniform sampler2D u_x; // Current solution estimate (x)
    uniform sampler2D u_b; // Center term (b)
    uniform sampler2D u_obstacles;
    
    uniform float u_alpha;
    uniform float u_beta;
    uniform bool u_isPressure; // TRUE for projection, FALSE for diffusion
    uniform bool u_freeSlip; // TRUE for free-slip BC, FALSE for no-slip BC
    uniform vec2 u_texelSize;

    out vec4 outColor;

    void main() {
        // Solid cells remain empty
        if (texture(u_obstacles, v_texCoord).r > OBSTACLE_THRESHOLD) {
            outColor = texture(u_x, v_texCoord);
            return;
        }

        vec4 bC = texture(u_b, v_texCoord);
        vec4 xC = texture(u_x, v_texCoord);

        // Neighbors
        vec4 L, R, B, T;

        // Left neighbor
        if (texture(u_obstacles, v_texCoord - OFFSETX).r > OBSTACLE_THRESHOLD) {
            L = u_isPressure ? xC : (u_freeSlip ? vec4(-xC.x, xC.y, 0.0, 0.0) : NOSLIP);
        }
        else L = texture(u_x, v_texCoord - OFFSETX);

        // Right neighbor
        if (texture(u_obstacles, v_texCoord + OFFSETX).r > OBSTACLE_THRESHOLD) {
            R = u_isPressure ? xC : (u_freeSlip ? vec4(-xC.x, xC.y, 0.0, 0.0) : NOSLIP);
        }
        else R = texture(u_x, v_texCoord + OFFSETX);

        // Bottom neighbor
        if (texture(u_obstacles, v_texCoord - OFFSETY).r > OBSTACLE_THRESHOLD) {
            B = u_isPressure ? xC : (u_freeSlip ? vec4(xC.x, -xC.y, 0.0, 0.0) : NOSLIP);
        }
        else B = texture(u_x, v_texCoord - OFFSETY);

        // Top neighbor
        if (texture(u_obstacles, v_texCoord + OFFSETY).r > OBSTACLE_THRESHOLD) {
            T = u_isPressure ? xC : (u_freeSlip ? vec4(xC.x, -xC.y, 0.0, 0.0) : NOSLIP);
        }
        else T = texture(u_x, v_texCoord + OFFSETY);
    
        // Jacobi iteration 
        outColor = (bC + u_alpha * (L + R + B + T)) / u_beta;
    }
`;

/**
 * Computes divergence ∇·v of velocity field. Measures "compressibility" -
 * how much fluid is expanding/contracting at each point. Should be ~0 for
 * incompressible flow; deviations are corrected by pressure projection.
 *
 * Uniforms:
 *   - u_velocity (sampler2D): Velocity field (u,v) in RG channels
 *   - u_obstacles (sampler2D): Obstacle mask
 *   - u_texelSize (vec2): (1/width, 1/height) for numerical derivatives
 *   - u_freeSlip (bool): TRUE for free-slip BC, FALSE for no-slip
 */
export const DIVERGENCE_SHADER = `#version 300 es
    precision highp float;

    ${SHADER_CONSTANTS}

    in vec2 v_texCoord;

    uniform sampler2D u_velocity;
    uniform sampler2D u_obstacles;
    uniform vec2 u_texelSize;
    uniform bool u_freeSlip;

    out vec4 outColor;

    void main() {
        if (texture(u_obstacles, v_texCoord).r > OBSTACLE_THRESHOLD) {
            outColor = ZERO;
            return;
        }

        // Neighbors
        float L = texture(u_velocity, v_texCoord - OFFSETX).x;
        float R = texture(u_velocity, v_texCoord + OFFSETX).x;
        float B = texture(u_velocity, v_texCoord - OFFSETY).y;
        float T = texture(u_velocity, v_texCoord + OFFSETY).y;

        // Obstacle Velocities are effectively 0 (No Slip/Free Slip masked at boundary)
        float oL = texture(u_obstacles, v_texCoord - OFFSETX).r;
        float oR = texture(u_obstacles, v_texCoord + OFFSETX).r;
        float oB = texture(u_obstacles, v_texCoord - OFFSETY).r;
        float oT = texture(u_obstacles, v_texCoord + OFFSETY).r;

        vec2 centerVel = texture(u_velocity, v_texCoord).xy;
        float xReflect = u_freeSlip ? -centerVel.x : 0.0;
        float yReflect = u_freeSlip ? -centerVel.y : 0.0;
        
        if (oL > OBSTACLE_THRESHOLD) L = xReflect;
        if (oR > OBSTACLE_THRESHOLD) R = xReflect;
        if (oB > OBSTACLE_THRESHOLD) B = yReflect;
        if (oT > OBSTACLE_THRESHOLD) T = yReflect;
        
        // Calculate Divergence
        float div = 0.5 * (R - L + T - B);
        outColor = vec4(div, 0.0, 0.0, 1.0);
    }
`;

/**
 * Final step of pressure projection: subtracts pressure gradient from velocity
 * to enforce incompressibility (∇·v = 0). Applies Helmholtz-Hodge decomposition.
 *
 * Uniforms:
 *   - u_velocity (sampler2D): Velocity field after advection (still has divergence)
 *   - u_pressure (sampler2D): Pressure field from Jacobi solver (∇²p = ∇·v)
 *   - u_obstacles (sampler2D): Obstacle mask
 *   - u_texelSize (vec2): (1/width, 1/height) for gradient calculation
 */
export const GRADIENT_SUBTRACT_SHADER = `#version 300 es
precision highp float;

${SHADER_CONSTANTS}

in vec2 v_texCoord;

uniform sampler2D u_velocity;
uniform sampler2D u_pressure;
uniform sampler2D u_obstacles;
uniform vec2 u_texelSize;

out vec4 outColor;

void main() {
    // Solid cells remain empty
    if (texture(u_obstacles, v_texCoord).r > OBSTACLE_THRESHOLD) {
        outColor = ZERO;
        return;
    }

    float pC = texture(u_pressure, v_texCoord).r;

    //  Neighboring pressures
    float pL, pR, pB, pT;

    // Obstacles
    float oL = texture(u_obstacles, v_texCoord - OFFSETX).r;
    float oR = texture(u_obstacles, v_texCoord + OFFSETX).r;
    float oB = texture(u_obstacles, v_texCoord - OFFSETY).r;
    float oT = texture(u_obstacles, v_texCoord + OFFSETY).r;

    // Left neighbor
    if (oL > OBSTACLE_THRESHOLD) pL = pC;
    else pL = texture(u_pressure, v_texCoord - OFFSETX).r;
    // Right neighbor
    if (oR > OBSTACLE_THRESHOLD) pR = pC;
    else pR = texture(u_pressure, v_texCoord + OFFSETX).r;

    // Bottom neighbor
    if (oB > OBSTACLE_THRESHOLD) pB = pC;
    else pB = texture(u_pressure, v_texCoord - OFFSETY).r;
    // Top neighbor
    if (oT > OBSTACLE_THRESHOLD) pT = pC;
    else pT = texture(u_pressure, v_texCoord + OFFSETY).r;


    // Compute gradient
    vec2 gradient = vec2(pR - pL, pT - pB) * 0.5;

    // Subtract gradient from velocity
    vec2 velocity = texture(u_velocity, v_texCoord).xy;
    vec2 newVelocity = velocity + gradient;

    // Corrected velocity
    outColor = vec4(newVelocity, 0.0, 1.0);
}
`;

/**
 * Computes the curl (vorticity) of the velocity field.
 * Curl measures rotation at each point - positive = counterclockwise, negative = clockwise.
 * Used as input for vorticity confinement to restore small-scale turbulence.
 *
 * Uniforms:
 *   - u_velocity (sampler2D): Velocity field
 *   - u_texelSize (vec2): (1/width, 1/height) for numerical derivatives
 */
export const CURL_SHADER = `#version 300 es
precision highp float;

${SHADER_CONSTANTS}

in vec2 v_texCoord;

uniform sampler2D u_velocity;
uniform vec2 u_texelSize;

out vec4 outColor;

void main() {
    // Sample neighboring velocities
    float vL = texture(u_velocity, v_texCoord - OFFSETX).y;
    float vR = texture(u_velocity, v_texCoord + OFFSETX).y;
    float vB = texture(u_velocity, v_texCoord - OFFSETY).x;
    float vT = texture(u_velocity, v_texCoord + OFFSETY).x;

    // Compute curl: ∂v/∂x - ∂u/∂y
    float curl = 0.5 * ((vR - vL) - (vT - vB));

    outColor = vec4(curl, 0.0, 0.0, 1.0);
}
`;

/**
 * Applies vorticity confinement to amplify rotational motion (swirls).
 * Adds force perpendicular to curl gradient to counteract numerical dissipation.
 */
export const VORTICITY_SHADER = `#version 300 es
precision highp float;

${SHADER_CONSTANTS}

in vec2 v_texCoord;

uniform sampler2D u_velocity;
uniform sampler2D u_curl;
uniform vec2 u_texelSize;
uniform float u_dt;
uniform float u_epsilon; 

out vec4 outColor;

void main() {
    // 1. Fetch curl values (texture() is heavily cached, but try to keep fetches grouped)
    float cC = texture(u_curl, v_texCoord).r;
    float cL = texture(u_curl, v_texCoord - OFFSETX).r;
    float cR = texture(u_curl, v_texCoord + OFFSETX).r;
    float cB = texture(u_curl, v_texCoord - OFFSETY).r;
    float cT = texture(u_curl, v_texCoord + OFFSETY).r;

    // 2. Compute the gradient of the curl magnitude (central difference)
    vec2 force = vec2(abs(cR) - abs(cL), abs(cT) - abs(cB)) * 0.5;

    // 3. Robust normalisation (inversesqrt is often faster on GPUs than length + div)
    float sqrMag = dot(force, force);
    float invMag = inversesqrt(sqrMag + 1e-7); // 1e-7 prevents division by zero gracefully

    // Calculate normalised N vector
    vec2 N = force * invMag;

    // 4. Compute final confinement force (N x omega)
    // In 2D: (N.x, N.y) x (0, 0, omega) = (N.y * omega, -N.x * omega)
    vec2 confinement = vec2(N.y, -N.x) * cC * u_epsilon;

    // 5. Integrate into velocity
    vec2 velocity = texture(u_velocity, v_texCoord).xy;
    outColor = vec4(velocity + confinement * u_dt, 0.0, 1.0);
}
`;

export const BUOYANCY_SHADER = `#version 300 es
precision highp float;

${SHADER_CONSTANTS}

in vec2 v_texCoord;

uniform sampler2D u_velocity;
uniform sampler2D u_temperature;
uniform sampler2D u_density;

uniform float u_ambientTemperature;
uniform float u_dt;
uniform float u_alpha; // Weight of the dye
uniform float u_beta;  // Buoyancy of the heat

out vec4 outColor;

void main() {
    float T = texture(u_temperature, v_texCoord).r;
    vec3 dye = texture(u_density, v_texCoord).rgb;
    float D = dot(dye, vec3(0.3333333));
    vec2 V = texture(u_velocity, v_texCoord).xy;

    // f_buoy = (-alpha * D + beta * (T - T_amb)) * direction
    // In our WebGL coordinate system, +Y is upwards.
    float forceY = (-u_alpha * D) + (u_beta * (T - u_ambientTemperature));

    // Integrate force into velocity
    V.y += forceY * u_dt;

    outColor = vec4(V, 0.0, 1.0);
}
`;
