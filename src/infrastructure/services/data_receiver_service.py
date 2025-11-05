from typing import Iterator


def byte_generator_from_callback(cb_get_byte) -> Iterator[int]:
    """
    Pequeno adaptador para consumir bytes sequencialmente dentro do on_byte.
    Você pode ignorar se preferir outra abordagem.
    """
    while True:
        b = cb_get_byte()
        if b is None:
            break
        yield b
