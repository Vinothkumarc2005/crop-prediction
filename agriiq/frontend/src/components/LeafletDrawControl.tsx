import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet-draw'
import 'leaflet-draw/dist/leaflet.draw.css'

interface LeafletDrawControlProps {
  onCreated: (e: any) => void
}

export default function LeafletDrawControl({ onCreated }: LeafletDrawControlProps) {
  const map = useMap()

  useEffect(() => {
    const drawnItems = new L.FeatureGroup()
    map.addLayer(drawnItems)

    const drawControl = new (L.Control as any).Draw({
      draw: {
        rectangle: false,
        circle: false,
        circlemarker: false,
        marker: false,
        polyline: false,
        polygon: {
          allowIntersection: false,
          showArea: true,
        },
      },
      edit: {
        featureGroup: drawnItems,
        remove: true,
      },
    })
    map.addControl(drawControl)

    const handleCreated = (e: any) => {
      const layer = e.layer
      drawnItems.addLayer(layer)
      onCreated(e)
    }

    map.on((L as any).Draw.Event.CREATED, handleCreated)

    return () => {
      map.removeControl(drawControl)
      map.off((L as any).Draw.Event.CREATED, handleCreated)
    }
  }, [map, onCreated])

  return null
}
