import argparse
from typing import List, Optional

from src.infrastructure.adapters.serial.serial_communicator import SerialCommunicator
from src.infrastructure.logging.Logger import Logger


class SystemInitializatorService:
    def __init__(self, logger: Logger) -> None:
        self._logger = logger

    def parse_args(self) -> argparse.Namespace:
        parser = argparse.ArgumentParser(
            description="Magic Piano - processo de recepção serial"
        )
        parser.add_argument(
            "--port",
            help="Porta serial a ser utilizada (ex.: COM4, /dev/ttyACM0)",
        )
        parser.add_argument(
            "--baud",
            type=int,
            default=115_200,
            help="Baud rate utilizado pelo microcontrolador (default: 115200)",
        )
        parser.add_argument(
            "--list",
            action="store_true",
            help="Apenas lista as portas disponíveis e sai",
        )
        return parser.parse_args()

    def list_ports(self) -> List[str]:
        return SerialCommunicator.list_available_ports()

    def choose_port(self, requested_port: Optional[str]) -> Optional[str]:
        available = self.list_ports()

        if requested_port:
            if requested_port not in available:
                self._logger.error(
                    f"Porta {requested_port} não encontrada. Disponíveis: {', '.join(available) or 'nenhuma'}"
                )
                return None
            return requested_port

        if not available:
            self._logger.error(
                "Nenhuma porta serial encontrada. Use --port após conectar o dispositivo."
            )
            return None

        chosen = available[0]
        self._logger.warning(
            f"Nenhuma porta informada. Usando automaticamente {chosen}."
        )
        return chosen
