from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple
from uuid import uuid4

from flask import Blueprint, jsonify, render_template, request, send_from_directory
from werkzeug.utils import secure_filename

from src.infrastructure.constants.controls_constants import (
    RECEIVER_BAUD,
    RECEIVER_COM,
    SENDER_BAUD,
    SENDER_COM,
)


def register_routes(
    app,
    frames_dict,
    controls_dict,
    midi_storage_dir: Path,
    players_storage_path: Path,
    send_queue,
) -> None:
    """Registra rotas padrão para o monitoramento das teclas."""

    web = Blueprint("web", __name__)

    midi_storage_dir = midi_storage_dir.resolve()
    midi_metadata_path = midi_storage_dir / "metadata.json"
    players_storage_path = players_storage_path.resolve()

    def _sorted_key_ids() -> List[int]:
        keys: Iterable[Any] = frames_dict.keys()
        return sorted(int(key) for key in keys)

    def _build_key_payload() -> List[Dict[str, Any]]:
        payload: List[Dict[str, Any]] = []
        for key_id in _sorted_key_ids():
            payload.append({"id": key_id, "pressed": bool(frames_dict.get(key_id, False))})
        return payload

    def _load_midi_metadata() -> Dict[str, Dict[str, str]]:
        if not midi_metadata_path.exists():
            return {}

        try:
            with midi_metadata_path.open("r", encoding="utf-8") as file:
                data = json.load(file)
        except (OSError, json.JSONDecodeError):
            return {}

        if not isinstance(data, dict):
            return {}

        metadata: Dict[str, Dict[str, str]] = {}
        for key, value in data.items():
            if not isinstance(key, str) or not isinstance(value, dict):
                continue

            name = value.get("name")
            if not isinstance(name, str) or not name.strip():
                continue

            metadata[key] = {"name": name.strip()}

        return metadata

    def _save_midi_metadata(metadata: Dict[str, Dict[str, str]]) -> None:
        midi_metadata_path.parent.mkdir(parents=True, exist_ok=True)
        with midi_metadata_path.open("w", encoding="utf-8") as file:
            json.dump(metadata, file, ensure_ascii=False, indent=2)

    def _list_midi_files() -> List[Dict[str, Any]]:
        midi_storage_dir.mkdir(parents=True, exist_ok=True)
        metadata = _load_midi_metadata()
        midi_paths = [
            *midi_storage_dir.glob("*.mid"),
            *midi_storage_dir.glob("*.midi"),
        ]
        midi_paths.sort(key=lambda path: path.name.lower())
        files: List[Dict[str, Any]] = []
        for midi_path in midi_paths:
            filename = midi_path.name
            entry = metadata.get(filename)
            label = entry.get("name") if entry else None
            if not label:
                label = midi_path.stem

            files.append(
                {
                    "name": label,
                    "filename": filename,
                    "url": f"/api/midi/{filename}",
                }
            )

        return files

    def _load_players() -> List[Dict[str, Any]]:
        if not players_storage_path.exists():
            return []

        try:
            with players_storage_path.open("r", encoding="utf-8") as file:
                data = json.load(file)
        except (OSError, json.JSONDecodeError):
            return []

        if not isinstance(data, list):
            return []

        players: List[Dict[str, Any]] = []
        for item in data:
            if isinstance(item, dict):
                players.append(item)
        return players

    def _save_players(players: List[Dict[str, Any]]) -> None:
        players_storage_path.parent.mkdir(parents=True, exist_ok=True)
        with players_storage_path.open("w", encoding="utf-8") as file:
            json.dump(players, file, ensure_ascii=False, indent=2)

    def _validate_player_payload(payload: Dict[str, Any]) -> Tuple[Dict[str, Any], List[str]]:
        errors: List[str] = []
        validated: Dict[str, Any] = {}

        name = payload.get("name")
        if not isinstance(name, str) or not name.strip():
            errors.append("Campo 'name' é obrigatório e deve ser uma string não vazia.")
        else:
            validated["name"] = name.strip()

        songs_raw = payload.get("songs")
        if songs_raw is None:
            errors.append("Campo 'songs' é obrigatório.")
            songs = []
        elif not isinstance(songs_raw, list):
            errors.append("Campo 'songs' deve ser uma lista.")
            songs = []
        else:
            songs = []
            for index, entry in enumerate(songs_raw):
                if not isinstance(entry, dict):
                    errors.append(
                        f"Entrada {index} em 'songs' deve ser um objeto com 'title' e 'score'."
                    )
                    continue

                title = entry.get("title")
                score = entry.get("score")
                if not isinstance(title, str) or not title.strip():
                    errors.append(
                        f"Entrada {index} em 'songs' precisa de 'title' como string não vazia."
                    )
                    continue

                if not isinstance(score, (int, float)):
                    errors.append(
                        f"Entrada {index} em 'songs' precisa de 'score' numérico."
                    )
                    continue

                songs.append({"title": title.strip(), "score": float(score)})

        validated["songs"] = songs
        return validated, errors

    @web.route("/")
    def index():
        return render_template(
            "index.html",
            keys=_build_key_payload(),
            serial_port=controls_dict.get(RECEIVER_COM),
            serial_baud=controls_dict.get(RECEIVER_BAUD),
            sender_port=controls_dict.get(SENDER_COM),
            sender_baud=controls_dict.get(SENDER_BAUD),
            midi_files=_list_midi_files(),
        )

    @web.route("/api/keys")
    def api_keys():
        return jsonify({"keys": _build_key_payload()})

    @web.route("/api/game/highlight", methods=["OPTIONS"])
    def game_highlight_options():  # pragma: no cover - header-only route
        return ("", 204)

    @web.route("/api/game/highlight", methods=["POST"])
    def schedule_highlight():
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify({"error": "JSON inválido ou não fornecido."}), 400

        clear = bool(payload.get("clear"))
        key_id = payload.get("key_id")

        if clear:
            key_value = 0
        else:
            if not isinstance(key_id, int):
                return jsonify({"error": "Campo 'key_id' deve ser um inteiro."}), 400
            if not 0 <= key_id < 48:
                return jsonify({"error": "Campo 'key_id' deve estar entre 0 e 47."}), 400
            key_value = key_id + 1  # Firmware espera teclas 1..48

        activate_at = payload.get("activate_at")
        delay_ms = payload.get("delay_ms")

        target_time = None
        if activate_at is not None:
            try:
                target_time = float(activate_at)
            except (TypeError, ValueError):
                return jsonify({"error": "Campo 'activate_at' deve ser numérico."}), 400
        elif delay_ms is not None:
            try:
                delay_seconds = float(delay_ms) / 1000.0
            except (TypeError, ValueError):
                return jsonify({"error": "Campo 'delay_ms' deve ser numérico."}), 400
            target_time = time.time() + delay_seconds

        message = {
            "command": "highlight",
            "key": int(key_value),
            "activate_at": target_time,
        }

        send_queue.put(message)

        response_payload = {
            "scheduled_key": int(key_value),
            "activate_at": target_time,
        }
        return jsonify(response_payload), 202

    @web.after_request
    def add_cors_headers(response):
        """Garante que as respostas possam ser consumidas por clientes externos."""
        response.headers.setdefault("Access-Control-Allow-Origin", "*")
        response.headers.setdefault(
            "Access-Control-Allow-Methods", "GET,POST,OPTIONS"
        )
        response.headers.setdefault(
            "Access-Control-Allow-Headers", "Content-Type"
        )
        return response

    #rotas web
    @web.route("/api/midi", methods=["OPTIONS"])
    def midi_collection_options():
        return ("", 204)

    @web.route("/api/midi/<path:filename>", methods=["OPTIONS"])
    def midi_resource_options(filename: str):  # pragma: no cover - header-only route
        return ("", 204)

    @web.route("/api/midi", methods=["GET"])
    def list_midi():
        return jsonify({"files": _list_midi_files()})

    @web.route("/api/midi", methods=["POST"])
    def upload_midi():
        midi_storage_dir.mkdir(parents=True, exist_ok=True)
        name_raw = request.form.get("name")
        if not isinstance(name_raw, str) or not name_raw.strip():
            return jsonify({"error": "Nome da música é obrigatório."}), 400

        song_name = name_raw.strip()
        if len(song_name) > 120:
            return jsonify({"error": "Nome da música deve ter no máximo 120 caracteres."}), 400
        upload = request.files.get("file")
        if upload is None or upload.filename == "":
            return jsonify({"error": "Arquivo MIDI não fornecido"}), 400

        filename = secure_filename(upload.filename)
        if not filename:
            return jsonify({"error": "Nome de arquivo inválido"}), 400

        suffix = Path(filename).suffix.lower()
        if suffix not in {".mid", ".midi"}:
            return jsonify({"error": "Apenas arquivos .mid ou .midi são aceitos"}), 400

        destination = midi_storage_dir / filename
        upload.save(destination)

        metadata = _load_midi_metadata()
        metadata[filename] = {"name": song_name}
        _save_midi_metadata(metadata)

        return (
            jsonify(
                {
                    "message": "Arquivo salvo com sucesso",
                    "file": {
                        "name": song_name,
                        "filename": filename,
                        "url": f"/api/midi/{filename}",
                    },
                }
            ),
            201,
        )

    @web.route("/api/midi/<path:filename>", methods=["GET"])
    def download_midi(filename: str):
        safe_name = secure_filename(filename)
        if not safe_name or safe_name != filename:
            return jsonify({"error": "Arquivo não encontrado"}), 404

        destination = midi_storage_dir / safe_name
        if not destination.exists():
            return jsonify({"error": "Arquivo não encontrado"}), 404

        return send_from_directory(
            midi_storage_dir,
            safe_name,
            mimetype="audio/midi",
            as_attachment=True,
        )

    @web.route("/api/players", methods=["POST"])
    def create_player():
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict):
            return jsonify({"error": "JSON inválido ou não fornecido."}), 400

        validated, errors = _validate_player_payload(payload)
        if errors:
            return jsonify({"errors": errors}), 400

        players = _load_players()
        player = {
            "id": str(uuid4()),
            **validated,
        }
        players.append(player)
        _save_players(players)

        return jsonify({"player": player}), 201

    @web.route("/api/players", methods=["GET"])
    def list_players():
        players = _load_players()

        page = request.args.get("page", default=1, type=int) or 1
        per_page = request.args.get("per_page", default=10, type=int) or 10

        page = max(1, page)
        per_page = max(1, per_page)

        start = (page - 1) * per_page
        end = start + per_page
        paginated_players = players[start:end]

        return jsonify(
            {
                "players": paginated_players,
                "pagination": {
                    "page": page,
                    "per_page": per_page,
                    "total": len(players),
                    "pages": (len(players) + per_page - 1) // per_page,
                },
            }
        )

    app.register_blueprint(web)
