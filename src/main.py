import sys
from multiprocessing import Manager

from src.application.usecases.data_receiver_multiprocess import data_receiver_process
from src.application.usecases.serial_sender_async import serial_sender_process
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

    receiver_port = system_initializer.choose_port(
        args.receiver_port,
        prompt="Selecione a porta do receptor (teclas)",
    )
    if receiver_port is None:
        return 1

    sender_port = system_initializer.choose_port(
        args.sender_port,
        prompt="Selecione a porta do emissor de LEDs",
    )
    if sender_port is None:
        return 1

    manager = Manager()
    shared_controls = manager.dict()
    shared_controls[RECEIVER_COM] = receiver_port
    shared_controls[RECEIVER_BAUD] = args.baud
    shared_controls[RECEIVER_STOP] = False
    shared_controls[SENDER_COM] = sender_port
    shared_controls[SENDER_BAUD] = args.sender_baud
    shared_controls[SENDER_STOP] = False

    shared_frames = manager.dict()
    for key_id, pressed in enumerate(make_empty_state()):
        shared_frames[key_id] = bool(pressed)

    sender_queue = manager.Queue()

    process_manager = ProcessManager(logger)
    receiver_name = "data_receiver"
    process_manager.register(
        name=receiver_name,
        target=data_receiver_process,
        args=(shared_controls, shared_frames),
        daemon=True,
    )

    sender_name = "serial_sender"
    process_manager.register(
        name=sender_name,
        target=serial_sender_process,
        args=(shared_controls, sender_queue),
        daemon=True,
    )

    web_name = "web_server"
    process_manager.register(
        name=web_name,
        target=start_flask_server,
        args=(shared_frames, shared_controls, sender_queue),
        daemon=True,
    )

    process_manager.start_all()
    logger.info(
        "Processos iniciados: recepção na porta "
        f"{receiver_port} ({args.baud} bps) e envio na porta {sender_port} ({args.sender_baud} bps)."
        " Pressione Ctrl+C para encerrar."
    )

    try:
        process_manager.join(receiver_name)
    except KeyboardInterrupt:
        logger.info("Encerrando recepção...")
        shared_controls[RECEIVER_STOP] = True
        shared_controls[SENDER_STOP] = True
        try:
            sender_queue.put({"type": "stop"}, block=False)
        except Exception:
            pass
        process_manager.join(receiver_name, timeout=2.0)
    finally:
        shared_controls[SENDER_STOP] = True
        try:
            sender_queue.put({"type": "stop"}, block=False)
        except Exception:
            pass
        if process_manager.is_alive(receiver_name):
            logger.warning("Processo não finalizou a tempo. Forçando encerramento.")
            process_manager.terminate(receiver_name)
            process_manager.join(receiver_name)

        if process_manager.is_alive(sender_name):
            logger.info("Encerrando processo de envio serial...")
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
