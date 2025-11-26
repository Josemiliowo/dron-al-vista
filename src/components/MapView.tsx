import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { DroneData, StationData } from '@/services/mockDroneService';

// Fix for default marker icons in Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapViewProps {
  drones: DroneData[];
  stations: StationData[];
}

export const MapView = ({ drones, stations }: MapViewProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const droneMarkers = useRef<Map<string, L.CircleMarker>>(new Map());
  const droneTrails = useRef<Map<string, L.Polyline>>(new Map());
  const stationMarkers = useRef<Map<string, L.Marker>>(new Map());

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // Initialize map
    map.current = L.map(mapContainer.current).setView([19.4326, -99.1332], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map.current);

    return () => {
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!map.current) return;

    // Update stations
    stations.forEach(station => {
      let marker = stationMarkers.current.get(station.station_id);
      
      if (!marker) {
        // Create custom station icon
        const stationIcon = L.divIcon({
          html: `
            <div class="relative">
              <div class="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center shadow-lg border-2 border-white">
                <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                </svg>
              </div>
              <div class="absolute -bottom-6 left-1/2 transform -translate-x-1/2 w-24 bg-white/90 backdrop-blur-sm px-2 py-1 rounded text-xs font-semibold text-center whitespace-nowrap shadow">
                ${station.name}
              </div>
            </div>
          `,
          className: 'custom-station-icon',
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        });

        marker = L.marker([station.lat, station.lon], { icon: stationIcon })
          .bindPopup(`
            <div class="p-2">
              <h3 class="font-bold mb-2">${station.name}</h3>
              <p class="text-sm"><strong>ID:</strong> ${station.station_id}</p>
              <p class="text-sm"><strong>Batería:</strong> ${station.battery}%</p>
              <p class="text-sm"><strong>Estado:</strong> ${station.status}</p>
              <p class="text-sm"><strong>Tiempo restante:</strong> ${station.time_remaining}h</p>
              <p class="text-sm"><strong>Altitud:</strong> ${station.alt}m</p>
            </div>
          `)
          .addTo(map.current!);
        
        stationMarkers.current.set(station.station_id, marker);
      }
    });

    // Update drones
    drones.forEach(drone => {
      let marker = droneMarkers.current.get(drone.drone_id);
      let trail = droneTrails.current.get(drone.drone_id);

      if (!marker) {
        // Create drone marker with size based on altitude
        const size = 15 + (drone.alt / 200) * 30; // Size between 15-45px
        marker = L.circleMarker([drone.lat, drone.lon], {
          radius: size / 2,
          fillColor: '#3b82f6',
          color: '#1e40af',
          weight: 2,
          opacity: 0.8,
          fillOpacity: 0.6
        })
        .bindPopup(`
          <div class="p-2">
            <h3 class="font-bold mb-2">${drone.drone_id}</h3>
            <p class="text-sm"><strong>Altitud:</strong> ${Math.round(drone.alt)}m</p>
            <p class="text-sm"><strong>Velocidad:</strong> ${Math.round(drone.speed)} km/h</p>
            <p class="text-sm"><strong>Lat:</strong> ${drone.lat.toFixed(4)}</p>
            <p class="text-sm"><strong>Lon:</strong> ${drone.lon.toFixed(4)}</p>
            <p class="text-sm"><strong>Última actualización:</strong> ${drone.timestamp.toLocaleTimeString()}</p>
          </div>
        `)
        .addTo(map.current!);

        droneMarkers.current.set(drone.drone_id, marker);

        // Create trail
        trail = L.polyline(drone.trail, {
          color: '#3b82f6',
          weight: 2,
          opacity: 0.5,
          dashArray: '5, 10'
        }).addTo(map.current!);
        
        droneTrails.current.set(drone.drone_id, trail);
      } else {
        // Update existing marker position and size
        marker.setLatLng([drone.lat, drone.lon]);
        const size = 15 + (drone.alt / 200) * 30;
        marker.setRadius(size / 2);
        
        // Update trail
        if (trail) {
          trail.setLatLngs(drone.trail);
        }
      }
    });

    // Auto-fit bounds to show all markers
    if (drones.length > 0 || stations.length > 0) {
      const allPoints: L.LatLngExpression[] = [
        ...drones.map(d => [d.lat, d.lon] as L.LatLngExpression),
        ...stations.map(s => [s.lat, s.lon] as L.LatLngExpression)
      ];
      
      if (allPoints.length > 0) {
        const bounds = L.latLngBounds(allPoints);
        map.current.fitBounds(bounds, { padding: [50, 50] });
      }
    }
  }, [drones, stations]);

  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden border border-border">
      <div ref={mapContainer} className="absolute inset-0" />
      <style>{`
        .custom-station-icon {
          background: transparent !important;
          border: none !important;
        }
        .leaflet-popup-content-wrapper {
          border-radius: 8px;
        }
      `}</style>
    </div>
  );
};
