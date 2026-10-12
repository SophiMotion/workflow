import type { FlowFieldFrame, LbmConfig } from "./types";

const CX = [0, 1, 0, -1, 0, 1, -1, -1, 1] as const;
const CY = [0, 0, 1, 0, -1, 1, 1, -1, -1] as const;
const WEIGHT = [4 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 36, 1 / 36, 1 / 36, 1 / 36] as const;
const OPPOSITE = [0, 3, 4, 1, 2, 7, 8, 5, 6] as const;
const DIRECTIONS = 9;

function equilibrium(direction: number, density: number, ux: number, uy: number): number {
  const cu = 3 * (CX[direction]! * ux + CY[direction]! * uy);
  const u2 = ux * ux + uy * uy;
  return WEIGHT[direction]! * density * (1 + cu + 0.5 * cu * cu - 1.5 * u2);
}

export class NumericalInstabilityError extends Error {
  readonly code = "NON_FINITE_FIELD" as const;

  constructor() {
    super("The LBM field contains a non-finite value.");
    this.name = "NumericalInstabilityError";
  }
}

/** A small D2Q9 BGK solver intended for interactive teaching visuals. */
export class LbmSolver {
  private readonly width: number;
  private readonly height: number;

  private readonly tau: number;
  private readonly obstacleMask: Uint8Array;
  private inletVelocity: number;
  private current: Float32Array;
  private next: Float32Array;
  private readonly density: Float32Array;
  private readonly frame: FlowFieldFrame;

  constructor(config: LbmConfig) {
    if (config.tau <= 0.5) {
      throw new RangeError("tau must be greater than 0.5");
    }
    if (config.obstacleMask.length !== config.width * config.height) {
      throw new RangeError("obstacleMask length must equal width * height");
    }

    this.width = config.width;
    this.height = config.height;
    this.tau = config.tau;
    this.obstacleMask = config.obstacleMask;
    this.inletVelocity = clampInletVelocity(config.inletVelocity);

    const cellCount = this.width * this.height;
    this.current = new Float32Array(cellCount * DIRECTIONS);
    this.next = new Float32Array(cellCount * DIRECTIONS);
    this.density = new Float32Array(cellCount);
    this.frame = {
      width: this.width,
      height: this.height,
      speed: new Float32Array(cellCount),
      pressure: new Float32Array(cellCount),
      vorticity: new Float32Array(cellCount),
      velocityX: new Float32Array(cellCount),
      velocityY: new Float32Array(cellCount),
      provenance: "2d-teaching-cfd",
    };

    this.initializeRestField();
  }

  setInletVelocity(value: number): void {
    this.inletVelocity = clampInletVelocity(value);
  }

  step(iterations: number): FlowFieldFrame {
    const iterationCount = Math.max(0, Math.floor(iterations));
    for (let iteration = 0; iteration < iterationCount; iteration += 1) {
      this.advanceOneIteration();
    }
    return this.snapshot();
  }

  snapshot(): FlowFieldFrame {
    const { speed, pressure, velocityX, velocityY } = this.frame;
    const cellCount = this.width * this.height;

    for (let cell = 0; cell < cellCount; cell += 1) {
      if (this.obstacleMask[cell] === 1) {
        this.density[cell] = 0;
        velocityX[cell] = 0;
        velocityY[cell] = 0;
        speed[cell] = 0;
        pressure[cell] = -1 / 3;
        continue;
      }

      const distributionOffset = cell * DIRECTIONS;
      let density = 0;
      let momentumX = 0;
      let momentumY = 0;
      for (let direction = 0; direction < DIRECTIONS; direction += 1) {
        const distribution = this.current[distributionOffset + direction]!;
        density += distribution;
        momentumX += distribution * CX[direction]!;
        momentumY += distribution * CY[direction]!;
      }

      const ux = momentumX / density;
      const uy = momentumY / density;
      this.density[cell] = density;
      velocityX[cell] = ux;
      velocityY[cell] = uy;
      speed[cell] = Math.hypot(ux, uy);
      pressure[cell] = (density - 1) / 3;
    }

    this.computeVorticity();
    this.assertFiniteFields();
    return this.frame;
  }

  private initializeRestField(): void {
    const cellCount = this.width * this.height;
    for (let cell = 0; cell < cellCount; cell += 1) {
      if (this.obstacleMask[cell] === 1) {
        continue;
      }
      const distributionOffset = cell * DIRECTIONS;
      for (let direction = 0; direction < DIRECTIONS; direction += 1) {
        this.current[distributionOffset + direction] = equilibrium(direction, 1, 0, 0);
      }
    }
  }

  private advanceOneIteration(): void {
    this.next.fill(0);

    for (let y = 0; y < this.height; y += 1) {
      for (let x = 0; x < this.width; x += 1) {
        const cell = y * this.width + x;
        if (this.obstacleMask[cell] === 1) {
          continue;
        }

        const distributionOffset = cell * DIRECTIONS;
        let density = 0;
        let momentumX = 0;
        let momentumY = 0;
        for (let direction = 0; direction < DIRECTIONS; direction += 1) {
          const distribution = this.current[distributionOffset + direction]!;
          density += distribution;
          momentumX += distribution * CX[direction]!;
          momentumY += distribution * CY[direction]!;
        }

        const ux = momentumX / density;
        const uy = momentumY / density;
        for (let direction = 0; direction < DIRECTIONS; direction += 1) {
          const distribution = this.current[distributionOffset + direction]!;
          const postCollision = distribution - (distribution - equilibrium(direction, density, ux, uy)) / this.tau;
          const neighborX = x + CX[direction]!;
          const neighborY = y + CY[direction]!;

          if (neighborY < 0 || neighborY >= this.height) {
            this.next[distributionOffset + OPPOSITE[direction]!] = postCollision;
            continue;
          }
          if (neighborX < 0 || neighborX >= this.width) {
            continue;
          }

          const neighbor = neighborY * this.width + neighborX;
          if (this.obstacleMask[neighbor] === 1) {
            this.next[distributionOffset + OPPOSITE[direction]!] = postCollision;
          } else {
            this.next[neighbor * DIRECTIONS + direction] = postCollision;
          }
        }
      }
    }

    this.applyInletBoundary();
    this.applyOutletBoundary();

    const previous = this.current;
    this.current = this.next;
    this.next = previous;
  }

  private applyInletBoundary(): void {
    for (let y = 0; y < this.height; y += 1) {
      const distributionOffset = y * this.width * DIRECTIONS;
      for (let direction = 0; direction < DIRECTIONS; direction += 1) {
        this.next[distributionOffset + direction] = equilibrium(direction, 1, this.inletVelocity, 0);
      }
    }
  }

  private applyOutletBoundary(): void {
    const outletX = this.width - 1;
    const sourceX = this.width - 2;
    for (let y = 0; y < this.height; y += 1) {
      const outletOffset = (y * this.width + outletX) * DIRECTIONS;
      const sourceOffset = (y * this.width + sourceX) * DIRECTIONS;
      for (let direction = 0; direction < DIRECTIONS; direction += 1) {
        this.next[outletOffset + direction] = this.next[sourceOffset + direction]!;
      }
    }
  }

  private computeVorticity(): void {
    const { velocityX, velocityY, vorticity } = this.frame;
    for (let y = 0; y < this.height; y += 1) {
      const lowerY = y === 0 ? 0 : y - 1;
      const upperY = y === this.height - 1 ? this.height - 1 : y + 1;
      const yScale = upperY - lowerY;

      for (let x = 0; x < this.width; x += 1) {
        const leftX = x === 0 ? 0 : x - 1;
        const rightX = x === this.width - 1 ? this.width - 1 : x + 1;
        const xScale = rightX - leftX;
        const cell = y * this.width + x;

        const velocityYGradientX = (velocityY[y * this.width + rightX]! - velocityY[y * this.width + leftX]!) / xScale;
        const velocityXGradientY = (velocityX[upperY * this.width + x]! - velocityX[lowerY * this.width + x]!) / yScale;
        vorticity[cell] = velocityYGradientX - velocityXGradientY;
      }
    }
  }

  private assertFiniteFields(): void {
    const { speed, pressure, vorticity, velocityX, velocityY } = this.frame;
    for (let cell = 0; cell < speed.length; cell += 1) {
      if (!Number.isFinite(speed[cell])
        || !Number.isFinite(pressure[cell])
        || !Number.isFinite(vorticity[cell])
        || !Number.isFinite(velocityX[cell])
        || !Number.isFinite(velocityY[cell])) {
        throw new NumericalInstabilityError();
      }
    }
  }
}

function clampInletVelocity(value: number): number {
  return Math.min(0.08, Math.max(0, value));
}
