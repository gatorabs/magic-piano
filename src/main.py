import sys
from multiprocessing import Manager, Process

from src.application.usecases.data_receiver_multiprocess import data_receiver_process
from src.infrastructure.constants.controls_constants import (
    RECEIVER_BAUD,
    RECEIVER_COM,
    RECEIVER_STOP,
)
from src.infrastructure.logging.Logger import Logger
from src.infrastructure.services.system_initializator_service import (
    SystemInitializatorService,
)


def main() -> int:
    logger = Logger("Main", verbose=True)
    system_initializator = SystemInitializatorService(logger)
    args = system_initializator.parse_args()

    if args.list:
        ports = system_initializator.list_ports()
        if not ports:
            print("Nenhuma porta serial encontrada.")
        else:
            print("Portas disponíveis:")
            for port in ports:
                print(f" - {port}")
        return 0

    port = system_initializator.choose_port(args.port)
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
