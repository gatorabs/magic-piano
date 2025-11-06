import { useState, useCallback, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Piano } from "@/components/Piano/Piano";
import { FallingNotes } from "@/components/MidiPlayer/FallingNotes";
import { GameController } from "@/components/MidiPlayer/GameController";
import { usePianoKeys } from "@/hooks/usePianoKeys";
import { useMidiParser } from "@/hooks/useMidiParser";
import { useMidiAudio } from "@/hooks/useMidiAudio";
import { fetchMidiFile } from "@/hooks/useMidiFiles";
import { GameNote } from "@/types/midi";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, ArrowLeft, CheckCircle2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createPlayer } from "@/lib/api";
import { BACKEND_URL } from "@/config/backend";

const Game = () => {
  const navigate = useNavigate();
  const { data: keys = [], isError } = usePianoKeys();
  const { notes, fileName, parseMidiFile, clearMidi } = useMidiParser();
  const { loadNotes: loadAudioNotes, playFrom, pause, stop } = useMidiAudio();
  const [playerName, setPlayerName] = useState("");
  const [isLoadingMidi, setIsLoadingMidi] = useState(true);
  const [gameNotes, setGameNotes] = useState<GameNote[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [isExitDialogOpen, setIsExitDialogOpen] = useState(false);
  const [isResultDialogOpen, setIsResultDialogOpen] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [finalMaxCombo, setFinalMaxCombo] = useState(0);
  const [isSavingPlayer, setIsSavingPlayer] = useState(false);
  const [songTitle, setSongTitle] = useState("");
  const [gameSessionId, setGameSessionId] = useState(0);

  const displayedSongTitle = songTitle || fileName || "Música";

  useEffect(() => {
    const loadMidi = async () => {
      const storedName = sessionStorage.getItem("playerName");
      const storedMidi = sessionStorage.getItem("selectedMidi");
      const storedMidiLabel = sessionStorage.getItem("selectedMidiLabel");

      if (!storedName || !storedMidi) {
        toast.error("Nenhuma música selecionada");
        navigate("/select");
        return;
      }

      setPlayerName(storedName);
      setSongTitle(storedMidiLabel ?? "");

      try {
        const midiUrl = `/api/midi/${storedMidi}`;
        const file = await fetchMidiFile(midiUrl, storedMidiLabel ?? undefined);
        if (!storedMidiLabel) {
          setSongTitle(file.name);
        }
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

  useEffect(() => {
    if (notes.length > 0) {
      stop();
      loadAudioNotes(notes);
    }
  }, [notes, loadAudioNotes, stop]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  const totalDuration = useMemo(() => {
    if (notes.length === 0) {
      return 0;
    }

    return notes.reduce((max, note) => {
      const endTime = note.time + note.duration;
      return endTime > max ? endTime : max;
    }, 0);
  }, [notes]);

  const formatTime = useCallback((timeInSeconds: number) => {
    if (!Number.isFinite(timeInSeconds)) {
      return "0:00";
    }

    const clamped = Math.max(0, Math.min(timeInSeconds, totalDuration || timeInSeconds));
    const minutes = Math.floor(clamped / 60);
    const seconds = Math.floor(clamped % 60)
      .toString()
      .padStart(2, "0");

    return `${minutes}:${seconds}`;
  }, [totalDuration]);

  const handleGameStateChange = useCallback(
    (notes: GameNote[], time: number) => {
      setGameNotes(notes);
      setCurrentTime((prevTime) => {
        const nextTime = Math.min(time, totalDuration || time);
        return nextTime === prevTime ? prevTime : nextTime;
      });
    },
    [totalDuration]
  );

  const handleScoreChange = useCallback((newScore: number, newCombo: number) => {
    setScore(newScore);
    setCombo(newCombo);
  }, []);

  const handleSongComplete = useCallback(
    async ({ score: finalScoreValue, maxCombo }: { score: number; maxCombo: number }) => {
      setFinalScore(finalScoreValue);
      setFinalMaxCombo(maxCombo);
      setIsResultDialogOpen(true);
      setIsSavingPlayer(true);

      const title = songTitle || fileName || "Música desconhecida";

      try {
        await createPlayer({
          name: playerName,
          songs: [
            {
              title,
              score: finalScoreValue,
            },
          ],
        });
        toast.success("Jogador cadastrado com sucesso!");
      } catch (error) {
        console.error("Failed to register player", error);
        toast.error(
          error instanceof Error
            ? error.message
            : "Não foi possível cadastrar o jogador."
        );
      } finally {
        setIsSavingPlayer(false);
      }
    },
    [fileName, playerName, songTitle]
  );

  const handleRepeatSong = useCallback(() => {
    setIsResultDialogOpen(false);
    setScore(0);
    setCombo(0);
    setCurrentTime(0);
    setGameNotes([]);
    stop();
    setGameSessionId((prev) => prev + 1);
  }, [stop]);

  const handleStopPlaying = useCallback(() => {
    setIsResultDialogOpen(false);
    stop();
    clearMidi();
    navigate("/");
  }, [clearMidi, navigate, stop]);

  const handleResultDialogChange = useCallback(
    (open: boolean) => {
      if (!open && isSavingPlayer) {
        return;
      }
      setIsResultDialogOpen(open);
    },
    [isSavingPlayer]
  );

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
              onClick={() => setIsExitDialogOpen(true)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-[hsl(var(--note-falling))] bg-clip-text text-transparent">
                Piano Hero
              </h1>
              <p className="text-sm text-muted-foreground">{displayedSongTitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-card rounded-lg border shadow-sm">
            <User className="h-4 w-4 text-primary" />
            <span className="font-medium">{playerName}</span>
          </div>
        </header>

        <div className="bg-card/80 backdrop-blur-sm border rounded-lg p-4 shadow-lg">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span className="font-medium text-primary">
              {formatTime(currentTime)}
            </span>
            <span className="flex-1 min-w-0 truncate px-4 text-center font-medium text-muted-foreground">
              {displayedSongTitle}
            </span>
            <span className="font-medium text-muted-foreground">
              {formatTime(totalDuration)}
            </span>
          </div>
          <Progress
            value={totalDuration ? (currentTime / totalDuration) * 100 : 0}
            className="mt-3 h-2"
          />
        </div>

        {isError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {`Não foi possível conectar ao backend. Certifique-se de que o servidor Flask está rodando em ${BACKEND_URL}`}
            </AlertDescription>
          </Alert>
        )}

        <div className="bg-card rounded-lg p-6 space-y-6 shadow-xl border">
          {notes.length > 0 && (
            <GameController
              key={gameSessionId}
              midiNotes={notes}
              pressedKeys={keys}
              onGameStateChange={handleGameStateChange}
              onScoreChange={handleScoreChange}
              onPlay={playFrom}
              onPause={pause}
              onReset={stop}
              onSongComplete={handleSongComplete}
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

      <AlertDialog open={isExitDialogOpen} onOpenChange={setIsExitDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deseja sair do jogo?</AlertDialogTitle>
            <AlertDialogDescription>
              Seu progresso será perdido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar jogando</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                clearMidi();
                navigate("/");
              }}
            >
              Sair agora
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isResultDialogOpen} onOpenChange={handleResultDialogChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="space-y-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <DialogTitle>Música concluída!</DialogTitle>
            <DialogDescription>
              Sua pontuação foi registrada. Parabéns pela performance!
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-3">
              <span className="text-sm text-muted-foreground">Pontuação final</span>
              <span className="text-xl font-semibold text-primary">{finalScore}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-3">
              <span className="text-sm text-muted-foreground">Maior combo</span>
              <span className="text-xl font-semibold text-[hsl(var(--note-falling))]">
                {finalMaxCombo}x
              </span>
            </div>
          </div>

          <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button onClick={handleRepeatSong} disabled={isSavingPlayer}>
              Repetir
            </Button>
            <Button
              variant="secondary"
              onClick={handleStopPlaying}
              disabled={isSavingPlayer}
            >
              Parar de jogar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Game;
