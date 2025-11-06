import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Music, Play } from "lucide-react";

const Home = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-8">
      <div className="max-w-2xl w-full text-center space-y-12">
        <div className="space-y-4">
          <div className="flex justify-center mb-6">
            <div className="p-6 rounded-full bg-gradient-to-br from-primary to-[hsl(var(--note-falling))] shadow-2xl">
              <Music className="h-20 w-20 text-primary-foreground" />
            </div>
          </div>
          
          <h1 className="text-6xl font-bold bg-gradient-to-r from-primary via-[hsl(var(--note-falling))] to-[hsl(var(--note-hit))] bg-clip-text text-transparent">
            Piano Hero
          </h1>
        </div>

        <div className="flex flex-col gap-4 items-center">
          <Button
            size="lg"
            onClick={() => navigate("/select")}
            className="text-lg px-12 py-6 h-auto gap-3 shadow-xl hover:shadow-2xl transition-all hover:scale-105"
          >
            <Play className="h-6 w-6" />
            Jogar
          </Button>
        </div>

        <div className="pt-8 border-t border-border/50">
          <p className="text-sm text-muted-foreground">
            Certifique-se de que seu piano está conectado e o servidor está rodando
          </p>
        </div>
      </div>
    </div>
  );
};

export default Home;
