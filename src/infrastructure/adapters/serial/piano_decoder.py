from typing import Iterable, List, Optional, Tuple

SNAPSHOT_MARKER = 0x7F

# Estado local das 48 teclas (0=solta, 1=pressionada)
def make_empty_state() -> List[int]:
    return [0] * 48

def key_to_port_bit(key_id: int) -> Tuple[str, int]:
    port = key_id // 8           # 0..5 => A..F
    bit  = key_id % 8            # 0..7
    return "ABCDEF"[port], bit

def decode_event_byte(val: int) -> Optional[Tuple[int, int]]:
    """
    Decodifica um único byte de evento.
      bit7 = estado (1=down, 0=up)
      bits[5:0] = key_id (0..47)
    Retorna (key_id, pressed) ou None se inválido/reservado.
    """
    if val == SNAPSHOT_MARKER:
        return None  # marcador é tratado fora (fluxo)
    pressed = (val >> 7) & 0x01
    key_id  = val & 0x3F
    if key_id >= 48:
        return None
    return key_id, pressed

def apply_event_to_state(state: List[int], key_id: int, pressed: int) -> bool:
    """
    Atualiza o estado local (0/1). Retorna True se mudou (bom p/ filtrar bounce).
    """
    if state[key_id] == pressed:
        return False
    state[key_id] = pressed
    return True

def decode_snapshot_bytes(snap: bytes) -> List[int]:
    """
    Converte os 6 bytes (A..F) em uma lista de 48 ints (0/1).
    """
    if len(snap) != 6:
        raise ValueError("Snapshot incompleto (esperados 6 bytes).")
    flat = [0] * 48
    for p in range(6):
        b = snap[p]
        for bit in range(8):
            key = (p * 8) + bit
            flat[key] = (b >> bit) & 1
    return flat

def read_snapshot_bytes(byte_iterable: Iterable[int]) -> Optional[bytes]:
    """
    Lê os 6 bytes de snapshot a partir de um iterador de bytes (após receber SNAPSHOT_MARKER).
    Retorna os 6 bytes ou None se não houver bytes suficientes.
    """
    buf = bytearray()
    for _ in range(6):
        try:
            b = next(byte_iterable)
        except StopIteration:
            return None
        buf.append(b)
    return bytes(buf)
