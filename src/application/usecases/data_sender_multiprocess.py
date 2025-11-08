from __future__ import annotations

import time
from queue import Empty
from typing import Any, Dict

from src.infrastructure.adapters.serial.serial_communicator import SerialCommunicator
from src.infrastructure.constants.controls_constants import (
    SENDER_BAUD,
    SENDER_COM,
    SENDER_STOP,
)
from src.infrastructure.logging.Logger import Logger


STOP_COMMAND = "stop"
HIGHLIGHT_COMMAND = "highlight"


def _parse_message(message: Dict[str, Any], logger: Logger) -> Dict[str, Any] | None:
    """Valida e prepara a mensagem recebida pela fila."""

    command = message.get("command")
    if command == STOP_COMMAND:
        return {"command": STOP_COMMAND}

    if command != HIGHLIGHT_COMMAND:
        logger.warning(f"Comando desconhecido recebido: {command!r}")
        return None

    key = message.get("key")
    if not isinstance(key, int) or key < 0:
        logger.warning(f"Valor de tecla inválido recebido: {key!r}")
        return None

    activate_at = message.get("activate_at")
    if activate_at is not None:
        try:
            activate_at = float(activate_at)
        except (TypeError, ValueError):
            logger.warning(f"Timestamp inválido recebido: {activate_at!r}")
            activate_at = None

    return {
        "command": HIGHLIGHT_COMMAND,
        "key": key,
        "activate_at": activate_at,
    }


def data_sender_process(shared_controls, send_queue) -> None:
    """Processo responsável por enviar dados ao microcontrolador."""

    logger = Logger("SerialSender", verbose=True)

    com_port = shared_controls.get(SENDER_COM)
    baud = shared_controls.get(SENDER_BAUD, 115_200)

    if not com_port:
        logger.error("Nenhuma porta configurada para envio de dados.")
        return

    comm = SerialCommunicator(
        com_port=com_port,
        baud_rate=baud,
        open_for_receive=False,
        logger=logger,
    )

    try:
        comm.start_com_port()
    except Exception as exc:  # pragma: no cover - depende do SO/driver
        logger.error(f"Não foi possível abrir a porta {com_port} para envio: {exc}")
        return

    logger.info(f"Processo de envio iniciado na porta {com_port} a {baud} bps.")

    try:
        while True:
            if shared_controls.get(SENDER_STOP):
                logger.info("Sinal de parada recebido para o processo de envio.")
                break

            try:
                message = send_queue.get(timeout=0.1)
            except Empty:
                continue

            if not isinstance(message, dict):
                logger.warning(f"Mensagem inválida recebida: {message!r}")
                continue

            parsed = _parse_message(message, logger)
            if parsed is None:
                continue

            if parsed["command"] == STOP_COMMAND:
                logger.info("Comando explícito de parada recebido pela fila.")
                break

            target_time = parsed.get("activate_at")
            if target_time is not None:
                delay = target_time - time.time()
                if delay > 0:
                    time.sleep(delay)

            key = parsed["key"]
            if not comm.send_line(str(key)):
                logger.warning(f"Falha ao enviar tecla {key} ao microcontrolador.")
    finally:
        comm.close()
        logger.info("Processo de envio finalizado.")
