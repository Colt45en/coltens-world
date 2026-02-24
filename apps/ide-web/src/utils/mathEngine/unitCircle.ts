// Unit Circle System - Interactive trigonometry visualization
import { MathEngine } from "./core";

export interface UnitCircleState {
  angle: number; // degrees
  highlightQuadrant: number | null;
  showLabels: boolean;
  showGrid: boolean;
}

export class UnitCircleRenderer {
  private ctx: CanvasRenderingContext2D;
  private centerX: number;
  private centerY: number;
  private radius: number;

  constructor(
    private canvas: HTMLCanvasElement,
    radius = 100
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas context not available");
    this.ctx = ctx;
    this.centerX = canvas.width / 2;
    this.centerY = canvas.height / 2;
    this.radius = radius;
  }

  render(state: UnitCircleState) {
    this.clear();
    this.drawGrid();
    this.drawAxes();
    this.drawCircle();
    if (state.highlightQuadrant) {
      this.highlightQuadrant(state.highlightQuadrant);
    }
    this.drawAngle(state.angle);
    this.drawPoint(state.angle);
    if (state.showLabels) {
      this.drawLabels(state.angle);
    }
  }

  private clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private drawGrid() {
    this.ctx.strokeStyle = "rgba(100, 255, 218, 0.1)";
    this.ctx.lineWidth = 1;

    const spacing = 20;
    for (let x = 0; x < this.canvas.width; x += spacing) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
      this.ctx.stroke();
    }
    for (let y = 0; y < this.canvas.height; y += spacing) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
      this.ctx.stroke();
    }
  }

  private drawAxes() {
    this.ctx.strokeStyle = "rgba(158, 210, 255, 0.5)";
    this.ctx.lineWidth = 2;

    // X axis
    this.ctx.beginPath();
    this.ctx.moveTo(0, this.centerY);
    this.ctx.lineTo(this.canvas.width, this.centerY);
    this.ctx.stroke();

    // Y axis
    this.ctx.beginPath();
    this.ctx.moveTo(this.centerX, 0);
    this.ctx.lineTo(this.centerX, this.canvas.height);
    this.ctx.stroke();
  }

  private drawCircle() {
    this.ctx.strokeStyle = "#00eaff";
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.arc(this.centerX, this.centerY, this.radius, 0, Math.PI * 2);
    this.ctx.stroke();
  }

  private highlightQuadrant(quadrant: number) {
    const quadrantRanges: Array<[number, number]> = [
      [0, Math.PI / 2],
      [Math.PI / 2, Math.PI],
      [Math.PI, (3 * Math.PI) / 2],
      [(3 * Math.PI) / 2, Math.PI * 2],
    ];

    const startAngle = quadrantRanges[quadrant - 1];
    if (!startAngle) return;

    this.ctx.fillStyle = "rgba(112, 240, 201, 0.15)";
    this.ctx.beginPath();
    this.ctx.moveTo(this.centerX, this.centerY);
    this.ctx.arc(this.centerX, this.centerY, this.radius, startAngle[0], startAngle[1]);
    this.ctx.closePath();
    this.ctx.fill();
  }

  private drawAngle(angleDeg: number) {
    const rad = MathEngine.trig.degToRad(angleDeg);

    // Draw radius line
    this.ctx.strokeStyle = "#ffb86b";
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(this.centerX, this.centerY);
    this.ctx.lineTo(
      this.centerX + Math.cos(rad) * this.radius,
      this.centerY - Math.sin(rad) * this.radius
    );
    this.ctx.stroke();

    // Draw angle arc
    this.ctx.strokeStyle = "#70f0c9";
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(this.centerX, this.centerY, 30, 0, -rad, rad < 0);
    this.ctx.stroke();
  }

  private drawPoint(angleDeg: number) {
    const rad = MathEngine.trig.degToRad(angleDeg);
    const x = this.centerX + Math.cos(rad) * this.radius;
    const y = this.centerY - Math.sin(rad) * this.radius;

    this.ctx.fillStyle = "#00eaff";
    this.ctx.beginPath();
    this.ctx.arc(x, y, 6, 0, Math.PI * 2);
    this.ctx.fill();

    // Draw projection lines
    this.ctx.strokeStyle = "rgba(0, 234, 255, 0.3)";
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([5, 5]);

    // To X axis
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.ctx.lineTo(x, this.centerY);
    this.ctx.stroke();

    // To Y axis
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
    this.ctx.lineTo(this.centerX, y);
    this.ctx.stroke();

    this.ctx.setLineDash([]);
  }

  private drawLabels(angleDeg: number) {
    const values = MathEngine.trig.allValues(angleDeg);
    const rad = MathEngine.trig.degToRad(angleDeg);
    const x = this.centerX + Math.cos(rad) * this.radius;
    const y = this.centerY - Math.sin(rad) * this.radius;

    this.ctx.fillStyle = "#e0e0e0";
    this.ctx.font = "12px monospace";

    // Cos label (on X axis)
    this.ctx.fillText(
      `cos: ${values.cos.toFixed(3)}`,
      x,
      this.centerY + 20
    );

    // Sin label (on Y axis)
    this.ctx.fillText(
      `sin: ${values.sin.toFixed(3)}`,
      this.centerX + 10,
      y
    );
  }

  updateCenter() {
    this.centerX = this.canvas.width / 2;
    this.centerY = this.canvas.height / 2;
  }
}
