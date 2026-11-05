import { Volume2, VolumeX, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface RankingControlsProps {
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  volume: number;
  setVolume: (volume: number) => void;
  isFullscreen: boolean;
  toggleFullscreen: () => void;
}

const RankingControls = ({
  isMuted,
  setIsMuted,
  volume,
  setVolume,
  isFullscreen,
  toggleFullscreen,
}: RankingControlsProps) => {
  return (
    <div className={cn(
      "flex items-center gap-2",
      isFullscreen && "fixed top-4 right-4 z-50",
    )}>
      {/* Sound controls */}
      <Popover>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            size="icon" aria-label="Ativar ou silenciar som"
            className={cn(isFullscreen && "bg-background/80 backdrop-blur-sm")}
          >
            {isMuted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48" align="end">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Som de ultrapassagem</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsMuted(!isMuted)}
              >
                {isMuted ? 'Ligar' : 'Desligar'}
              </Button>
            </div>
            <div className="space-y-2">
              <span className="text-xs text-muted-foreground">Volume</span>
              <Slider
                value={[volume * 100]}
                onValueChange={([v]) => setVolume(v / 100)}
                max={100}
                step={1}
                disabled={isMuted}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Fullscreen toggle */}
      <Button 
        variant="outline" 
        size="icon" aria-label="Alternar tela cheia"
        onClick={toggleFullscreen}
        className={cn(isFullscreen && "bg-background/80 backdrop-blur-sm")}
      >
        {isFullscreen ? (
          <Minimize2 className="h-4 w-4" />
        ) : (
          <Maximize2 className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
};

export default RankingControls;
