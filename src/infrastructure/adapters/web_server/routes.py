from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Iterable, List

from flask import Blueprint, jsonify, render_template, request, send_from_directory
from werkzeug.utils import secure_filename

from src.infrastructure.constants.controls_constants import RECEIVER_BAUD, RECEIVER_COM


def register_routes(app, frames_dict, controls_dict, midi_storage_dir: Path) -> None:
    """Registra rotas padrão para o monitoramento das teclas."""

    web = Blueprint("web", __name__)

    midi_storage_dir = midi_storage_dir.resolve()

    def _sorted_key_ids() -> List[int]:
        keys: Iterable[Any] = frames_dict.keys()
        return sorted(int(key) for key in keys)

    def _build_key_payload() -> List[Dict[str, Any]]:
        payload: List[Dict[str, Any]] = []
        for key_id in _sorted_key_ids():
            payload.append({"id": key_id, "pressed": bool(frames_dict.get(key_id, False))})
        return payload

    def _list_midi_files() -> List[Dict[str, Any]]:
        midi_storage_dir.mkdir(parents=True, exist_ok=True)
        midi_paths = [
            *midi_storage_dir.glob("*.mid"),
            *midi_storage_dir.glob("*.midi"),
        ]
        midi_paths.sort(key=lambda path: path.name.lower())
        return [
            {
                "name": midi_path.name,
                "url": f"/api/midi/{midi_path.name}",
            }
            for midi_path in midi_paths
        ]

    @web.route("/")
    def index():
        return render_template(
            "index.html",
            keys=_build_key_payload(),
            serial_port=controls_dict.get(RECEIVER_COM),
            serial_baud=controls_dict.get(RECEIVER_BAUD),
            midi_files=_list_midi_files(),
        )

    @web.route("/api/keys")
    def api_keys():
        return jsonify({"keys": _build_key_payload()})

    @web.route("/api/midi", methods=["GET"])
    def list_midi():
        return jsonify({"files": _list_midi_files()})

    @web.route("/api/midi", methods=["POST"])
    def upload_midi():
        midi_storage_dir.mkdir(parents=True, exist_ok=True)
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
        return (
            jsonify(
                {
                    "message": "Arquivo salvo com sucesso",
                    "file": {"name": filename, "url": f"/api/midi/{filename}"},
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

    app.register_blueprint(web)
