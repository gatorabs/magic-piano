import { BACKEND_URL } from "@/config/backend";

export interface PlayerSong {
  title: string;
  score: number;
}

export interface CreatePlayerRequest {
  name: string;
  songs: PlayerSong[];
}

export interface PlayerResponse {
  id: string;
  name: string;
  songs: PlayerSong[];
}

export interface CreatePlayerResponse {
  player: PlayerResponse;
}

export interface ListPlayersParams {
  page?: number;
  perPage?: number;
}

export interface ListPlayersPagination {
  page: number;
  per_page: number;
  total: number;
  pages: number;
}

export interface ListPlayersResponse {
  players: PlayerResponse[];
  pagination: ListPlayersPagination;
}

export class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "ApiError";
  }
}

export interface HighlightCommandPayload {
  keyId?: number;
  delayMs?: number;
  activateAt?: number;
  clear?: boolean;
}

export interface HighlightCommandResponse {
  scheduled_key: number;
  activate_at: number | null;
}

export const sendHighlightCommand = async (
  payload: HighlightCommandPayload
): Promise<HighlightCommandResponse> => {
  if (!payload.clear && typeof payload.keyId !== "number") {
    throw new ApiError(
      "É necessário informar 'keyId' ou definir 'clear' para enviar o comando de destaque."
    );
  }

  const body: Record<string, unknown> = {};

  if (payload.clear) {
    body.clear = true;
  }

  if (typeof payload.keyId === "number") {
    body.key_id = Math.trunc(payload.keyId);
  }

  if (typeof payload.delayMs === "number") {
    const delay = Math.trunc(payload.delayMs);
    if (delay >= 0) {
      body.delay_ms = delay;
    }
  }

  if (typeof payload.activateAt === "number") {
    body.activate_at = payload.activateAt;
  }

  const response = await fetch(`${BACKEND_URL}/api/game/highlight`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    let message = "Não foi possível agendar o destaque da tecla.";

    try {
      const data = await response.json();
      if (data?.error && typeof data.error === "string") {
        message = data.error;
      }
    } catch (error) {
      // Ignorado: mantém a mensagem padrão se não conseguir ler a resposta.
    }

    throw new ApiError(message, response.status);
  }

  return response.json();
};

export const createPlayer = async (
  payload: CreatePlayerRequest
): Promise<CreatePlayerResponse> => {
  const response = await fetch(`${BACKEND_URL}/api/players`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = "Não foi possível cadastrar o jogador.";

    try {
      const data = await response.json();
      if (data?.error && typeof data.error === "string") {
        message = data.error;
      } else if (Array.isArray(data?.errors) && data.errors.length > 0) {
        message = data.errors.join("\n");
      }
    } catch (error) {
      // Ignored: keep default message if parsing fails
    }

    throw new ApiError(message, response.status);
  }

  return response.json();
};

export const listPlayers = async (
  params: ListPlayersParams = {}
): Promise<ListPlayersResponse> => {
  const searchParams = new URLSearchParams();

  if (params.page && params.page > 0) {
    searchParams.set("page", String(params.page));
  }

  if (params.perPage && params.perPage > 0) {
    searchParams.set("per_page", String(params.perPage));
  }

  const query = searchParams.toString();
  const url = query
    ? `${BACKEND_URL}/api/players?${query}`
    : `${BACKEND_URL}/api/players`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new ApiError("Não foi possível carregar o ranking de jogadores.", response.status);
  }

  return response.json();
};
