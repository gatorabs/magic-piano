# serial_communicator.py
import time
from typing import List, Callable, Optional
from serial.tools import list_ports
import serial

class SerialCommunicator:
    """
    Serviço de comunicação serial com foco em baixa latência para RECEBIMENTO.
    - Abre a porta com timeout pequeno (não-bloqueante).
    - Fornece um loop de recepção que lê byte a byte e dispara callbacks.
    - Não implementa a lógica do protocolo: isso fica no decoder (módulo separado).
    """

    def __init__(self,
                 com_port: Optional[str],
                 baud_rate: int = 1_000_000,
                 read_timeout: float = 0.01,
                 open_for_receive: bool = True,
                 logger=None):
        self.serial_port: Optional[serial.Serial] = None
        self.com_port = com_port
        self.baud_rate = baud_rate
        self.read_timeout = read_timeout
        self.logger = logger
        self._opened = False

        if open_for_receive:
            available_ports = self.list_available_ports()
            if self.com_port and self.com_port in available_ports:
                try:
                    self.start_com_port()
                except Exception as e:
                    if self.logger:
                        self.logger.error(f"Erro ao abrir {self.com_port}: {e}")
                    self.serial_port = None
            else:
                if self.logger:
                    self.logger.warning(
                        f"Porta {self.com_port} não está disponível no sistema."
                    )

    @staticmethod
    def list_available_ports() -> List[str]:
        return [p.device for p in list_ports.comports()]

    def start_com_port(self):
        # Timeout pequeno para leitura não bloquear o loop
        self.serial_port = serial.Serial(
            self.com_port,
            self.baud_rate,
            timeout=self.read_timeout,
            write_timeout=0,
            bytesize=serial.EIGHTBITS,
            parity=serial.PARITY_NONE,
            stopbits=serial.STOPBITS_ONE,
        )
        # Garantimos que o PySerial não tente decodificar caracteres ASCII e
        # trabalhe byte a byte, como o firmware envia (Serial.write(&evt, 1)).
        if hasattr(self.serial_port, "encoding"):
            self.serial_port.encoding = "latin-1"
        # Descarta quaisquer bytes residuais da porta antes de iniciar o loop.
        if hasattr(self.serial_port, "reset_input_buffer"):
            self.serial_port.reset_input_buffer()
        if hasattr(self.serial_port, "reset_output_buffer"):
            self.serial_port.reset_output_buffer()
        # Pequeno intervalo para estabilizar a CDC/USB (ms, não segundos)
        time.sleep(0.05)
        self._opened = True
        if self.logger:
            self.logger.info(f"Porta {self.com_port} aberta a {self.baud_rate} bps")

    def close(self):
        if getattr(self, "serial_port", None):
            try:
                self.serial_port.close()
                if self.logger:
                    self.logger.info(f"Porta {self.com_port} fechada com sucesso.")
            except Exception as e:
                if self.logger:
                    self.logger.warning(f"Erro ao fechar a porta: {e}")
            finally:
                self.serial_port = None
                self._opened = False

    def is_open(self) -> bool:
        return bool(self.serial_port and self.serial_port.is_open and self._opened)

    def receive_loop(self,
                     on_byte: Callable[[int], None],
                     should_stop: Optional[Callable[[], bool]] = None):
        if not self.is_open():
            if self.logger:
                self.logger.warning("receive_loop: porta não está aberta.")
            return

        sp = self.serial_port
        try:
            while True:
                if should_stop and should_stop():
                    break
                b = sp.read(1)
                if not b:
                    continue
                on_byte(b[0])
        except KeyboardInterrupt:
            if self.logger:
                self.logger.info("receive_loop interrompido pelo usuário (Ctrl+C).")
        except Exception as e:
            if self.logger:
                self.logger.error(f"Erro no receive_loop: {e}")
        # Não fecha aqui; quem chamou decide quando fechar
