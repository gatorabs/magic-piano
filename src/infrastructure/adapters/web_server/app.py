from __future__ import annotations

from pathlib import Path

from flask import Flask

from .routes import register_routes


def create_app(frames_dict, controls_dict) -> Flask:
    """Cria a aplicação Flask configurada com os estados compartilhados."""

    template_folder = Path(__file__).resolve().parent / "templates"
    midi_storage_dir = Path(__file__).resolve().parent / "storage" / "midi"
    midi_storage_dir.mkdir(parents=True, exist_ok=True)

    app = Flask(__name__, template_folder=str(template_folder))

    register_routes(app, frames_dict, controls_dict, midi_storage_dir)
    return app


def start_flask_server(frames_dict, controls_dict) -> None:
    """Inicializa o servidor Flask expondo os estados das teclas."""

    app = create_app(frames_dict, controls_dict)
    app.run(
        host="0.0.0.0",
        port=5000,
        threaded=True,
        debug=False,
        use_reloader=False,
    )
