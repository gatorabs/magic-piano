import { useQuery } from "@tanstack/react-query";
import { listPlayers, ListPlayersResponse } from "@/lib/api";

export const usePlayers = () => {
  return useQuery<ListPlayersResponse>({
    queryKey: ["players", { page: 1, perPage: 100 }],
    queryFn: () => listPlayers({ page: 1, perPage: 100 }),
    staleTime: 30_000,
  });
};
