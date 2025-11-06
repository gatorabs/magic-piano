import { useQuery } from "@tanstack/react-query";
import { KeyState } from "@/types/midi";

const BACKEND_URL = "http://192.168.15.12:5000";

export const usePianoKeys = (enabled: boolean = true) => {
  return useQuery<KeyState[]>({
    queryKey: ["pianoKeys"],
    queryFn: async () => {
      const response = await fetch(`${BACKEND_URL}/api/keys`);
      if (!response.ok) throw new Error("Failed to fetch keys");
      const data = await response.json();
      return data.keys;
    },
    refetchInterval: enabled ? 50 : false,
    enabled,
  });
};
