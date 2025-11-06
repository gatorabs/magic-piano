import { useQuery } from "@tanstack/react-query";

const BACKEND_URL = "http://192.168.15.12:5000";

export interface MidiFile {
  name: string;
  url: string;
}

export const useMidiFiles = () => {
  return useQuery<MidiFile[]>({
    queryKey: ["midiFiles"],
    queryFn: async () => {
      const response = await fetch(`${BACKEND_URL}/api/midi`);
      if (!response.ok) throw new Error("Failed to fetch MIDI files");
      const data = await response.json();
      return data.files;
    },
  });
};

export const fetchMidiFile = async (url: string): Promise<File> => {
  const fullUrl = url.startsWith("http") ? url : `${BACKEND_URL}${url}`;
  const response = await fetch(fullUrl);
  if (!response.ok) throw new Error("Failed to fetch MIDI file");
  const blob = await response.blob();
  const filename = url.split("/").pop() || "song.mid";
  return new File([blob], filename, { type: "audio/midi" });
};
