import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  MapContainer,
  TileLayer,
  Marker,
  Polygon,
  Polyline,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import L from 'leaflet'
import {
  MapPin,
  Pencil,
  Spline,
  RotateCcw,
  Trash2,
  CheckCircle2,
  Square,
  Sparkles,
  Info,
  Maximize2,
} from 'lucide-react'
import LeafletDrawControl from './LeafletDrawControl'
import {
  interpolateClosedSpline,
  chaikinSmooth,
  simplifyPoints,
  calculatePolygonAreaHectares,
  formatArea,
} from '../utils/geoUtils'

export type DrawingMode = 'points' | 'freehand' | 'standard'

interface FieldMapDrawerProps {
  initialCenter?: [number, number]
  initialZoom?: number
  onPolygonChange: (coordinates: [number, number][]) => void
  onAreaChange?: (hectares: number) => void
}

function MapRecenter({ center, zoom }: { center?: [number, number]; zoom?: number }) {
  const map = useMap()
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.setView(center, zoom || 14, { animate: true })
    }
  }, [center, zoom, map])
  return null
}

// Custom DivIcon for numbered, draggable vertex markers
const createNumberedMarkerIcon = (num: number, isFirst: boolean = false) => {
  const bg = isFirst ? '#4ade80' : '#22c55e'
  const ring = isFirst ? '#f0fdf4' : '#ffffff'
  return L.divIcon({
    className: 'agri-vertex-marker',
    html: `
      <div style="
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: ${bg};
        color: #0a0f0d;
        border: 2.5px solid ${ring};
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        font-size: 12px;
        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.5), 0 0 12px rgba(34, 197, 94, 0.4);
        cursor: grab;
        user-select: none;
        transition: transform 0.15s ease;
      ">
        ${num}
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

// Sub-component inside MapContainer to handle Point-by-Point clicks and dragging
function PointClickHandler({
  mode,
  onAddPoint,
}: {
  mode: DrawingMode
  onAddPoint: (latlng: [number, number]) => void
}) {
  useMapEvents({
    click(e) {
      if (mode === 'points') {
        onAddPoint([e.latlng.lat, e.latlng.lng])
      }
    },
  })
  return null
}

// Sub-component inside MapContainer to handle Freehand Manual Drawing
function FreehandDrawHandler({
  mode,
  onDrawingComplete,
  isDrawing,
  setIsDrawing,
  rawPath,
  setRawPath,
}: {
  mode: DrawingMode
  onDrawingComplete: (path: [number, number][]) => void
  isDrawing: boolean
  setIsDrawing: (val: boolean) => void
  rawPath: [number, number][]
  setRawPath: React.Dispatch<React.SetStateAction<[number, number][]>>
}) {
  const map = useMap()
  const drawingRef = useRef(false)

  useEffect(() => {
    if (mode !== 'freehand') {
      map.dragging.enable()
      drawingRef.current = false
      setIsDrawing(false)
      return
    }

    const container = map.getContainer()

    const handlePointerDown = (e: PointerEvent) => {
      // Ignore right clicks or secondary buttons
      if (e.button !== 0) return
      drawingRef.current = true
      setIsDrawing(true)
      map.dragging.disable()

      const latlng = map.mouseEventToLatLng(e as unknown as MouseEvent)
      setRawPath([[latlng.lat, latlng.lng]])
    }

    const handlePointerMove = (e: PointerEvent) => {
      if (!drawingRef.current) return
      const latlng = map.mouseEventToLatLng(e as unknown as MouseEvent)
      setRawPath((prev) => {
        const last = prev[prev.length - 1]
        if (last) {
          // Sample threshold to avoid duplicate micro points
          const dist = Math.hypot(latlng.lat - last[0], latlng.lng - last[1])
          if (dist < 0.00002) return prev
        }
        return [...prev, [latlng.lat, latlng.lng]]
      })
    }

    const handlePointerUp = () => {
      if (!drawingRef.current) return
      drawingRef.current = false
      setIsDrawing(false)
      map.dragging.enable()

      setRawPath((currentPath) => {
        if (currentPath.length >= 3) {
          onDrawingComplete(currentPath)
        }
        return currentPath
      })
    }

    container.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      container.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      map.dragging.enable()
    }
  }, [mode, map, onDrawingComplete, setIsDrawing, setRawPath])

  return null
}

export default function FieldMapDrawer({
  initialCenter = [20.0, 74.0],
  initialZoom = 13,
  onPolygonChange,
  onAreaChange,
}: FieldMapDrawerProps) {
  const [mode, setMode] = useState<DrawingMode>('points')
  const [tileLayer, setTileLayer] = useState<'streets' | 'satellite' | 'terrain'>('satellite')

  // Point-by-point state
  const [markedPoints, setMarkedPoints] = useState<[number, number][]>([])
  const [isCurved, setIsCurved] = useState<boolean>(true)
  const [curvature, setCurvature] = useState<number>(0.5) // 0 (straight) to 1 (full spline)

  // Freehand state
  const [isDrawing, setIsDrawing] = useState<boolean>(false)
  const [freehandPoints, setFreehandPoints] = useState<[number, number][]>([])
  const [autoSmoothFreehand, setAutoSmoothFreehand] = useState<boolean>(true)

  // Active polygon coordinates in [lng, lat] format for GeoJSON / backend
  const [activeGeoJsonCoords, setActiveGeoJsonCoords] = useState<[number, number][]>([])
  const [activeAreaHa, setActiveAreaHa] = useState<number>(0)

  // Recalculate Point-by-Point boundary whenever points, curvature, or curve toggle changes
  useEffect(() => {
    if (mode !== 'points') return

    if (markedPoints.length < 3) {
      setActiveGeoJsonCoords([])
      setActiveAreaHa(0)
      onPolygonChange([])
      if (onAreaChange) onAreaChange(0)
      return
    }

    // Generate path (curved spline or straight)
    let displayPath: [number, number][]
    if (isCurved) {
      displayPath = interpolateClosedSpline(markedPoints, curvature, 12)
    } else {
      displayPath = [...markedPoints]
    }

    // Convert [lat, lng] to [lng, lat] for GeoJSON
    const geoJson: [number, number][] = displayPath.map(([lat, lng]) => [lng, lat])
    // Close the ring
    if (
      geoJson.length > 0 &&
      (geoJson[0][0] !== geoJson[geoJson.length - 1][0] ||
        geoJson[0][1] !== geoJson[geoJson.length - 1][1])
    ) {
      geoJson.push([...geoJson[0]])
    }

    const ha = calculatePolygonAreaHectares(geoJson)
    setActiveGeoJsonCoords(geoJson)
    setActiveAreaHa(ha)
    onPolygonChange(geoJson)
    if (onAreaChange) onAreaChange(ha)
  }, [mode, markedPoints, isCurved, curvature, onPolygonChange, onAreaChange])

  // Handle Freehand drawing completion
  const handleFreehandComplete = useCallback(
    (rawPath: [number, number][]) => {
      if (rawPath.length < 3) return

      // Simplify micro jitter
      let clean = simplifyPoints(rawPath, 0.00004)

      // Apply Chaikin smoothing if enabled
      if (autoSmoothFreehand) {
        clean = chaikinSmooth(clean, 2)
      }

      setFreehandPoints(clean)

      // Convert to GeoJSON [lng, lat]
      const geoJson: [number, number][] = clean.map(([lat, lng]) => [lng, lat])
      if (
        geoJson.length > 0 &&
        (geoJson[0][0] !== geoJson[geoJson.length - 1][0] ||
          geoJson[0][1] !== geoJson[geoJson.length - 1][1])
      ) {
        geoJson.push([...geoJson[0]])
      }

      const ha = calculatePolygonAreaHectares(geoJson)
      setActiveGeoJsonCoords(geoJson)
      setActiveAreaHa(ha)
      onPolygonChange(geoJson)
      if (onAreaChange) onAreaChange(ha)
    },
    [autoSmoothFreehand, onPolygonChange, onAreaChange]
  )

  // Handle Standard Leaflet.Draw created event
  const handleStandardCreated = (e: any) => {
    const layer = e.layer
    const latlngs = layer.getLatLngs()[0]
    const coords: [number, number][] = latlngs.map((ll: any) => [ll.lng, ll.lat])
    coords.push([...coords[0]])

    const ha = calculatePolygonAreaHectares(coords)
    setActiveGeoJsonCoords(coords)
    setActiveAreaHa(ha)
    onPolygonChange(coords)
    if (onAreaChange) onAreaChange(ha)
  }

  // Adding a new point in Point-by-Point mode
  const handleAddPoint = (latlng: [number, number]) => {
    setMarkedPoints((prev) => [...prev, latlng])
  }

  // Dragging an existing point
  const handleMarkerDrag = (index: number, newLatLng: L.LatLng) => {
    setMarkedPoints((prev) => {
      const updated = [...prev]
      updated[index] = [newLatLng.lat, newLatLng.lng]
      return updated
    })
  }

  // Remove last point
  const handleUndoPoint = () => {
    setMarkedPoints((prev) => prev.slice(0, -1))
  }

  // Clear all points in current mode
  const handleClear = () => {
    if (mode === 'points') {
      setMarkedPoints([])
    } else if (mode === 'freehand') {
      setFreehandPoints([])
    }
    setActiveGeoJsonCoords([])
    setActiveAreaHa(0)
    onPolygonChange([])
    if (onAreaChange) onAreaChange(0)
  }

  // Display coordinates for polygon rendering
  const pointDisplayCoordinates: [number, number][] = React.useMemo(() => {
    if (markedPoints.length < 3) return markedPoints
    if (isCurved) {
      return interpolateClosedSpline(markedPoints, curvature, 12)
    }
    return markedPoints
  }, [markedPoints, isCurved, curvature])

  return (
    <div className="field-map-drawer-container">
      {/* ── Mode Selection Toolbar ── */}
      <div
        className="map-toolbar flex items-center justify-between"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '0.625rem 1rem',
          marginBottom: '0.75rem',
          flexWrap: 'wrap',
          gap: '0.75rem',
        }}
      >
        <div className="flex items-center gap-2">
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Draw Tool:
          </span>

          <button
            type="button"
            className={`btn btn-sm ${mode === 'points' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => {
              setMode('points')
            }}
            title="Mark multiple points and curve lines"
            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
          >
            <MapPin size={15} />
            <span>Mark Points</span>
          </button>

          <button
            type="button"
            className={`btn btn-sm ${mode === 'freehand' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => {
              setMode('freehand')
            }}
            title="Draw your field boundary manually by dragging"
            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
          >
            <Pencil size={15} />
            <span>Draw Manually</span>
          </button>

          <button
            type="button"
            className={`btn btn-sm ${mode === 'standard' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => {
              setMode('standard')
            }}
            title="Standard Leaflet Draw Polygon Tool"
            style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}
          >
            <Square size={15} />
            <span>Standard Tool</span>
          </button>
        </div>

        {/* ── Tile Layer Switcher (Satellite / Roads / Terrain) ── */}
        <div className="flex items-center gap-1.5" style={{ background: 'var(--bg-base)', padding: '3px 6px', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginRight: '4px' }}>Layer:</span>
          <button
            type="button"
            className={`btn btn-xs ${tileLayer === 'satellite' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTileLayer('satellite')}
            style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
          >
            🛰️ Satellite
          </button>
          <button
            type="button"
            className={`btn btn-xs ${tileLayer === 'streets' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTileLayer('streets')}
            style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
          >
            🛣️ Roads/OSM
          </button>
          <button
            type="button"
            className={`btn btn-xs ${tileLayer === 'terrain' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTileLayer('terrain')}
            style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
          >
            ⛰️ Topo
          </button>
        </div>

        {/* ── Live Boundary Stats ── */}
        <div className="flex items-center gap-3">
          {activeAreaHa > 0 ? (
            <div
              className="badge badge-green"
              style={{
                fontSize: '0.82rem',
                padding: '0.35rem 0.75rem',
                borderRadius: '8px',
                border: '1px solid rgba(34,197,94,0.3)',
                boxShadow: '0 0 10px rgba(34,197,94,0.15)',
              }}
            >
              <CheckCircle2 size={14} style={{ marginRight: '0.25rem' }} />
              <strong>Area:</strong>&nbsp;{formatArea(activeAreaHa)}
            </div>
          ) : (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              No boundary completed yet
            </span>
          )}

          {(markedPoints.length > 0 || freehandPoints.length > 0) && (
            <button
              type="button"
              className="btn btn-sm btn-ghost text-muted"
              onClick={handleClear}
              title="Clear all points"
              style={{ padding: '0.3rem 0.6rem', color: 'var(--color-danger)' }}
            >
              <Trash2 size={14} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Mode Specific Secondary Controls & Options ── */}
      {mode === 'points' && (
        <div
          className="fade-in flex items-center justify-between"
          style={{
            background: 'rgba(22, 32, 25, 0.75)',
            border: '1px solid var(--border-active)',
            borderRadius: 'var(--radius)',
            padding: '0.625rem 1rem',
            marginBottom: '0.75rem',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          {/* Curve Options Toggle */}
          <div className="flex items-center gap-3">
            <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Spline size={16} style={{ color: 'var(--color-primary)' }} />
              Line Style:
            </span>

            <div
              style={{
                display: 'inline-flex',
                background: 'var(--bg-base)',
                padding: '2px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
              }}
            >
              <button
                type="button"
                style={{
                  padding: '0.25rem 0.65rem',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  background: isCurved ? 'var(--color-primary)' : 'transparent',
                  color: isCurved ? '#0a0f0d' : 'var(--text-muted)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
                onClick={() => setIsCurved(true)}
              >
                〰️ Curved
              </button>

              <button
                type="button"
                style={{
                  padding: '0.25rem 0.65rem',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  borderRadius: '6px',
                  background: !isCurved ? 'var(--color-primary)' : 'transparent',
                  color: !isCurved ? '#0a0f0d' : 'var(--text-muted)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
                onClick={() => setIsCurved(false)}
              >
                📐 Straight
              </button>
            </div>

            {isCurved && (
              <div className="flex items-center gap-2" style={{ marginLeft: '0.5rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Curve Smoothness:
                </span>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={curvature}
                  onChange={(e) => setCurvature(parseFloat(e.target.value))}
                  style={{
                    width: '90px',
                    accentColor: 'var(--color-primary)',
                    cursor: 'pointer',
                  }}
                  title={`Smoothness: ${(curvature * 100).toFixed(0)}%`}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--color-primary)', fontWeight: 600 }}>
                  {(curvature * 100).toFixed(0)}%
                </span>
              </div>
            )}
          </div>

          {/* Point Actions */}
          <div className="flex items-center gap-2">
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Points marked: <strong>{markedPoints.length}</strong>
              {markedPoints.length < 3 && ' (need at least 3 to close)'}
            </span>

            {markedPoints.length > 0 && (
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={handleUndoPoint}
                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.25rem 0.5rem' }}
                title="Undo last placed point"
              >
                <RotateCcw size={13} /> Undo Point
              </button>
            )}
          </div>
        </div>
      )}

      {mode === 'freehand' && (
        <div
          className="fade-in flex items-center justify-between"
          style={{
            background: 'rgba(22, 32, 25, 0.75)',
            border: '1px solid var(--border-active)',
            borderRadius: 'var(--radius)',
            padding: '0.625rem 1rem',
            marginBottom: '0.75rem',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div className="flex items-center gap-2">
            <Sparkles size={16} style={{ color: 'var(--color-primary)' }} />
            <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)' }}>
              <strong>Draw Manually:</strong> Press and drag your mouse/touch to trace the field boundary. Releasing automatically closes the field.
            </span>
          </div>

          <div className="flex items-center gap-3">
            <label
              className="flex items-center gap-1.5"
              style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}
            >
              <input
                type="checkbox"
                checked={autoSmoothFreehand}
                onChange={(e) => {
                  setAutoSmoothFreehand(e.target.checked)
                  if (freehandPoints.length >= 3) {
                    handleFreehandComplete(freehandPoints)
                  }
                }}
                style={{ accentColor: 'var(--color-primary)' }}
              />
              Auto-smooth contour
            </label>

            {freehandPoints.length > 0 && (
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => setFreehandPoints([])}
                style={{ padding: '0.25rem 0.6rem' }}
              >
                <RotateCcw size={13} /> Redraw
              </button>
            )}
          </div>
        </div>
      )}

      {mode === 'standard' && (
        <div
          className="fade-in flex items-center gap-2"
          style={{
            background: 'rgba(22, 32, 25, 0.75)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: '0.625rem 1rem',
            marginBottom: '0.75rem',
            fontSize: '0.82rem',
            color: 'var(--text-secondary)',
          }}
        >
          <Info size={15} style={{ color: 'var(--color-primary)' }} />
          <span>Click the polygon icon on the top-left map toolbar to draw polygon vertices. Double-click to finish.</span>
        </div>
      )}

      {/* ── Interactive Leaflet Map ── */}
      <div
        className="map-canvas-wrapper relative"
        style={{
          height: '520px',
          borderRadius: 'var(--radius)',
          overflow: 'hidden',
          border: '1.5px solid var(--border-active)',
          boxShadow: 'var(--shadow-md)',
          cursor: mode === 'freehand' ? 'crosshair' : mode === 'points' ? 'cell' : 'grab',
        }}
      >
        <MapContainer
          center={initialCenter}
          zoom={initialZoom}
          style={{ height: '100%', width: '100%' }}
        >
          <MapRecenter center={initialCenter} zoom={initialZoom} />
          {tileLayer === 'satellite' && (
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics"
              maxZoom={19}
            />
          )}
          {tileLayer === 'streets' && (
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              maxZoom={19}
            />
          )}
          {tileLayer === 'terrain' && (
            <TileLayer
              url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://opentopomap.org">OpenTopoMap</a> (&copy; OSM contributors)'
              maxZoom={17}
            />
          )}

          {/* Mode 1: Point-by-Point Interaction */}
          <PointClickHandler mode={mode} onAddPoint={handleAddPoint} />

          {mode === 'points' && (
            <>
              {/* Draggable Numbered Vertex Markers */}
              {markedPoints.map((pt, idx) => (
                <Marker
                  key={`marker-${idx}`}
                  position={pt}
                  icon={createNumberedMarkerIcon(idx + 1, idx === 0)}
                  draggable={true}
                  eventHandlers={{
                    dragend: (e) => {
                      const marker = e.target
                      const newPos = marker.getLatLng()
                      handleMarkerDrag(idx, newPos)
                    },
                  }}
                />
              ))}

              {/* Polyline preview if fewer than 3 points */}
              {markedPoints.length === 2 && (
                <Polyline
                  positions={markedPoints}
                  pathOptions={{
                    color: '#22c55e',
                    weight: 3,
                    dashArray: '6, 6',
                    opacity: 0.8,
                  }}
                />
              )}

              {/* Closed Polygon if 3 or more points */}
              {markedPoints.length >= 3 && (
                <Polygon
                  positions={pointDisplayCoordinates}
                  pathOptions={{
                    color: '#22c55e',
                    fillColor: '#22c55e',
                    fillOpacity: 0.25,
                    weight: 3,
                  }}
                />
              )}
            </>
          )}

          {/* Mode 2: Freehand Manual Drawing Interaction */}
          <FreehandDrawHandler
            mode={mode}
            onDrawingComplete={handleFreehandComplete}
            isDrawing={isDrawing}
            setIsDrawing={setIsDrawing}
            rawPath={freehandPoints}
            setRawPath={setFreehandPoints}
          />

          {mode === 'freehand' && (
            <>
              {freehandPoints.length >= 3 && !isDrawing ? (
                <Polygon
                  positions={freehandPoints}
                  pathOptions={{
                    color: '#22c55e',
                    fillColor: '#22c55e',
                    fillOpacity: 0.28,
                    weight: 3,
                  }}
                />
              ) : freehandPoints.length >= 2 ? (
                <Polyline
                  positions={freehandPoints}
                  pathOptions={{
                    color: '#4ade80',
                    weight: 4,
                    opacity: 0.9,
                  }}
                />
              ) : null}
            </>
          )}

          {/* Mode 3: Standard Leaflet Draw Tool */}
          {mode === 'standard' && <LeafletDrawControl onCreated={handleStandardCreated} />}
        </MapContainer>

        {/* Live Helper Overlay inside the Map */}
        <div
          style={{
            position: 'absolute',
            bottom: '12px',
            left: '12px',
            background: 'rgba(10, 15, 13, 0.85)',
            backdropFilter: 'blur(8px)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '0.4rem 0.75rem',
            fontSize: '0.75rem',
            color: 'var(--text-secondary)',
            zIndex: 1000,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          {mode === 'points' && (
            <span>
              📍 <strong>Click map</strong> to add points. <strong>Drag numbers</strong> to adjust.
              {isCurved ? ' 〰️ Smooth curves enabled.' : ' 📐 Straight lines enabled.'}
            </span>
          )}
          {mode === 'freehand' && (
            <span>
              ✏️ <strong>Hold mouse/finger & drag</strong> to draw contour.
              {isDrawing ? ' Drawing in progress…' : ' Release to complete.'}
            </span>
          )}
          {mode === 'standard' && (
            <span>🔷 Click the polygon icon on the left to draw.</span>
          )}
        </div>
      </div>
    </div>
  )
}
