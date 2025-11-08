import argparse
import tkinter as tk
from tkinter import messagebox, ttk
from typing import List, Optional

from src.infrastructure.adapters.serial.serial_communicator import SerialCommunicator
from src.infrastructure.logging.Logger import Logger


class SystemInitializer:
    def __init__(self, logger: Logger) -> None:
        self._logger = logger

    def parse_args(self) -> argparse.Namespace:
        parser = argparse.ArgumentParser(
            description="Magic Piano - processo de recepção serial"
        )
        parser.add_argument(
            "--receiver-port",
            "--port",
            dest="receiver_port",
            help="Porta serial utilizada para receber eventos do teclado (ex.: COM4)",
        )
        parser.add_argument(
            "--baud",
            type=int,
            default=115_200,
            help="Baud rate utilizado pelo microcontrolador (default: 115200)",
        )
        parser.add_argument(
            "--sender-port",
            dest="sender_port",
            help="Porta serial utilizada para enviar comandos de LED (ex.: COM5)",
        )
        parser.add_argument(
            "--sender-baud",
            type=int,
            default=115_200,
            dest="sender_baud",
            help="Baud rate utilizado para o dispositivo de LEDs (default: 115200)",
        )
        parser.add_argument(
            "--list",
            action="store_true",
            help="Apenas lista as portas disponíveis e sai",
        )
        return parser.parse_args()

    def list_ports(self) -> List[str]:
        return SerialCommunicator.list_available_ports()

    def choose_port(
        self, requested_port: Optional[str], *, prompt: Optional[str] = None
    ) -> Optional[str]:
        available = self.list_ports()

        if requested_port:
            if requested_port not in available:
                self._logger.error(
                    f"Porta {requested_port} não encontrada. Disponíveis: {', '.join(available) or 'nenhuma'}"
                )
                return None
            return requested_port

        if not available:
            self._logger.error(
                "Nenhuma porta serial encontrada. Utilize --receiver-port ou --sender-port após conectar o dispositivo."
            )
            return None

        return self._show_port_selection(available, prompt=prompt)

    def _show_port_selection(
        self, ports: List[str], *, prompt: Optional[str] = None
    ) -> Optional[str]:
        root = tk.Tk()
        root.title("Selecionar porta serial")
        root.geometry("320x120")
        root.resizable(False, False)

        selected: dict[str, Optional[str]] = {"value": None}

        label_text = prompt or "Escolha a porta serial:"
        ttk.Label(root, text=label_text).pack(pady=(15, 5))

        combo = ttk.Combobox(root, values=ports, state="readonly")
        combo.pack(pady=5)

        if ports:
            combo.current(0)

        def confirm_selection() -> None:
            value = combo.get()
            if not value:
                messagebox.showwarning(
                    "Seleção inválida", "Selecione uma porta antes de continuar."
                )
                return
            selected["value"] = value
            root.destroy()

        def on_close() -> None:
            root.destroy()

        root.protocol("WM_DELETE_WINDOW", on_close)

        ttk.Button(root, text="Confirmar", command=confirm_selection).pack(pady=(5, 15))

        root.mainloop()

        chosen = selected["value"]
        if not chosen:
            self._logger.error("Nenhuma porta selecionada. Encerrando aplicação.")
            return None

        self._logger.info(f"Porta {chosen} selecionada manualmente.")
        return chosen
