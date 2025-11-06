import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Piano } from "@/components/Piano/Piano";
import { FallingNotes } from "@/components/MidiPlayer/FallingNotes";
import { GameController } from "@/components/MidiPlayer/GameController";
import { usePianoKeys } from "@/hooks/usePianoKeys";
import { useMidiParser } from "@/hooks/useMidiParser";
import { fetchMidiFile } from "@/hooks/useMidiFiles";
import { GameNote } from "@/types/midi";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, ArrowLeft, User } from "lucide-react";
import { Button } from "@/components/ui/button";

const Game = () => {
  const navigate = useNavigate();
  const { data: keys = [], isError } = usePianoKeys();
  const { notes, fileName, parseMidiFile, clearMidi } = useMidiParser();
  const [playerName, setPlayerName] = useState("");
  const [isLoadingMidi, setIsLoadingMidi] = useState(true);
  const [gameNotes, setGameNotes] = useState<GameNote[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);

  useEffect(() => {
    const loadMidi = async () => {
      const storedName = sessionStorage.getItem("playerName");
      const storedMidi = sessionStorage.getItem("selectedMidi");

      if (!storedName || !storedMidi) {
        toast.error("Nenhuma música selecionada");
        navigate("/select");
        return;
      }

      setPlayerName(storedName);

      try {
        const midiUrl = `/api/midi/${storedMidi}`;
        const file = await fetchMidiFile(midiUrl);
        await parseMidiFile(file);
        setIsLoadingMidi(false);
      } catch (error) {
        console.error("Error loading MIDI:", error);
        toast.error("Erro ao carregar arquivo MIDI");
        navigate("/select");
      }
    };

    loadMidi();
  }, [navigate, parseMidiFile]);

  const handleGameStateChange = useCallback(
    (notes: GameNote[], time: number) => {
      setGameNotes(notes);
      setCurrentTime(time);
    },
    []
  );

  const handleScoreChange = useCallback((newScore: number, newCombo: number) => {
    setScore(newScore);
    setCombo(newCombo);
  }, []);

  const expectedKeys = new Set(
    gameNotes
      .filter((n) => n.active && Math.abs(n.time - currentTime) < 0.5)
      .map((n) => n.midi % 48)
  );

  const correctKeys = new Set(
    gameNotes
      .filter((n) => n.hit && currentTime - n.time < 0.3)
      .map((n) => n.midi % 48)
  );

  const missedKeys = new Set(
    gameNotes
      .filter((n) => n.missed && currentTime - n.time < 0.3)
      .map((n) => n.midi % 48)
  );

  if (isLoadingMidi) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="text-muted-foreground">Carregando música...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (confirm("Deseja sair do jogo? Seu progresso será perdido.")) {
                  navigate("/");
                }
              }}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-[hsl(var(--note-falling))] bg-clip-text text-transparent">
                Piano Hero
              </h1>
              <p className="text-sm text-muted-foreground">{fileName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-card rounded-lg border shadow-sm">
            <User className="h-4 w-4 text-primary" />
            <span className="font-medium">{playerName}</span>
          </div>
        </header>

        {isError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Não foi possível conectar ao backend. Certifique-se de que o servidor Flask está rodando em http://192.168.15.12:5000
            </AlertDescription>
          </Alert>
        )}

        <div className="bg-card rounded-lg p-6 space-y-6 shadow-xl border">
          {notes.length > 0 && (
            <GameController
              midiNotes={notes}
              pressedKeys={keys}
              onGameStateChange={handleGameStateChange}
              onScoreChange={handleScoreChange}
            />
          )}

          {notes.length > 0 && (
            <FallingNotes
              notes={gameNotes}
              currentTime={currentTime}
              lookAheadTime={3}
            />
          )}

          <div className="flex justify-center py-4">
            <Piano
              keys={keys}
              expectedKeys={expectedKeys}
              correctKeys={correctKeys}
              missedKeys={missedKeys}
            />
          </div>

          {keys.length === 0 && !isError && (
            <div className="text-center py-8 text-muted-foreground">
              Aguardando conexão com o piano...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Game;
