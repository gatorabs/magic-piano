import sys
from multiprocessing import Manager

from src.application.usecases.data_receiver_multiprocess import data_receiver_process
from src.infrastructure.constants.controls_constants import (
    RECEIVER_BAUD,
    RECEIVER_COM,
    RECEIVER_STOP,
)
from src.infrastructure.logging.Logger import Logger
from src.infrastructure.services.process_manager import ProcessManager
from src.infrastructure.services.system_initializer import SystemInitializer


def main() -> int:
    logger = Logger("Main", verbose=True)
    system_initializer = SystemInitializer(logger)
    args = system_initializer.parse_args()

    if args.list:
        ports = system_initializer.list_ports()
        if not ports:
            print("Nenhuma porta serial encontrada.")
        else:
            print("Portas disponíveis:")
            for port in ports:
                print(f" - {port}")
        return 0

    port = system_initializer.choose_port(args.port)
    if port is None:
        return 1

    manager = Manager()
    shared_controls = manager.dict()
    shared_controls[RECEIVER_COM] = port
    shared_controls[RECEIVER_BAUD] = args.baud
    shared_controls[RECEIVER_STOP] = False

    process_manager = ProcessManager(logger)
    receiver_name = "data_receiver"
    process_manager.register(
        name=receiver_name,
        target=data_receiver_process,
        args=(shared_controls,),
        daemon=True,
    )
    process_manager.start_all()
    logger.info(
        f"Processo de recepção iniciado na porta {port} a {args.baud} bps. Pressione Ctrl+C para encerrar."
    )

    try:
        process_manager.join(receiver_name)
    except KeyboardInterrupt:
        logger.info("Encerrando recepção...")
        shared_controls[RECEIVER_STOP] = True
        process_manager.join(receiver_name, timeout=2.0)
    finally:
        if process_manager.is_alive(receiver_name):
            logger.warning("Processo não finalizou a tempo. Forçando encerramento.")
            process_manager.terminate(receiver_name)
            process_manager.join(receiver_name)

    logger.info("Aplicação finalizada.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
