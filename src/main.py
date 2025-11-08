import sys
from multiprocessing import Manager

from src.application.usecases.data_receiver_multiprocess import data_receiver_process
from src.application.usecases.data_sender_multiprocess import data_sender_process
from src.infrastructure.constants.controls_constants import (
    RECEIVER_BAUD,
    RECEIVER_COM,
    RECEIVER_STOP,
    SENDER_BAUD,
    SENDER_COM,
    SENDER_STOP,
)
from src.infrastructure.adapters.serial.piano_decoder import make_empty_state
from src.infrastructure.adapters.web_server import start_flask_server
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

    default_port = args.port

    receiver_port = system_initializer.choose_port(
        args.receive_port or default_port,
        purpose="recepção",
    )
    if receiver_port is None:
        return 1

    sender_port = system_initializer.choose_port(
        args.send_port or default_port,
        purpose="envio",
    )
    if sender_port is None:
        return 1

    if sender_port == receiver_port:
        logger.error(
            "As portas de envio e recepção devem ser diferentes. "
            "Informe COMs distintas para cada microcontrolador."
        )
        return 1

    manager = Manager()
    shared_controls = manager.dict()
    shared_controls[RECEIVER_COM] = receiver_port
    shared_controls[RECEIVER_BAUD] = args.receive_baud or args.baud
    shared_controls[RECEIVER_STOP] = False
    shared_controls[SENDER_COM] = sender_port
    shared_controls[SENDER_BAUD] = args.send_baud or args.baud
    shared_controls[SENDER_STOP] = False

    shared_frames = manager.dict()
    for key_id, pressed in enumerate(make_empty_state()):
        shared_frames[key_id] = bool(pressed)

    send_queue = manager.Queue()

    process_manager = ProcessManager(logger)
    receiver_name = "data_receiver"
    process_manager.register(
        name=receiver_name,
        target=data_receiver_process,
        args=(shared_controls, shared_frames),
        daemon=True,
    )

    sender_name = "data_sender"
    process_manager.register(
        name=sender_name,
        target=data_sender_process,
        args=(shared_controls, send_queue),
        daemon=True,
    )

    web_name = "web_server"
    process_manager.register(
        name=web_name,
        target=start_flask_server,
        args=(shared_frames, shared_controls, send_queue),
        daemon=True,
    )

    process_manager.start_all()
    logger.info(
        "Processos iniciados: "
        f"recepção em {receiver_port} ({shared_controls[RECEIVER_BAUD]} bps), "
        f"envio em {sender_port} ({shared_controls[SENDER_BAUD]} bps)."
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

        shared_controls[SENDER_STOP] = True
        send_queue.put({"command": "stop"})
        if process_manager.is_alive(sender_name):
            logger.info("Encerrando processo de envio...")
            process_manager.join(sender_name, timeout=2.0)
        if process_manager.is_alive(sender_name):
            process_manager.terminate(sender_name)
            process_manager.join(sender_name)

        if process_manager.is_alive(web_name):
            logger.info("Encerrando servidor web...")
            process_manager.terminate(web_name)
            process_manager.join(web_name)

    logger.info("Aplicação finalizada.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
