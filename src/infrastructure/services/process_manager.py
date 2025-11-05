from __future__ import annotations

from multiprocessing import Process
from typing import Any, Callable, Dict, Iterable, Optional

from src.infrastructure.logging.Logger import Logger


class ProcessManager:
    """Centraliza o ciclo de vida dos processos da aplicação."""

    def __init__(self, logger: Logger) -> None:
        self._logger = logger
        self._processes: Dict[str, Process] = {}

    def register(
        self,
        name: str,
        target: Callable[..., None],
        args: Iterable[Any] | None = None,
        kwargs: Optional[Dict[str, Any]] = None,
        daemon: bool = True,
    ) -> Process:
        if name in self._processes:
            raise ValueError(f"Processo '{name}' já foi registrado.")

        process = Process(
            target=target,
            args=tuple(args or ()),
            kwargs=dict(kwargs or {}),
            daemon=daemon,
            name=name,
        )
        self._processes[name] = process
        return process

    def start_all(self) -> None:
        for name, process in self._processes.items():
            self._logger.info(f"Iniciando processo {name}...")
            process.start()

    def join(self, name: str, timeout: Optional[float] = None) -> None:
        process = self._processes[name]
        process.join(timeout=timeout)

    def join_all(self, timeout: Optional[float] = None) -> None:
        for name in list(self._processes.keys()):
            self.join(name, timeout)

    def terminate(self, name: str) -> None:
        process = self._processes[name]
        if process.is_alive():
            self._logger.warning(f"Forçando término do processo {name}...")
            process.terminate()

    def terminate_all(self) -> None:
        for name in list(self._processes.keys()):
            self.terminate(name)

    def is_alive(self, name: str) -> bool:
        return self._processes[name].is_alive()

    def get(self, name: str) -> Process:
        return self._processes[name]
