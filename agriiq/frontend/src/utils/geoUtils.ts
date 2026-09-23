/**
 * Geographic and Polygon Utility Functions for AgriIQ
 * Supports Catmull-Rom spline interpolation, Chaikin smoothing,
 * RDP simplification, and geodesic area calculation.
 */

// Earth radius in meters (WGS84 mean)
const EARTH_RADIUS = 6378137

/**
 * Calculates geodesic area of a polygon ring in hectares.
 * Coordinates are in [lng, lat] format (GeoJSON standard).
 */
export function calculatePolygonAreaHectares(coords: [number, number][]): number {
  if (!coords || coords.length < 3) return 0

  let area = 0
  const len = coords.length

  for (let i = 0; i < len; i++) {
    const p1 = coords[i]
    const p2 = coords[(i + 1) % len]

    const rad1 = (p1[1] * Math.PI) / 180
    const rad2 = (p2[1] * Math.PI) / 180
    const dLng = ((p2[0] - p1[0]) * Math.PI) / 180

    area += dLng * (2 + Math.sin(rad1) + Math.sin(rad2))
  }

  area = Math.abs((area * EARTH_RADIUS * EARTH_RADIUS) / 4.0)
  return area / 10000.0 // Convert m² to hectares
}

/**
 * Formats area in Hectares and Acres.
 */
export function formatArea(hectares: number): string {
  if (hectares <= 0) return '0.00 ha'
  const acres = hectares * 2.47105
  if (hectares < 1) {
    return `${hectares.toFixed(2)} ha (${acres.toFixed(2)} acres)`
  }
  return `${hectares.toFixed(2)} ha (${acres.toFixed(1)} acres)`
}

/**
 * Cardinal / Catmull-Rom closed spline interpolation for polygon vertices.
 * Points are in [lat, lng] format (Leaflet standard).
 *
 * @param points - Array of [lat, lng] vertices
 * @param curvature - Value between 0 (straight line) and 1 (full spline curve)
 * @param samplesPerSeg - Number of interpolated points per edge segment
 */
export function interpolateClosedSpline(
  points: [number, number][],
  curvature: number = 0.5,
  samplesPerSeg: number = 10
): [number, number][] {
  if (points.length < 3) return points
  if (curvature <= 0.01) return points

  const N = points.length
  const result: [number, number][] = []

  // Cardinal spline tension factor: 0.5 is standard Catmull-Rom
  const tension = 0.5

  for (let i = 0; i < N; i++) {
    const pPrev = points[(i - 1 + N) % N]
    const pCurr = points[i]
    const pNext = points[(i + 1) % N]
    const pNext2 = points[(i + 2) % N]

    // Tangent vectors at current and next points
    const m1: [number, number] = [
      (1 - tension) * (pNext[0] - pPrev[0]) * 0.5,
      (1 - tension) * (pNext[1] - pPrev[1]) * 0.5,
    ]
    const m2: [number, number] = [
      (1 - tension) * (pNext2[0] - pCurr[0]) * 0.5,
      (1 - tension) * (pNext2[1] - pCurr[1]) * 0.5,
    ]

    for (let s = 0; s < samplesPerSeg; s++) {
      const t = s / samplesPerSeg
      const t2 = t * t
      const t3 = t2 * t

      // Cubic Hermite basis functions
      const h00 = 2 * t3 - 3 * t2 + 1
      const h10 = t3 - 2 * t2 + t
      const h01 = -2 * t3 + 3 * t2
      const h11 = t3 - t2

      const splineLat = h00 * pCurr[0] + h10 * m1[0] + h01 * pNext[0] + h11 * m2[0]
      const splineLng = h00 * pCurr[1] + h10 * m1[1] + h01 * pNext[1] + h11 * m2[1]

      const linLat = (1 - t) * pCurr[0] + t * pNext[0]
      const linLng = (1 - t) * pCurr[1] + t * pNext[1]

      // Blend between straight line and curved spline based on curvature
      const blendedLat = (1 - curvature) * linLat + curvature * splineLat
      const blendedLng = (1 - curvature) * linLng + curvature * splineLng

      result.push([blendedLat, blendedLng])
    }
  }

  return result
}

/**
 * Chaikin's corner-cutting algorithm for smoothing freehand polygons.
 * Turns raw hand-drawn paths into smooth, organic farm curves.
 */
export function chaikinSmooth(
  points: [number, number][],
  iterations: number = 2
): [number, number][] {
  if (points.length < 3) return points

  let current = points
  for (let it = 0; it < iterations; it++) {
    const next: [number, number][] = []
    const len = current.length
    for (let i = 0; i < len; i++) {
      const p0 = current[i]
      const p1 = current[(i + 1) % len]

      const q: [number, number] = [
        0.75 * p0[0] + 0.25 * p1[0],
        0.75 * p0[1] + 0.25 * p1[1],
      ]
      const r: [number, number] = [
        0.25 * p0[0] + 0.75 * p1[0],
        0.25 * p0[1] + 0.75 * p1[1],
      ]

      next.push(q, r)
    }
    current = next
  }

  return current
}

/**
 * Perpendicular distance between point p and line segment (p1, p2)
 */
function perpendicularDistance(
  p: [number, number],
  p1: [number, number],
  p2: [number, number]
): number {
  const [x, y] = p
  const [x1, y1] = p1
  const [x2, y2] = p2

  const dx = x2 - x1
  const dy = y2 - y1

  if (dx === 0 && dy === 0) {
    return Math.hypot(x - x1, y - y1)
  }

  const num = Math.abs(dy * x - dx * y + x2 * y1 - y2 * x1)
  const den = Math.hypot(dx, dy)
  return num / den
}

/**
 * Ramer-Douglas-Peucker algorithm to simplify freehand drawn lines and remove jitter.
 */
export function simplifyPoints(
  points: [number, number][],
  epsilon: number = 0.00004
): [number, number][] {
  if (points.length <= 2) return points

  let maxDist = 0
  let index = 0

  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i], points[0], points[points.length - 1])
    if (d > maxDist) {
      maxDist = d
      index = i
    }
  }

  if (maxDist > epsilon) {
    const left = simplifyPoints(points.slice(0, index + 1), epsilon)
    const right = simplifyPoints(points.slice(index), epsilon)
    return left.slice(0, left.length - 1).concat(right)
  } else {
    return [points[0], points[points.length - 1]]
  }
}
