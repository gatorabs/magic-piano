from __future__ import annotations

from typing import Any, Dict, Iterable, List

from flask import Blueprint, jsonify, render_template

from src.infrastructure.constants.controls_constants import RECEIVER_BAUD, RECEIVER_COM


def register_routes(app, frames_dict, controls_dict) -> None:
    """Registra rotas padrão para o monitoramento das teclas."""

    web = Blueprint("web", __name__)

    def _sorted_key_ids() -> List[int]:
        keys: Iterable[Any] = frames_dict.keys()
        return sorted(int(key) for key in keys)

    def _build_key_payload() -> List[Dict[str, Any]]:
        payload: List[Dict[str, Any]] = []
        for key_id in _sorted_key_ids():
            payload.append({"id": key_id, "pressed": bool(frames_dict.get(key_id, False))})
        return payload

    @web.route("/")
    def index():
        return render_template(
            "index.html",
            keys=_build_key_payload(),
            serial_port=controls_dict.get(RECEIVER_COM),
            serial_baud=controls_dict.get(RECEIVER_BAUD),
        )

    @web.route("/api/keys")
    def api_keys():
        return jsonify({"keys": _build_key_payload()})

    app.register_blueprint(web)
