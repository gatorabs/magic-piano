"""Funções utilitárias para mapear teclas do piano em faixas de LEDs."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, List, Sequence

TOTAL_KEYS = 48
WHITE_LED_COUNT = 7
BLACK_LED_COUNT = 5

# Padrão de teclas de uma oitava (C a B), True = tecla branca, False = preta
_WHITE_KEY_PATTERN: Sequence[bool] = (
    True,   # C
    False,  # C#
    True,   # D
    False,  # D#
    True,   # E
    True,   # F
    False,  # F#
    True,   # G
    False,  # G#
    True,   # A
    False,  # A#
    True,   # B
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


def is_white_key(key_index: int) -> bool:
    """Retorna se a tecla informada é branca (True) ou preta (False)."""

    if key_index < 0:
        raise ValueError("Índice de tecla não pode ser negativo.")
    return _WHITE_KEY_PATTERN[key_index % len(_WHITE_KEY_PATTERN)]


def led_span_for_key(
    key_index: int,
    total_keys: int = TOTAL_KEYS,
    white_leds: int = WHITE_LED_COUNT,
    black_leds: int = BLACK_LED_COUNT,
) -> LedSpan:
    """Calcula a faixa de LEDs correspondente a uma tecla."""

    if not 0 <= key_index < total_keys:
        raise ValueError(
            f"Índice de tecla inválido: {key_index}. Deve estar entre 0 e {total_keys - 1}."
        )

    current_led = 0
    for idx in range(key_index):
        current_led += white_leds if is_white_key(idx) else black_leds

    length = white_leds if is_white_key(key_index) else black_leds
    start_led = current_led
    end_led = start_led + length - 1

    return LedSpan(key_index=key_index, start_led=start_led, end_led=end_led)


def build_led_layout(
    total_keys: int = TOTAL_KEYS,
    white_leds: int = WHITE_LED_COUNT,
    black_leds: int = BLACK_LED_COUNT,
) -> List[LedSpan]:
    """Constrói a tabela completa de mapeamento de teclas para LEDs."""

    layout: List[LedSpan] = []
    for key_index in range(total_keys):
        layout.append(led_span_for_key(key_index, total_keys, white_leds, black_leds))
    return layout


def led_indexes_for_keys(key_indexes: Iterable[int]) -> List[int]:
    """Retorna uma lista plana com todos os LEDs associados às teclas indicadas."""

    indexes: List[int] = []
    for key_index in key_indexes:
        span = led_span_for_key(int(key_index))
        indexes.extend(span.to_indexes())
    return indexes

