import { useEffect, useState } from "react";
import { Radio, Activity, Clock } from "lucide-react";
import { StatsCard } from "@/components/StatsCard";
import { DroneCard } from "@/components/DroneCard";
import { MapView } from "@/components/MapView";
import { Badge } from "@/components/ui/badge";
import { websocketService } from "@/services/websocketService";
import { DroneData, StationData } from "@/services/mockDroneService";

const Index = () => {
  const [drones, setDrones] = useState<DroneData[]>([]);
  const [stations, setStations] = useState<StationData[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Conectar al backend real (usa la URL actual automáticamente)
    websocketService.connect();
    
    websocketService.subscribeDrones((updatedDrones) => {
      setDrones(prevDrones => {
        const droneMap = new Map(prevDrones.map(d => [d.drone_id, d]));
        
        updatedDrones.forEach(newDrone => {
          const existingDrone = droneMap.get(newDrone.drone_id);
          if (existingDrone) {
            // Mantener el trail existente y agregar nuevo punto
            const newTrail: [number, number][] = [
              ...existingDrone.trail, 
              [newDrone.lat, newDrone.lon] as [number, number]
            ].slice(-20);
            newDrone.trail = newTrail;
          }
          droneMap.set(newDrone.drone_id, newDrone);
        });
        
        return Array.from(droneMap.values());
      });
    });
    
    websocketService.subscribeStations((updatedStations) => {
      setStations(updatedStations);
    });
    
    websocketService.subscribeConnected((status) => {
      setIsConnected(status);
    });

    return () => {
      websocketService.disconnect();
    };
  }, []);

  const avgAltitude = drones.length > 0 
    ? Math.round(drones.reduce((sum, d) => sum + d.alt, 0) / drones.length)
    : 0;

  const lastDetection = drones.length > 0
    ? drones.reduce((latest, d) => d.timestamp > latest.timestamp ? d : latest).timestamp
    : new Date();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-primary p-2 rounded-lg">
              <Radio className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Sistema de Rastreo de Drones</h1>
              <p className="text-sm text-muted-foreground">Monitoreo de detección en tiempo real</p>
            </div>
          </div>
          <Badge variant={isConnected ? "default" : "destructive"} className="flex items-center gap-2">
            <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
            {isConnected ? "Sistema Activo" : "Desconectado"}
          </Badge>
        </div>
      </header>

      {/* Main Content */}
      <div className="p-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <StatsCard
            title="Detecciones Totales"
            value={drones.length}
            icon={Radio}
            iconColor="text-primary"
          />
          <StatsCard
            title="Altitud Promedio"
            value={`${avgAltitude}m`}
            icon={Activity}
            iconColor="text-primary"
          />
          <StatsCard
            title="Última Detección"
            value={lastDetection.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            icon={Clock}
            iconColor="text-primary"
          />
        </div>

        {/* Map and Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Map */}
          <div className="lg:col-span-2 h-[600px] bg-card rounded-lg p-4">
            <MapView drones={drones} stations={stations} />
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="bg-card rounded-lg p-4">
              <h2 className="text-lg font-semibold text-foreground mb-4">Últimas Detecciones</h2>
              <p className="text-sm text-muted-foreground mb-4">Actividad de drones en tiempo real</p>
              
              <div className="space-y-3 max-h-[520px] overflow-y-auto">
                {drones.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No hay detecciones activas
                  </p>
                ) : (
                  drones
                    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
                    .map((drone, index) => (
                      <DroneCard 
                        key={drone.drone_id} 
                        drone={drone}
                        isNew={index === 0}
                      />
                    ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
