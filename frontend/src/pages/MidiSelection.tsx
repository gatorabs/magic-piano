import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MidiFile, useMidiFiles } from "@/hooks/useMidiFiles";
import { usePlayers } from "@/hooks/usePlayers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Music, Play, Loader2, AlertCircle, Trophy } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";

const MidiSelection = () => {
  const navigate = useNavigate();
  const { data: midiFiles = [], isLoading, isError } = useMidiFiles();
  const {
    data: playersData,
    isLoading: isPlayersLoading,
    isError: isPlayersError,
  } = usePlayers();
  const [playerName, setPlayerName] = useState("");
  const [selectedMidi, setSelectedMidi] = useState<MidiFile | null>(null);
  const [openSongs, setOpenSongs] = useState<string[]>([]);

  const songRankings = useMemo(() => {
    if (!playersData?.players?.length) {
      return [] as Array<{
        title: string;
        entries: { name: string; score: number }[];
        bestScore: number;
      }>;
    }

    const songsMap = new Map<string, Map<string, number>>();

    for (const player of playersData.players) {
      const playerNameValue = player.name?.trim() || "Jogador desconhecido";

      for (const song of player.songs ?? []) {
        const title = String(song.title ?? "").trim() || "Música desconhecida";
        const numericScore = Number(song.score);
        const score = Number.isFinite(numericScore) ? numericScore : 0;

        if (!songsMap.has(title)) {
          songsMap.set(title, new Map());
        }

        const playerScores = songsMap.get(title)!;
        const current = playerScores.get(playerNameValue);

        if (current === undefined || score > current) {
          playerScores.set(playerNameValue, score);
        }
      }
    }

    const rankings = Array.from(songsMap.entries()).map(([title, playerScores]) => {
      const entries = Array.from(playerScores.entries())
        .map(([name, score]) => ({ name, score }))
        .sort((a, b) => b.score - a.score);

      return {
        title,
        entries,
        bestScore: entries[0]?.score ?? 0,
      };
    });

    return rankings
      .filter((ranking) => ranking.entries.length > 0)
      .sort(
        (a, b) =>
          b.bestScore - a.bestScore ||
          a.title.localeCompare(b.title, "pt-BR", { sensitivity: "base" })
      );
  }, [playersData]);

  const hasRankingData = songRankings.length > 0;

  useEffect(() => {
    if (!songRankings.length) {
      setOpenSongs([]);
      return;
    }

    setOpenSongs((prev) => {
      const visibleTitles = songRankings.map((ranking) => ranking.title);
      const preserved = prev.filter((title) => visibleTitles.includes(title));
      const newTitles = visibleTitles.filter((title) => !preserved.includes(title));
      return [...preserved, ...newTitles];
    });
  }, [songRankings]);

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
    sessionStorage.setItem("selectedMidi", selectedMidi.filename);
    sessionStorage.setItem("selectedMidiLabel", selectedMidi.name);

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
                {selectedMidi ? selectedMidi.name : "Nenhuma música selecionada"}
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
              <div className="grid auto-rows-fr grid-cols-1 gap-3 sm:grid-cols-2">
                {midiFiles.map((file) => {
                  const isSelected = selectedMidi?.filename === file.filename;

                  return (
                    <button
                      key={file.filename}
                      onClick={() => setSelectedMidi(file)}
                      className={`flex h-full flex-col gap-3 rounded-lg border p-4 text-left transition-all hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                        isSelected
                          ? "border-primary bg-primary/10 shadow-lg"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`rounded p-2 ${
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary"
                          }`}
                        >
                          <Music className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium leading-tight">{file.name}</p>
                        </div>
                        {isSelected && (
                          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <Separator className="my-6" />

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Ranking de Pontos</h3>
              </div>

              {isPlayersError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Não foi possível carregar o ranking de jogadores. Tente novamente mais tarde.
                  </AlertDescription>
                </Alert>
              )}

              {isPlayersLoading && (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              )}

              {!isPlayersLoading && !isPlayersError && !hasRankingData && (
                <p className="py-4 text-sm text-muted-foreground">
                  Nenhuma pontuação registrada ainda. Jogue uma música para inaugurar o placar!
                </p>
              )}

              {!isPlayersLoading && !isPlayersError && hasRankingData && (
                <Accordion
                  type="multiple"
                  value={openSongs}
                  onValueChange={(value) => setOpenSongs(value as string[])}
                  className="space-y-4"
                >
                  {songRankings.map((ranking) => {
                    const topEntries = ranking.entries.slice(0, 5);

                    return (
                      <AccordionItem
                        key={ranking.title}
                        value={ranking.title}
                        className="overflow-hidden rounded-lg border bg-background/60 shadow-sm"
                      >
                        <AccordionTrigger className="px-4">
                          <div className="flex w-full items-center justify-between gap-4">
                            <span className="text-base font-semibold">{ranking.title}</span>
                            <span className="text-sm text-muted-foreground">
                              Melhor pontuação:
                              <span className="ml-1 font-medium text-primary">
                                {ranking.bestScore.toLocaleString("pt-BR")}
                              </span>
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-4">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-20">Posição</TableHead>
                                <TableHead>Jogador</TableHead>
                                <TableHead className="text-right">Pontuação</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {topEntries.map((entry, index) => (
                                <TableRow
                                  key={`${ranking.title}-${entry.name}`}
                                  className={index === 0 ? "bg-primary/5" : undefined}
                                >
                                  <TableCell className="font-medium">
                                    {index + 1}º
                                  </TableCell>
                                  <TableCell>{entry.name}</TableCell>
                                  <TableCell className="text-right font-medium">
                                    {entry.score.toLocaleString("pt-BR")}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  })}
                </Accordion>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MidiSelection;
