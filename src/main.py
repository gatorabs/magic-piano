import argparse
import sys
from multiprocessing import Manager, Process
from typing import Optional

from src.application.usecases.data_receiver_multiprocess import data_receiver_process
from src.infrastructure.adapters.serial.serial_communicator import SerialCommunicator
from src.infrastructure.constants.controls_constants import (
    RECEIVER_BAUD,
    RECEIVER_COM,
    RECEIVER_STOP,
)
from src.infrastructure.logging.Logger import Logger


def parse_args() -> argparse.Namespace:
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


def choose_port(requested_port: Optional[str], logger: Logger) -> Optional[str]:
    available = SerialCommunicator.list_available_ports()
    if requested_port:
        if requested_port not in available:
            logger.error(
                f"Porta {requested_port} não encontrada. Disponíveis: {', '.join(available) or 'nenhuma'}"
            )
            return None
        return requested_port

    if not available:
        logger.error("Nenhuma porta serial encontrada. Use --port após conectar o dispositivo.")
        return None

    chosen = available[0]
    logger.warning(f"Nenhuma porta informada. Usando automaticamente {chosen}.")
    return chosen


def main() -> int:
    args = parse_args()
    logger = Logger("Main", verbose=True)

    if args.list:
        ports = SerialCommunicator.list_available_ports()
        if not ports:
            print("Nenhuma porta serial encontrada.")
        else:
            print("Portas disponíveis:")
            for port in ports:
                print(f" - {port}")
        return 0

    port = choose_port(args.port, logger)
    if port is None:
        return 1

    manager = Manager()
    shared_controls = manager.dict()
    shared_controls[RECEIVER_COM] = port
    shared_controls[RECEIVER_BAUD] = args.baud
    shared_controls[RECEIVER_STOP] = False

    receiver = Process(target=data_receiver_process, args=(shared_controls,), daemon=True)
    receiver.start()
    logger.info(
        f"Processo de recepção iniciado na porta {port} a {args.baud} bps. Pressione Ctrl+C para encerrar."
    )

    try:
        receiver.join()
    except KeyboardInterrupt:
        logger.info("Encerrando recepção...")
        shared_controls[RECEIVER_STOP] = True
        receiver.join(timeout=2.0)
    finally:
        if receiver.is_alive():
            logger.warning("Processo não finalizou a tempo. Forçando encerramento.")
            receiver.terminate()
            receiver.join()

    logger.info("Aplicação finalizada.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
