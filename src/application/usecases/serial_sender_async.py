"""Processo assíncrono responsável por enviar comandos de LEDs via serial."""

from __future__ import annotations

import asyncio
import queue
from typing import Any, Dict, Optional

from src.infrastructure.adapters.serial.serial_communicator import SerialCommunicator
from src.infrastructure.constants.controls_constants import (
    SENDER_BAUD,
    SENDER_COM,
    SENDER_STOP,
)
from src.infrastructure.logging.Logger import Logger
from src.infrastructure.services.led_layout import led_span_for_key


async def _get_next_command(command_queue) -> Optional[Dict[str, Any]]:
    try:
        result = await asyncio.to_thread(command_queue.get, True, 0.5)
    except queue.Empty:
        return None
    except Exception as exc:  # pragma: no cover - exceções inesperadas
        raise exc
    if result is None:
        return None
    if isinstance(result, dict):
        return result
    return {"key_id": result}


def _build_payload(command: Dict[str, Any]) -> Optional[bytes]:
    key_raw = command.get("key_id")
    try:
        key_index = int(key_raw)
    except (TypeError, ValueError):
        return None

    try:
        span = led_span_for_key(key_index)
    except ValueError:
        return None

    count = span.count
    payload = f"HIGHLIGHT {key_index} {span.start_led} {count}\n"
    return payload.encode("ascii", errors="ignore")


async def _sender_loop(
    logger: Logger,
    communicator: SerialCommunicator,
    command_queue,
    shared_controls,
):
    while True:
        if shared_controls.get(SENDER_STOP):
            logger.info("Sinal de parada recebido. Encerrando loop de envio.")
            break

        try:
            command = await _get_next_command(command_queue)
        except Exception as exc:  # pragma: no cover - segurança
            logger.error(f"Erro ao obter comando: {exc}")
            await asyncio.sleep(0.2)
            continue

        if command is None:
            await asyncio.sleep(0.05)
            continue

        if command.get("type") == "stop":
            logger.info("Comando explícito de parada recebido.")
            break

        payload = _build_payload(command)
        if not payload:
            logger.warning(f"Comando ignorado por dados inválidos: {command}")
            continue

        if not communicator.is_open():
            logger.warning("Porta serial não está aberta. Ignorando comando.")
            await asyncio.sleep(0.5)
            continue

        if not communicator.write(payload):
            logger.error("Falha ao enviar dados pela serial. Comando será descartado.")
        else:
            message = payload.decode("ascii", errors="ignore").strip()
            logger.info(f"Comando enviado: {message}")


def serial_sender_process(shared_controls, command_queue) -> None:
    logger = Logger("SerialSender", verbose=True)

    port = shared_controls.get(SENDER_COM)
    baud = shared_controls.get(SENDER_BAUD, 115_200)

    if not port:
        logger.error("Porta do emissor de LEDs não configurada.")
        return

    available_ports = SerialCommunicator.list_available_ports()
    if port not in available_ports:
        logger.error(
            f"Porta {port} não está disponível. Portas detectadas: {', '.join(available_ports) or 'nenhuma'}"
        )
        return

    communicator = SerialCommunicator(
        com_port=port,
        baud_rate=baud,
        open_for_receive=False,
        logger=logger,
    )

    try:
        communicator.start_com_port()
    except Exception as exc:  # pragma: no cover - erros inesperados do pyserial
        logger.error(f"Não foi possível abrir a porta {port}: {exc}")
        return

    try:
        asyncio.run(_sender_loop(logger, communicator, command_queue, shared_controls))
    finally:
        communicator.close()
