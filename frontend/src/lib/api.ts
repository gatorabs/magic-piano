export const BACKEND_URL = "http://192.168.15.12:5000";

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

export class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "ApiError";
  }
}

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
