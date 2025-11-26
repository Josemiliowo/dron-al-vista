import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Clock, Activity, Tag } from "lucide-react";
import { DroneData } from "@/services/mockDroneService";

interface DroneCardProps {
  drone: DroneData;
  isNew?: boolean;
}

export const DroneCard = ({ drone, isNew }: DroneCardProps) => {
  const timeSince = Math.floor((Date.now() - drone.timestamp.getTime()) / 1000);
  const timeString = timeSince < 60 ? `hace ${timeSince}s` : 
                     timeSince < 3600 ? `hace ${Math.floor(timeSince / 60)}m` :
                     `hace ${Math.floor(timeSince / 3600)}h`;

  return (
    <Card className="p-4 bg-card hover:bg-accent/50 transition-colors">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          <span className="font-semibold text-foreground">{drone.drone_id}</span>
        </div>
        <div className="flex items-center gap-2">
          {isNew && (
            <Badge variant="default" className="bg-primary text-primary-foreground">
              Nuevo
            </Badge>
          )}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            {timeString}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Altitud</p>
            <p className="text-sm font-semibold text-foreground">{Math.round(drone.alt)}m</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Tag className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Nombre</p>
            <p className="text-sm font-semibold text-foreground">{drone.name}</p>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-border">
        <p className="text-xs text-muted-foreground mb-1">Posición</p>
        <div className="flex gap-3 text-xs">
          <span className="font-mono text-foreground">X: {drone.lon.toFixed(4)}</span>
          <span className="font-mono text-foreground">Y: {drone.lat.toFixed(4)}</span>
        </div>
      </div>
    </Card>
  );
};
