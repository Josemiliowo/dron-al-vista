import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconColor?: string;
}

export const StatsCard = ({ title, value, icon: Icon, iconColor = "text-primary" }: StatsCardProps) => {
  return (
    <Card className="p-6 bg-card">
      <div className="flex items-start gap-4">
        <div className={`rounded-lg p-3 bg-accent ${iconColor}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-muted-foreground mb-1">{title}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
        </div>
      </div>
    </Card>
  );
};
