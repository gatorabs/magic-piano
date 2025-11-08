"""Funções utilitárias para mapear teclas do piano em faixas de LEDs."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, List, Sequence

TOTAL_KEYS = 48

# Comprimento dos LEDs por tecla em uma oitava, seguindo o mapeamento físico
# informado pelo usuário. Os valores se repetem a cada 12 teclas.
LED_LENGTH_PATTERN: Sequence[int] = (
    8,  # tecla 1
    6,  # tecla 2
    8,  # tecla 3
    5,  # tecla 4
    8,  # tecla 5
    8,  # tecla 6
    5,  # tecla 7
    8,  # tecla 8
    5,  # tecla 9
    8,  # tecla 10
    5,  # tecla 11
    8,  # tecla 12
)


@dataclass(frozen=True)
class LedSpan:
    """Representa um intervalo contínuo de LEDs associado a uma tecla."""

    key_index: int
    start_led: int
    end_led: int

    @property
    def count(self) -> int:
        return (self.end_led - self.start_led) + 1

    def to_indexes(self) -> List[int]:
        return list(range(self.start_led, self.end_led + 1))
def led_span_for_key(
    key_index: int,
    total_keys: int = TOTAL_KEYS,
) -> LedSpan:
    """Calcula a faixa de LEDs correspondente a uma tecla."""

    if not 0 <= key_index < total_keys:
        raise ValueError(
            f"Índice de tecla inválido: {key_index}. Deve estar entre 0 e {total_keys - 1}."
        )

    current_led = 0
    pattern_length = len(LED_LENGTH_PATTERN)
    for idx in range(key_index):
        current_led += LED_LENGTH_PATTERN[idx % pattern_length]

    length = LED_LENGTH_PATTERN[key_index % pattern_length]
    start_led = current_led
    end_led = start_led + length - 1

    return LedSpan(key_index=key_index, start_led=start_led, end_led=end_led)


def build_led_layout(
    total_keys: int = TOTAL_KEYS,
) -> List[LedSpan]:
    """Constrói a tabela completa de mapeamento de teclas para LEDs."""

    layout: List[LedSpan] = []
    for key_index in range(total_keys):
        layout.append(led_span_for_key(key_index, total_keys))
    return layout


def led_indexes_for_keys(key_indexes: Iterable[int]) -> List[int]:
    """Retorna uma lista plana com todos os LEDs associados às teclas indicadas."""

    indexes: List[int] = []
    for key_index in key_indexes:
        span = led_span_for_key(int(key_index))
        indexes.extend(span.to_indexes())
    return indexes

