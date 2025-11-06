import { useQuery } from "@tanstack/react-query";
import { KeyState } from "@/types/midi";
import { BACKEND_URL } from "@/config/backend";

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
