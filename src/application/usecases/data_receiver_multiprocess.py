from collections import deque

from src.infrastructure.constants.controls_constants import (
    RECEIVER_BAUD,
    RECEIVER_COM,
    RECEIVER_STOP,
)
from src.infrastructure.logging.Logger import Logger
from src.infrastructure.adapters.serial.serial_communicator import SerialCommunicator
from src.infrastructure.adapters.serial.piano_decoder import (
    SNAPSHOT_MARKER,
    make_empty_state,
    decode_event_byte,
    apply_event_to_state,
    decode_snapshot_bytes,
    key_to_port_bit,
)


def data_receiver_process(shared_controls, frames_dict):
    logger = Logger("SerialReceiver", verbose=True)
    current_com = shared_controls.get(RECEIVER_COM)
    baud = shared_controls.get(RECEIVER_BAUD, 115_200)

    comm = SerialCommunicator(
        com_port=current_com,
        baud_rate=baud,
        open_for_receive=True,
        logger=logger
    )

    if not comm.is_open():
        logger.error("Não foi possível abrir a porta para recepção.")
        return

    # Estado das 48 teclas
    state = make_empty_state()

    # Inicializa o estado compartilhado, garantindo que todas as teclas existam
    for key_id in range(len(state)):
        frames_dict[key_id] = bool(frames_dict.get(key_id, False))

    # Buffer para suportar leitura do snapshot (pegando próximos 6 bytes)
    # Estratégia: quando receber 0x7F, vamos ler os 6 bytes seguintes diretamente.
    # Para isso, guardamos os bytes que chegam em uma fila.

    queue = deque()

    def on_byte(b: int):
        # Enfileira para permitir leitura sequencial (snapshot)
        queue.append(b)

        # Consumidor: processa enquanto houver bytes
        while queue:
            val = queue.popleft()

            # Snapshot marker?
            if val == SNAPSHOT_MARKER:
                # Precisamos de +6 bytes; se não houver todos ainda, devolve e espera
                if len(queue) < 6:
                    # devolve o marcador e espera os próximos bytes chegarem
                    queue.appendleft(val)
                    return
                snap = bytes(queue.popleft() for _ in range(6))
                try:
                    flat = decode_snapshot_bytes(snap)
                except ValueError as e:
                    logger.warning(f"Snapshot inválido: {e}")
                    continue

                # Atualiza estado e log (apenas diferenças para não poluir)
                changes = []
                for key_id in range(48):
                    if state[key_id] != flat[key_id]:
                        state[key_id] = flat[key_id]
                        changes.append((key_id, flat[key_id]))
                if changes:
                    hex_str = " ".join(f"{b:02X}" for b in snap)
                    logger.info(f"SNAPSHOT A..F = {hex_str} | changes={len(changes)}")
                    for key_id, pressed in changes:
                        frames_dict[key_id] = bool(pressed)
                continue

            # Evento 1 byte
            evt = decode_event_byte(val)
            if evt is None:
                # inválido / reservado — ignore
                continue

            key_id, pressed = evt
            changed = apply_event_to_state(state, key_id, pressed)
            if not changed:
                # Provável bounce repetido; ignorar para não poluir
                continue

            port_name, bit = key_to_port_bit(key_id)
            logger.info(f"{'DOWN' if pressed else 'UP  '} "
                        f"key={key_id:02d} (P{port_name}{bit})")

            frames_dict[key_id] = bool(pressed)

            # >>> AQUI você pode despachar para seu domínio:
            # ex.: events_bus.publish("piano.key", {"id": key_id, "pressed": bool(pressed)})

    def should_stop():
        # permite que o processo seja sinalizado externamente (ex.: Ctrl+C na main)
        return bool(shared_controls.get(RECEIVER_STOP, False))

    try:
        comm.receive_loop(on_byte=on_byte, should_stop=should_stop)
    finally:
        comm.close()
