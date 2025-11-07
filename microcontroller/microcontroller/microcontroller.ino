#define BAUD    115200
#define SNAPSHOT_MARKER 0x7F

// Máscaras para cada porta (1 = linha utilizada pelo teclado)
#define MASK_A 0xFF
#define MASK_B 0xFF
#define MASK_C 0xFF
#define MASK_D 0xFF
#define MASK_E 0xFC  // protege RX0/TX0 (PE0/PE1)
#define MASK_F 0xFF

static const uint8_t PORT_MASKS[6] = {
  MASK_A, MASK_B, MASK_C, MASK_D, MASK_E, MASK_F
};

static const char PORT_NAMES[6] = {'A', 'B', 'C', 'D', 'E', 'F'};

static uint8_t prev_state[6] = {0, 0, 0, 0, 0, 0};
static bool debug_text = false;
static uint32_t last_snapshot_ms = 0;

static inline uint8_t read_port(uint8_t idx) {
  switch (idx) {
    case 0: return (~PINA) & MASK_A;
    case 1: return (~PINB) & MASK_B;
    case 2: return (~PINC) & MASK_C;
    case 3: return (~PIND) & MASK_D;
    case 4: return (~PINE) & MASK_E;
    default: return (~PINF) & MASK_F; // idx == 5
  }
}

static void send_snapshot(const uint8_t *ports) {
  Serial.write(SNAPSHOT_MARKER);
  Serial.write(ports, 6);
}

static void print_state_text(const uint8_t *ports) {
  Serial.print(F("[debug] Estado:"));
  for (uint8_t p = 0; p < 6; ++p) {
    Serial.print(' ');
    Serial.print('P');
    Serial.print(PORT_NAMES[p]);
    Serial.print('=');
    for (int8_t bit = 7; bit >= 0; --bit) {
      Serial.print((ports[p] >> bit) & 1);
    }
  }
  Serial.println();
}

static void print_mapping_table() {
  Serial.println();
  Serial.println(F("[debug] Mapa de teclas (indice -> porta.bit)"));
  for (uint8_t p = 0; p < 6; ++p) {
    for (uint8_t bit = 0; bit < 8; ++bit) {
      if (!(PORT_MASKS[p] & (1 << bit))) {
        continue;
      }

      uint8_t key = (p * 8) + bit;
      Serial.print(F("  "));
      if (key < 10) {
        Serial.print('0');
      }
      Serial.print(key);
      Serial.print(F(" -> P"));
      Serial.print(PORT_NAMES[p]);
      Serial.print('.');
      Serial.print(bit);
      Serial.println();
    }
  }
  Serial.println();
}

static void handle_serial_commands() {
  while (Serial.available()) {
    int incoming = Serial.read();
    if (incoming == 'd' || incoming == 'D') {
      debug_text = !debug_text;
      if (debug_text) {
        Serial.println();
        Serial.println(F("[debug] Modo texto ativado. Eventos binarios pausados."));
        Serial.println(F("[debug] Use '?' para ver a tabela de mapeamento."));
        print_state_text(prev_state);
      } else {
        Serial.println();
        Serial.println(F("[debug] Modo texto desativado. Retomando protocolo binario."));
        send_snapshot(prev_state);
        last_snapshot_ms = millis();
      }
    } else if (incoming == '?' || incoming == 'm' || incoming == 'M') {
      print_mapping_table();
    }
  }
}

void setup() {
  Serial.begin(BAUD);
  delay(200); // dá tempo da porta USB inicializar

  // Configura pinos como entrada com pull-up interno habilitado.
  DDRA &= ~MASK_A; PORTA |= MASK_A;
  DDRB &= ~MASK_B; PORTB |= MASK_B;
  DDRC &= ~MASK_C; PORTC |= MASK_C;
  DDRD &= ~MASK_D; PORTD |= MASK_D;

  // Mantém RX0/TX0 como saídas do USB CDC.
  DDRE = (DDRE & ~MASK_E);
  PORTE |= MASK_E;

  DDRF &= ~MASK_F; PORTF |= MASK_F;

  // Captura o estado inicial e envia um snapshot para sincronizar a aplicação.
  uint8_t initial[6];
  for (uint8_t p = 0; p < 6; ++p) {
    initial[p] = read_port(p);
    prev_state[p] = initial[p];
  }
  send_snapshot(initial);
  last_snapshot_ms = millis();
}

void loop() {
  handle_serial_commands();

  uint8_t cur[6];
  for (uint8_t p = 0; p < 6; ++p) {
    cur[p] = read_port(p);
  }

  bool changed_any = false;

  for (uint8_t p = 0; p < 6; ++p) {
    uint8_t diff = (cur[p] ^ prev_state[p]) & PORT_MASKS[p];
    while (diff) {
      uint8_t bit = __builtin_ctz(diff);
      diff &= (diff - 1);

      uint8_t key   = (p * 8) + bit;
      uint8_t state = (cur[p] >> bit) & 1; // 1=pressionada, 0=solta
      if (debug_text) {
        Serial.print(F("[debug] Tecla "));
        Serial.print(key);
        Serial.print(state ? F(" pressionada ") : F(" solta "));
        Serial.print(F("(P"));
        Serial.print(PORT_NAMES[p]);
        Serial.print('.');
        Serial.print(bit);
        Serial.println(')');
      } else {
        uint8_t evt = (state << 7) | (key & 0x3F);
        Serial.write(&evt, 1);
      }
      changed_any = true;
    }
    prev_state[p] = cur[p];
  }

  // Envia snapshots periódicos para manter a aplicação sincronizada.
  if (debug_text) {
    if (changed_any) {
      print_state_text(cur);
    }
  } else {
    uint32_t now = millis();
    if (changed_any || (now - last_snapshot_ms) > 500) {
      send_snapshot(cur);
      last_snapshot_ms = now;
    }
  }

  delay(2); // reduz ruído/bounce sem aumentar a latência perceptível
}
