import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// ── Geo utility functions (ported from AgriIQ geoUtils) ─────────────────────

/**
 * Catmull-Rom closed spline interpolation for polygon vertices.
 * Points in [lat, lng] format.
 */
function interpolateClosedSpline(points, curvature = 0.5, samplesPerSeg = 12) {
  if (points.length < 3) return points
  if (curvature <= 0.01) return points
  const N = points.length
  const result = []
  const tension = 0.5
  for (let i = 0; i < N; i++) {
    const pPrev  = points[(i - 1 + N) % N]
    const pCurr  = points[i]
    const pNext  = points[(i + 1) % N]
    const pNext2 = points[(i + 2) % N]
    const m1 = [
      (1 - tension) * (pNext.lat  - pPrev.lat)  * 0.5,
      (1 - tension) * (pNext.lng  - pPrev.lng)  * 0.5,
    ]
    const m2 = [
      (1 - tension) * (pNext2.lat - pCurr.lat)  * 0.5,
      (1 - tension) * (pNext2.lng - pCurr.lng)  * 0.5,
    ]
    for (let s = 0; s < samplesPerSeg; s++) {
      const t = s / samplesPerSeg
      const t2 = t * t, t3 = t2 * t
      const h00 = 2*t3 - 3*t2 + 1, h10 = t3 - 2*t2 + t
      const h01 = -2*t3 + 3*t2,    h11 = t3 - t2
      const sLat = h00*pCurr.lat + h10*m1[0] + h01*pNext.lat + h11*m2[0]
      const sLng = h00*pCurr.lng + h10*m1[1] + h01*pNext.lng + h11*m2[1]
      const lLat = (1-t)*pCurr.lat + t*pNext.lat
      const lLng = (1-t)*pCurr.lng + t*pNext.lng
      result.push({ lat: (1-curvature)*lLat + curvature*sLat, lng: (1-curvature)*lLng + curvature*sLng })
    }
  }
  return result
}

/** Chaikin corner-cutting algorithm for smoothing freehand strokes */
function chaikinSmooth(points, iterations = 2) {
  if (points.length < 3) return points
  let current = points
  for (let it = 0; it < iterations; it++) {
    const next = []
    const len = current.length
    for (let i = 0; i < len; i++) {
      const p0 = current[i], p1 = current[(i + 1) % len]
      next.push({ lat: 0.75*p0.lat + 0.25*p1.lat, lng: 0.75*p0.lng + 0.25*p1.lng })
      next.push({ lat: 0.25*p0.lat + 0.75*p1.lat, lng: 0.25*p0.lng + 0.75*p1.lng })
    }
    current = next
  }
  return current
}

/** Ramer-Douglas-Peucker simplification */
function rdpSimplify(points, epsilon) {
  if (points.length <= 2) return points
  const first = points[0], last = points[points.length - 1]
  let maxDist = 0, maxIdx = 0
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i]
    const dx = last.lng - first.lng, dy = last.lat - first.lat
    const len = Math.sqrt(dx*dx + dy*dy) || 1e-10
    const dist = Math.abs((p.lat - first.lat)*dx - (p.lng - first.lng)*dy) / len
    if (dist > maxDist) { maxDist = dist; maxIdx = i }
  }
  if (maxDist > epsilon) {
    const left  = rdpSimplify(points.slice(0, maxIdx + 1), epsilon)
    const right = rdpSimplify(points.slice(maxIdx), epsilon)
    return [...left.slice(0, -1), ...right]
  }
  return [first, last]
}

/** Geodesic polygon area in m² */
function computePolygonArea(points) {
  if (!points || points.length < 3) return 0
  const R = 6378137
  let area = 0
  const len = points.length
  for (let i = 0; i < len; i++) {
    const p1 = points[i]
    const p2 = points[(i + 1) % len]
    const p0 = points[(i - 1 + len) % len]
    area += ((p2.lng - p0.lng) * Math.PI / 180) * Math.sin(p1.lat * Math.PI / 180)
  }
  return Math.abs((area * R * R) / 2.0)
}

function computePerimeter(points) {
  if (!points || points.length < 2) return 0
  let p = 0
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length]
    const dlat = (b.lat - a.lat) * Math.PI / 180
    const dlng = (b.lng - a.lng) * Math.PI / 180
    const x = Math.sin(dlat/2), y = Math.sin(dlng/2)
    const c = Math.sqrt(x*x + Math.cos(a.lat*Math.PI/180)*Math.cos(b.lat*Math.PI/180)*y*y)
    p += 2 * 6378137 * Math.asin(c)
  }
  return p
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function FieldDrawMap({ onLandDrawn, initialLat, initialLon }) {
  const mapContainerRef = useRef(null)
  const mapInstanceRef  = useRef(null)
  const polygonLayerRef = useRef(null)
  const previewLineRef  = useRef(null)
  const markersGroupRef = useRef(null)
  const baseLayersRef   = useRef({})
  const pencilPointsRef = useRef([])
  const isDraggingRef   = useRef(false)
  const rectStartRef    = useRef(null)
  const rectLayerRef    = useRef(null)

  const [drawMode, setDrawMode]       = useState('click')   // 'click' | 'freehand' | 'rect'
  const [points, setPoints]           = useState([])
  const [freehandPts, setFreehandPts] = useState([])        // smoothed freehand
  const [mapType, setMapType]         = useState('satellite')
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching]     = useState(false)
  const [searchError, setSearchError] = useState(null)
  const [isCurved, setIsCurved]       = useState(true)
  const [curvature, setCurvature]     = useState(0.6)
  const [autoSmooth, setAutoSmooth]   = useState(true)
  const [history, setHistory]         = useState([])
  const [selectedPoint, setSelectedPoint] = useState(null)
  const [isDrawingFreehand, setIsDrawingFreehand] = useState(false)
  const [areaStats, setAreaStats] = useState({ sqMeters: 0, acres: 0, hectares: 0, perimeterMeters: 0 })

  // ── Derived display path (with spline) ──────────────────────────────────────
  const displayPoints = useMemo(() => {
    if (drawMode !== 'click') return points
    if (points.length < 3 || !isCurved) return points
    return interpolateClosedSpline(points, curvature, 12)
  }, [points, drawMode, isCurved, curvature])

  const activePts = drawMode === 'freehand' ? freehandPts : displayPoints

  // ── Map init ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return
    const lat = initialLat ? parseFloat(initialLat) : 20.5937
    const lon = initialLon ? parseFloat(initialLon) : 78.9629
    const zoom = initialLat && initialLon ? 16 : 5

    const map = L.map(mapContainerRef.current, { center: [lat, lon], zoom, zoomControl: false })
    L.control.zoom({ position: 'topright' }).addTo(map)

    const street = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 21, attribution: '© OSM' })
    const sat    = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 21, attribution: '© Esri' })
    sat.addTo(map)
    baseLayersRef.current = { street, satellite: sat }

    markersGroupRef.current = L.layerGroup().addTo(map)
    polygonLayerRef.current = L.polygon([], {
      color: '#4ade80', weight: 2.5, fillColor: '#4ade80', fillOpacity: 0.2, dashArray: '6, 8'
    }).addTo(map)
    previewLineRef.current = L.polyline([], { color: '#fbbf24', weight: 2.5, dashArray: '4, 4' }).addTo(map)
    rectLayerRef.current   = L.rectangle([[0,0],[0,0]], { color: '#a78bfa', weight: 2, fillOpacity: 0.15 }).addTo(map)

    mapInstanceRef.current = map
    return () => { map.remove(); mapInstanceRef.current = null }
  }, [])

  // ── Wire map events by mode ─────────────────────────────────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return
    map.off('click'); map.off('mousedown'); map.off('mousemove'); map.off('mouseup')

    const container = map.getContainer()
    container.style.cursor = drawMode === 'freehand' ? 'crosshair' : drawMode === 'rect' ? 'crosshair' : 'cell'

    if (drawMode === 'click') {
      map.dragging.enable()
      map.on('click', (e) => {
        const pt = { lat: parseFloat(e.latlng.lat.toFixed(6)), lng: parseFloat(e.latlng.lng.toFixed(6)) }
        setPoints(prev => { setHistory(h => [...h, { mode: 'click', pts: prev, fh: freehandPts }]); return [...prev, pt] })
        setSelectedPoint(null)
      })

    } else if (drawMode === 'freehand') {
      map.dragging.disable()
      const onDown = (e) => {
        if (e.button !== 0) return
        isDraggingRef.current = true
        setIsDrawingFreehand(true)
        const ll = map.mouseEventToLatLng(e)
        pencilPointsRef.current = [{ lat: ll.lat, lng: ll.lng }]
        previewLineRef.current.setLatLngs([[ll.lat, ll.lng]])
      }
      const onMove = (e) => {
        if (!isDraggingRef.current) return
        const ll = map.mouseEventToLatLng(e)
        const last = pencilPointsRef.current[pencilPointsRef.current.length - 1]
        if (last && Math.hypot(ll.lat - last.lat, ll.lng - last.lng) < 0.00002) return
        pencilPointsRef.current.push({ lat: ll.lat, lng: ll.lng })
        previewLineRef.current.setLatLngs(pencilPointsRef.current.map(p => [p.lat, p.lng]))
      }
      const onUp = () => {
        if (!isDraggingRef.current) return
        isDraggingRef.current = false
        setIsDrawingFreehand(false)
        const raw = pencilPointsRef.current
        if (raw.length < 3) return
        previewLineRef.current.setLatLngs([])
        let clean = rdpSimplify(raw, 0.00004)
        if (autoSmooth) clean = chaikinSmooth(clean, 2)
        setHistory(h => [...h, { mode: 'freehand', pts: points, fh: freehandPts }])
        setFreehandPts(clean.map(p => ({ lat: parseFloat(p.lat.toFixed(6)), lng: parseFloat(p.lng.toFixed(6)) })))
        pencilPointsRef.current = []
      }
      container.addEventListener('pointerdown', onDown)
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      return () => {
        container.removeEventListener('pointerdown', onDown)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        map.dragging.enable()
      }

    } else if (drawMode === 'rect') {
      map.dragging.disable()
      const onDown = (e) => {
        if (e.button !== 0) return
        isDraggingRef.current = true
        const ll = map.mouseEventToLatLng(e)
        rectStartRef.current = { lat: ll.lat, lng: ll.lng }
      }
      const onMove = (e) => {
        if (!isDraggingRef.current || !rectStartRef.current) return
        const ll = map.mouseEventToLatLng(e)
        const { lat: lat1, lng: lng1 } = rectStartRef.current
        rectLayerRef.current.setBounds([[lat1, lng1], [ll.lat, ll.lng]])
      }
      const onUp = (e) => {
        if (!isDraggingRef.current || !rectStartRef.current) return
        isDraggingRef.current = false
        const ll = map.mouseEventToLatLng(e)
        const { lat: lat1, lng: lng1 } = rectStartRef.current
        const lat2 = ll.lat, lng2 = ll.lng
        const rectPts = [
          { lat: lat1, lng: lng1 }, { lat: lat1, lng: lng2 },
          { lat: lat2, lng: lng2 }, { lat: lat2, lng: lng1 }
        ]
        setHistory(h => [...h, { mode: 'click', pts: points, fh: freehandPts }])
        setPoints(rectPts.map(p => ({ lat: parseFloat(p.lat.toFixed(6)), lng: parseFloat(p.lng.toFixed(6)) })))
        setDrawMode('click')
        rectStartRef.current = null
        map.dragging.enable()
      }
      container.addEventListener('pointerdown', onDown)
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
      return () => {
        container.removeEventListener('pointerdown', onDown)
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        map.dragging.enable()
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawMode, autoSmooth])

  // ── Update polygon + markers on points/freehand change ──────────────────────
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    const poly  = polygonLayerRef.current
    const marks = markersGroupRef.current

    const displayPts = activePts
    poly.setLatLngs(displayPts.map(p => [p.lat, p.lng]))

    // Only render numbered markers for click-mode raw points
    marks.clearLayers()
    if (drawMode === 'click') {
      points.forEach((p, idx) => {
        const isSel = selectedPoint === idx
        const icon = L.divIcon({
          className: '',
          html: `<div style="
            background:${isSel ? '#fbbf24' : (idx === 0 ? '#4ade80' : '#22c55e')};
            color:#050; width:${isSel ? 28 : 22}px; height:${isSel ? 28 : 22}px;
            border-radius:50%; display:flex; align-items:center; justify-content:center;
            font-size:10px; font-weight:900; border:2.5px solid #fff;
            box-shadow:0 3px 10px rgba(0,0,0,0.5), 0 0 12px rgba(74,222,128,0.4);
            cursor:grab;
          ">${idx + 1}</div>`,
          iconSize: [28, 28], iconAnchor: [14, 14],
        })
        const marker = L.marker([p.lat, p.lng], { icon, draggable: true })
        marker.on('click', () => setSelectedPoint(i => i === idx ? null : idx))
        marker.on('drag', (ev) => {
          const { lat, lng } = ev.latlng
          setPoints(prev => {
            const next = [...prev]
            next[idx] = { lat: parseFloat(lat.toFixed(6)), lng: parseFloat(lng.toFixed(6)) }
            return next
          })
        })
        marker.addTo(marks)
      })
    }

    // Area stats
    const ptsForArea = drawMode === 'freehand' ? freehandPts : points
    if (ptsForArea.length >= 3) {
      const sq  = computePolygonArea(ptsForArea)
      setAreaStats({
        sqMeters: Math.round(sq),
        acres: parseFloat((sq / 4046.856).toFixed(2)),
        hectares: parseFloat((sq / 10000).toFixed(2)),
        perimeterMeters: Math.round(computePerimeter(ptsForArea)),
      })
    } else {
      setAreaStats({ sqMeters: 0, acres: 0, hectares: 0, perimeterMeters: 0 })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, freehandPts, drawMode, selectedPoint, displayPoints, isCurved, curvature])

  // ── Map layer toggle ─────────────────────────────────────────────────────────
  const toggleLayer = (type) => {
    const map = mapInstanceRef.current; if (!map) return
    if (type === 'satellite') {
      map.removeLayer(baseLayersRef.current.street); baseLayersRef.current.satellite.addTo(map)
    } else {
      map.removeLayer(baseLayersRef.current.satellite); baseLayersRef.current.street.addTo(map)
    }
    setMapType(type)
  }

  // ── Locate me ───────────────────────────────────────────────────────────────
  const handleLocateMe = () => {
    navigator.geolocation?.getCurrentPosition(pos =>
      mapInstanceRef.current?.flyTo([pos.coords.latitude, pos.coords.longitude], 17, { animate: true, duration: 1.5 })
    )
  }

  // ── Search ───────────────────────────────────────────────────────────────────
  const handleSearch = async (e) => {
    e.preventDefault(); if (!searchQuery.trim()) return
    setSearching(true); setSearchError(null)
    try {
      const res  = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(searchQuery)}&count=1&language=en&format=json`)
      const data = await res.json()
      if (data.results?.length) {
        mapInstanceRef.current?.flyTo([data.results[0].latitude, data.results[0].longitude], 16, { animate: true, duration: 1.5 })
      } else setSearchError('Location not found.')
    } catch { setSearchError('Search failed. Check network.') }
    finally { setSearching(false) }
  }

  // ── Undo ─────────────────────────────────────────────────────────────────────
  const handleUndo = () => {
    if (!history.length) return
    const prev = history[history.length - 1]
    setHistory(h => h.slice(0, -1))
    if (prev.mode === 'click') setPoints(prev.pts)
    else setFreehandPts(prev.fh)
    setSelectedPoint(null)
  }

  // ── Clear ────────────────────────────────────────────────────────────────────
  const handleClear = () => {
    setHistory(h => [...h, { mode: drawMode, pts: points, fh: freehandPts }])
    setPoints([]); setFreehandPts([]); setSelectedPoint(null)
    previewLineRef.current?.setLatLngs([])
    rectLayerRef.current?.setBounds([[0,0],[0,0]])
  }

  // ── Delete selected point ────────────────────────────────────────────────────
  const handleDeleteSelected = () => {
    if (selectedPoint === null) return
    setHistory(h => [...h, { mode: 'click', pts: points, fh: freehandPts }])
    setPoints(prev => prev.filter((_, i) => i !== selectedPoint))
    setSelectedPoint(null)
  }

  // ── Centroid ─────────────────────────────────────────────────────────────────
  const getCentroid = useCallback(() => {
    const src = drawMode === 'freehand' ? freehandPts : points
    if (!src.length) return null
    return {
      lat: parseFloat((src.reduce((s, p) => s + p.lat, 0) / src.length).toFixed(5)),
      lon: parseFloat((src.reduce((s, p) => s + p.lng, 0) / src.length).toFixed(5)),
    }
  }, [points, freehandPts, drawMode])

  const hasPolygon = drawMode === 'freehand' ? freehandPts.length >= 3 : points.length >= 3

  // ── Apply ─────────────────────────────────────────────────────────────────────
  const handleApply = () => {
    const centroid = getCentroid(); if (!centroid) return
    onLandDrawn({ centroid, areaStats, points: drawMode === 'freehand' ? freehandPts : points })
  }

  return (
    <div className="field-drawer-container">

      {/* ── Search bar ── */}
      <div className="field-drawer-bar">
        <form onSubmit={handleSearch} className="field-drawer-search">
          <span className="field-search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search village, district, city..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="field-search-input"
          />
          <button type="submit" className="field-btn-search" disabled={searching}>
            {searching ? '...' : 'Go'}
          </button>
        </form>
        <div className="field-drawer-actions">
          <button className="field-btn-sm" onClick={handleLocateMe} title="My GPS Location">📍</button>
          <button
            className={`field-btn-sm ${mapType === 'satellite' ? 'active' : ''}`}
            onClick={() => toggleLayer(mapType === 'street' ? 'satellite' : 'street')}
            title="Toggle satellite / roads"
          >
            🛰️
          </button>
        </div>
      </div>

      {/* ── Draw Mode Toolbar ── */}
      <div className="field-mode-bar">
        <div className="field-mode-group">
          <button
            className={`field-mode-btn ${drawMode === 'click' ? 'active' : ''}`}
            onClick={() => { setDrawMode('click'); rectLayerRef.current?.setBounds([[0,0],[0,0]]) }}
            title="Click to place corners"
          >
            📌 Mark Points
          </button>
          <button
            className={`field-mode-btn ${drawMode === 'freehand' ? 'active pencil' : ''}`}
            onClick={() => setDrawMode('freehand')}
            title="Draw freehand boundary"
          >
            ✏️ Draw Freehand
          </button>
          <button
            className={`field-mode-btn ${drawMode === 'rect' ? 'active rect' : ''}`}
            onClick={() => setDrawMode('rect')}
            title="Drag a rectangle boundary"
          >
            ⬜ Rectangle
          </button>
        </div>

        <div className="field-edit-group">
          <button className="field-btn-sm" onClick={handleUndo} disabled={!history.length} title="Undo">↩️ Undo</button>
          {selectedPoint !== null && (
            <button className="field-btn-sm danger" onClick={handleDeleteSelected} title="Delete point">
              🗑️ Del #{selectedPoint + 1}
            </button>
          )}
          <button className="field-btn-sm danger" onClick={handleClear} disabled={!points.length && !freehandPts.length} title="Clear">✕ Clear</button>
        </div>
      </div>

      {/* ── Mode-specific sub-controls ── */}
      {drawMode === 'click' && (
        <div className="field-sub-controls">
          <div className="field-curve-toggle">
            <span className="field-sub-label">Line Style:</span>
            <button
              className={`field-sub-btn ${isCurved ? 'active' : ''}`}
              onClick={() => setIsCurved(true)}
            >〰️ Smooth Curve</button>
            <button
              className={`field-sub-btn ${!isCurved ? 'active' : ''}`}
              onClick={() => setIsCurved(false)}
            >📐 Straight</button>
            {isCurved && (
              <div className="field-curve-slider">
                <span className="field-sub-label">Smoothness:</span>
                <input
                  type="range" min={0.1} max={1} step={0.05}
                  value={curvature}
                  onChange={e => setCurvature(parseFloat(e.target.value))}
                  className="field-curve-range"
                  title={`${(curvature * 100).toFixed(0)}%`}
                />
                <span className="field-curve-val">{(curvature * 100).toFixed(0)}%</span>
              </div>
            )}
          </div>
          <span className="field-pt-count">
            {points.length} point{points.length !== 1 ? 's' : ''}
            {points.length > 0 && points.length < 3 && ' · need 3 to close'}
          </span>
        </div>
      )}

      {drawMode === 'freehand' && (
        <div className="field-sub-controls">
          <div className="field-curve-toggle">
            <label className="field-smooth-toggle">
              <input
                type="checkbox"
                checked={autoSmooth}
                onChange={e => setAutoSmooth(e.target.checked)}
                style={{ accentColor: '#4ade80' }}
              />
              <span>✨ Auto-smooth contour (Chaikin)</span>
            </label>
            {freehandPts.length >= 3 && (
              <button
                className="field-sub-btn"
                onClick={() => { setFreehandPts([]); previewLineRef.current?.setLatLngs([]) }}
              >↩️ Redraw</button>
            )}
          </div>
          <span className="field-pt-count">
            {isDrawingFreehand ? '✏️ Drawing...' : freehandPts.length >= 3 ? `${freehandPts.length} pts captured` : 'Hold & drag to sketch'}
          </span>
        </div>
      )}

      {drawMode === 'rect' && (
        <div className="field-sub-controls">
          <span className="field-sub-label" style={{ color: '#a78bfa' }}>
            ⬜ Click and drag on the map to draw a rectangular field boundary. Release to confirm.
          </span>
        </div>
      )}

      {searchError && <div className="field-search-error">{searchError}</div>}

      {/* ── Map ── */}
      <div className="field-map-wrapper">
        <div ref={mapContainerRef} className="field-leaflet-map" />

        {/* Mode badge */}
        <div className={`field-mode-badge ${drawMode === 'freehand' ? 'pencil' : drawMode === 'rect' ? 'rect' : ''}`}>
          {drawMode === 'click'    && '📌 Click to place corners · Drag numbers to adjust'}
          {drawMode === 'freehand' && (isDrawingFreehand ? '✏️ Drawing...' : '✏️ Hold mouse/finger & drag to trace boundary')}
          {drawMode === 'rect'     && '⬜ Drag to define rectangular field'}
        </div>

        {hasPolygon && (
          <div className="field-point-count-badge">
            ✅ {areaStats.acres > 0 ? `${areaStats.acres} ac · ${areaStats.hectares} ha` : 'computing...'}
          </div>
        )}
      </div>

      {/* ── Stats & Apply ── */}
      <div className="field-stats-card">
        <div className="field-stat-item highlight">
          <span className="field-stat-label">Field Area</span>
          <span className="field-stat-value">{areaStats.acres > 0 ? `${areaStats.acres} ac` : '—'}</span>
          <span className="field-stat-sub">{areaStats.hectares > 0 ? `${areaStats.hectares} ha · ${areaStats.sqMeters.toLocaleString()} m²` : 'Need ≥ 3 points'}</span>
        </div>
        <div className="field-stat-item">
          <span className="field-stat-label">Perimeter</span>
          <span className="field-stat-value">{areaStats.perimeterMeters > 0 ? `${areaStats.perimeterMeters} m` : '—'}</span>
          <span className="field-stat-sub">Boundary length</span>
        </div>
        <div className="field-stat-item">
          <span className="field-stat-label">Centroid</span>
          <span className="field-stat-value" style={{ fontSize: '0.8rem' }}>
            {getCentroid() ? `${getCentroid().lat}, ${getCentroid().lon}` : '—'}
          </span>
          <span className="field-stat-sub">Weather anchor</span>
        </div>
        <button
          className="btn-apply-land"
          disabled={!hasPolygon}
          onClick={handleApply}
        >
          {!hasPolygon
            ? (drawMode === 'freehand' ? 'Draw your field boundary first' : `Place ${Math.max(0, 3 - points.length)} more point${points.length < 2 ? 's' : ''}`)
            : `🌱 Apply ${areaStats.acres} Acres & Fetch Analysis`}
        </button>
      </div>
    </div>
  )
}
