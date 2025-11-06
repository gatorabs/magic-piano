import { useQuery } from "@tanstack/react-query";
import { BACKEND_URL } from "@/config/backend";

export interface MidiFile {
  name: string;
  filename: string;
  url: string;
}

export const useMidiFiles = () => {
  return useQuery<MidiFile[]>({
    queryKey: ["midiFiles"],
    queryFn: async () => {
      const response = await fetch(`${BACKEND_URL}/api/midi`);
      if (!response.ok) throw new Error("Failed to fetch MIDI files");
      const data = await response.json();
      const files: MidiFile[] = (data.files || []).map((file: any) => ({
        name: String(file.name ?? ""),
        filename: String(file.filename || file.name || ""),
        url: String(file.url ?? ""),
      }));
      return files;
    },
  });
};

export const fetchMidiFile = async (url: string, displayName?: string): Promise<File> => {
  const fullUrl = url.startsWith("http") ? url : `${BACKEND_URL}${url}`;
  const response = await fetch(fullUrl);
  if (!response.ok) throw new Error("Failed to fetch MIDI file");
  const blob = await response.blob();
  const filename = url.split("/").pop() || "song.mid";
  const name = displayName?.trim() || filename;
  return new File([blob], name, { type: "audio/midi" });
};
