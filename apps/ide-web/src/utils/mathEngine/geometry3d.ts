// 3D Geometry utilities for World Engine
// Bounding volumes, raycasting, frustum culling, collision detection

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface AABB {
  min: Vec3;
  max: Vec3;
}

export interface Sphere {
  center: Vec3;
  radius: number;
}

export interface Ray {
  origin: Vec3;
  direction: Vec3; // Should be normalized
}

export interface Plane {
  normal: Vec3; // Should be normalized
  distance: number; // Distance from origin
}

export interface Frustum {
  planes: Plane[]; // 6 planes: left, right, top, bottom, near, far
}

export class Geometry3D {
  // Vector operations
  static vec3 = {
    create(x: number = 0, y: number = 0, z: number = 0): Vec3 {
      return { x, y, z };
    },

    add(a: Vec3, b: Vec3): Vec3 {
      return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
    },

    sub(a: Vec3, b: Vec3): Vec3 {
      return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
    },

    scale(v: Vec3, s: number): Vec3 {
      return { x: v.x * s, y: v.y * s, z: v.z * s };
    },

    dot(a: Vec3, b: Vec3): number {
      return a.x * b.x + a.y * b.y + a.z * b.z;
    },

    cross(a: Vec3, b: Vec3): Vec3 {
      return {
        x: a.y * b.z - a.z * b.y,
        y: a.z * b.x - a.x * b.z,
        z: a.x * b.y - a.y * b.x,
      };
    },

    magnitude(v: Vec3): number {
      return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    },

    normalize(v: Vec3): Vec3 {
      const mag = this.magnitude(v);
      if (mag < 1e-10) return { x: 0, y: 0, z: 1 };
      return this.scale(v, 1 / mag);
    },

    distance(a: Vec3, b: Vec3): number {
      return this.magnitude(this.sub(b, a));
    },

    lerp(a: Vec3, b: Vec3, t: number): Vec3 {
      return {
        x: a.x + (b.x - a.x) * t,
        y: a.y + (b.y - a.y) * t,
        z: a.z + (b.z - a.z) * t,
      };
    },
  };

  // AABB (Axis-Aligned Bounding Box) operations
  static aabb = {
    create(min: Vec3, max: Vec3): AABB {
      return { min, max };
    },

    fromCenterSize(center: Vec3, size: Vec3): AABB {
      const halfSize = Geometry3D.vec3.scale(size, 0.5);
      return {
        min: Geometry3D.vec3.sub(center, halfSize),
        max: Geometry3D.vec3.add(center, halfSize),
      };
    },

    contains(box: AABB, point: Vec3): boolean {
      return (
        point.x >= box.min.x &&
        point.x <= box.max.x &&
        point.y >= box.min.y &&
        point.y <= box.max.y &&
        point.z >= box.min.z &&
        point.z <= box.max.z
      );
    },

    intersects(a: AABB, b: AABB): boolean {
      return (
        a.min.x <= b.max.x &&
        a.max.x >= b.min.x &&
        a.min.y <= b.max.y &&
        a.max.y >= b.min.y &&
        a.min.z <= b.max.z &&
        a.max.z >= b.min.z
      );
    },

    center(box: AABB): Vec3 {
      return {
        x: (box.min.x + box.max.x) * 0.5,
        y: (box.min.y + box.max.y) * 0.5,
        z: (box.min.z + box.max.z) * 0.5,
      };
    },

    size(box: AABB): Vec3 {
      return Geometry3D.vec3.sub(box.max, box.min);
    },
  };

  // Sphere operations
  static sphere = {
    create(center: Vec3, radius: number): Sphere {
      return { center, radius };
    },

    contains(sphere: Sphere, point: Vec3): boolean {
      return Geometry3D.vec3.distance(sphere.center, point) <= sphere.radius;
    },

    intersects(a: Sphere, b: Sphere): boolean {
      const dist = Geometry3D.vec3.distance(a.center, b.center);
      return dist <= a.radius + b.radius;
    },

    intersectsAABB(sphere: Sphere, box: AABB): boolean {
      // Find closest point on AABB to sphere center
      const closest = {
        x: Math.max(box.min.x, Math.min(sphere.center.x, box.max.x)),
        y: Math.max(box.min.y, Math.min(sphere.center.y, box.max.y)),
        z: Math.max(box.min.z, Math.min(sphere.center.z, box.max.z)),
      };

      return Geometry3D.vec3.distance(closest, sphere.center) <= sphere.radius;
    },
  };

  // Ray operations
  static ray = {
    create(origin: Vec3, direction: Vec3): Ray {
      return {
        origin,
        direction: Geometry3D.vec3.normalize(direction),
      };
    },

    // Ray-AABB intersection (slab method)
    intersectAABB(ray: Ray, box: AABB): { hit: boolean; distance: number } {
      const invDir = {
        x: 1 / ray.direction.x,
        y: 1 / ray.direction.y,
        z: 1 / ray.direction.z,
      };

      const t1 = (box.min.x - ray.origin.x) * invDir.x;
      const t2 = (box.max.x - ray.origin.x) * invDir.x;
      const t3 = (box.min.y - ray.origin.y) * invDir.y;
      const t4 = (box.max.y - ray.origin.y) * invDir.y;
      const t5 = (box.min.z - ray.origin.z) * invDir.z;
      const t6 = (box.max.z - ray.origin.z) * invDir.z;

      const tmin = Math.max(Math.max(Math.min(t1, t2), Math.min(t3, t4)), Math.min(t5, t6));
      const tmax = Math.min(Math.min(Math.max(t1, t2), Math.max(t3, t4)), Math.max(t5, t6));

      // If tmax < 0, ray is intersecting AABB, but whole AABB is behind us
      if (tmax < 0) {
        return { hit: false, distance: tmax };
      }

      // If tmin > tmax, ray doesn't intersect AABB
      if (tmin > tmax) {
        return { hit: false, distance: tmin };
      }

      return { hit: true, distance: tmin >= 0 ? tmin : tmax };
    },

    // Ray-Sphere intersection
    intersectSphere(ray: Ray, sphere: Sphere): { hit: boolean; distance: number } {
      const oc = Geometry3D.vec3.sub(ray.origin, sphere.center);
      const a = Geometry3D.vec3.dot(ray.direction, ray.direction);
      const b = 2.0 * Geometry3D.vec3.dot(oc, ray.direction);
      const c = Geometry3D.vec3.dot(oc, oc) - sphere.radius * sphere.radius;
      const discriminant = b * b - 4 * a * c;

      if (discriminant < 0) {
        return { hit: false, distance: -1 };
      }

      const t = (-b - Math.sqrt(discriminant)) / (2.0 * a);
      return { hit: t >= 0, distance: t };
    },

    // Ray-Plane intersection
    intersectPlane(ray: Ray, plane: Plane): { hit: boolean; distance: number } {
      const denom = Geometry3D.vec3.dot(plane.normal, ray.direction);

      // Ray is parallel to plane
      if (Math.abs(denom) < 1e-6) {
        return { hit: false, distance: -1 };
      }

      const t = -(Geometry3D.vec3.dot(plane.normal, ray.origin) + plane.distance) / denom;
      return { hit: t >= 0, distance: t };
    },

    // Get point along ray at distance t
    pointAt(ray: Ray, t: number): Vec3 {
      return Geometry3D.vec3.add(ray.origin, Geometry3D.vec3.scale(ray.direction, t));
    },
  };

  // Frustum culling
  static frustum = {
    // Create frustum from view-projection matrix (simplified for demo)
    create(fovDegrees: number, aspect: number, near: number, far: number, position: Vec3, forward: Vec3, up: Vec3): Frustum {
      const fovRad = (fovDegrees * Math.PI) / 180;
      const halfVSide = far * Math.tan(fovRad * 0.5);
      const halfHSide = halfVSide * aspect;

      const right = Geometry3D.vec3.normalize(Geometry3D.vec3.cross(forward, up));
      const realUp = Geometry3D.vec3.cross(right, forward);

      const farCenter = Geometry3D.vec3.add(position, Geometry3D.vec3.scale(forward, far));
      const nearCenter = Geometry3D.vec3.add(position, Geometry3D.vec3.scale(forward, near));

      // Create 6 frustum planes
      const planes: Plane[] = [];

      // Near plane
      planes.push({
        normal: forward,
        distance: -Geometry3D.vec3.dot(forward, nearCenter),
      });

      // Far plane
      planes.push({
        normal: Geometry3D.vec3.scale(forward, -1),
        distance: Geometry3D.vec3.dot(forward, farCenter),
      });

      // Left plane
      const leftNormal = Geometry3D.vec3.normalize(
        Geometry3D.vec3.cross(
          realUp,
          Geometry3D.vec3.sub(Geometry3D.vec3.add(farCenter, Geometry3D.vec3.scale(right, -halfHSide)), position)
        )
      );
      planes.push({
        normal: leftNormal,
        distance: -Geometry3D.vec3.dot(leftNormal, position),
      });

      // Right plane
      const rightNormal = Geometry3D.vec3.normalize(
        Geometry3D.vec3.cross(
          Geometry3D.vec3.sub(Geometry3D.vec3.add(farCenter, Geometry3D.vec3.scale(right, halfHSide)), position),
          realUp
        )
      );
      planes.push({
        normal: rightNormal,
        distance: -Geometry3D.vec3.dot(rightNormal, position),
      });

      // Top plane
      const topNormal = Geometry3D.vec3.normalize(
        Geometry3D.vec3.cross(
          right,
          Geometry3D.vec3.sub(Geometry3D.vec3.add(farCenter, Geometry3D.vec3.scale(realUp, halfVSide)), position)
        )
      );
      planes.push({
        normal: topNormal,
        distance: -Geometry3D.vec3.dot(topNormal, position),
      });

      // Bottom plane
      const bottomNormal = Geometry3D.vec3.normalize(
        Geometry3D.vec3.cross(
          Geometry3D.vec3.sub(Geometry3D.vec3.add(farCenter, Geometry3D.vec3.scale(realUp, -halfVSide)), position),
          right
        )
      );
      planes.push({
        normal: bottomNormal,
        distance: -Geometry3D.vec3.dot(bottomNormal, position),
      });

      return { planes };
    },

    // Test if AABB is inside frustum
    containsAABB(frustum: Frustum, box: AABB): boolean {
      // Get all 8 corners of AABB
      const corners = [
        { x: box.min.x, y: box.min.y, z: box.min.z },
        { x: box.max.x, y: box.min.y, z: box.min.z },
        { x: box.min.x, y: box.max.y, z: box.min.z },
        { x: box.max.x, y: box.max.y, z: box.min.z },
        { x: box.min.x, y: box.min.y, z: box.max.z },
        { x: box.max.x, y: box.min.y, z: box.max.z },
        { x: box.min.x, y: box.max.y, z: box.max.z },
        { x: box.max.x, y: box.max.y, z: box.max.z },
      ];

      // For each plane, check if all corners are on the negative side
      for (const plane of frustum.planes) {
        let allOutside = true;
        for (const corner of corners) {
          const dist = Geometry3D.vec3.dot(plane.normal, corner) + plane.distance;
          if (dist >= 0) {
            allOutside = false;
            break;
          }
        }
        // If all corners are outside this plane, the box is outside the frustum
        if (allOutside) return false;
      }

      return true;
    },

    // Test if sphere is inside frustum
    containsSphere(frustum: Frustum, sphere: Sphere): boolean {
      for (const plane of frustum.planes) {
        const dist = Geometry3D.vec3.dot(plane.normal, sphere.center) + plane.distance;
        if (dist < -sphere.radius) {
          return false;
        }
      }
      return true;
    },
  };
}
