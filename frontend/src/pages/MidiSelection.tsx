import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMidiFiles } from "@/hooks/useMidiFiles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, Music, Play, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const MidiSelection = () => {
  const navigate = useNavigate();
  const { data: midiFiles = [], isLoading, isError } = useMidiFiles();
  const [playerName, setPlayerName] = useState("");
  const [selectedMidi, setSelectedMidi] = useState<string>("");

  const handleStart = () => {
    if (!playerName.trim()) {
      toast.error("Por favor, digite seu nome");
      return;
    }
    if (!selectedMidi) {
      toast.error("Por favor, selecione uma música");
      return;
    }

    sessionStorage.setItem("playerName", playerName);
    sessionStorage.setItem("selectedMidi", selectedMidi);
    
    navigate("/game");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Selecione uma Música</h1>
            <p className="text-muted-foreground">Configure sua partida</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Informações do Jogador</CardTitle>
              <CardDescription>Digite seu nome para registrar sua pontuação</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="playerName">Nome do Jogador</Label>
                <Input
                  id="playerName"
                  placeholder="Digite seu nome"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  maxLength={50}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Música Selecionada</CardTitle>
              <CardDescription>
                {selectedMidi ? selectedMidi : "Nenhuma música selecionada"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={handleStart}
                disabled={!playerName.trim() || !selectedMidi}
                className="w-full gap-2"
                size="lg"
              >
                <Play className="h-5 w-5" />
                Começar a Jogar
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Music className="h-5 w-5" />
              Músicas Disponíveis
            </CardTitle>
            <CardDescription>
              Escolha uma música para tocar
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Erro ao carregar arquivos MIDI. Verifique se o servidor está rodando em http://192.168.15.12:5000
                </AlertDescription>
              </Alert>
            )}

            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}

            {!isLoading && !isError && midiFiles.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum arquivo MIDI encontrado no servidor
              </div>
            )}

            {!isLoading && !isError && midiFiles.length > 0 && (
              <div className="grid gap-2">
                {midiFiles.map((file) => (
                  <button
                    key={file.name}
                    onClick={() => setSelectedMidi(file.name)}
                    className={`p-4 rounded-lg border text-left transition-all hover:shadow-md ${
                      selectedMidi === file.name
                        ? "border-primary bg-primary/10 shadow-lg"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded ${
                        selectedMidi === file.name ? "bg-primary text-primary-foreground" : "bg-secondary"
                      }`}>
                        <Music className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium">{file.name}</p>
                      </div>
                      {selectedMidi === file.name && (
                        <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MidiSelection;
