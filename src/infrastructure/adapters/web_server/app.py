from __future__ import annotations

from pathlib import Path

from flask import Flask

from .routes import register_routes


def create_app(frames_dict, controls_dict, sender_queue) -> Flask:
    """Cria a aplicação Flask configurada com os estados compartilhados."""

    module_dir = Path(__file__).resolve().parent
    template_folder = module_dir / "templates"
    storage_dir = module_dir / "storage"
    midi_storage_dir = storage_dir / "midi"
    players_storage_path = storage_dir / "players.json"

    storage_dir.mkdir(parents=True, exist_ok=True)
    midi_storage_dir.mkdir(parents=True, exist_ok=True)

    app = Flask(__name__, template_folder=str(template_folder))

    register_routes(
        app,
        frames_dict,
        controls_dict,
        midi_storage_dir,
        players_storage_path,
        sender_queue,
    )
    return app


def start_flask_server(frames_dict, controls_dict, sender_queue) -> None:
    """Inicializa o servidor Flask expondo os estados das teclas."""

    app = create_app(frames_dict, controls_dict, sender_queue)
    app.run(
        host="0.0.0.0",
        port=5000,
        threaded=True,
        debug=False,
        use_reloader=False,
    )
