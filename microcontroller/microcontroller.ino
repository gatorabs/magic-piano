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

static uint8_t prev_state[6] = {0, 0, 0, 0, 0, 0};

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
}

void loop() {
  static uint32_t last_snapshot_ms = 0;

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
      uint8_t evt   = (state << 7) | (key & 0x3F);
      Serial.write(&evt, 1);
      changed_any = true;
    }
    prev_state[p] = cur[p];
  }

  // Envia snapshots periódicos para manter a aplicação sincronizada.
  uint32_t now = millis();
  if (changed_any || (now - last_snapshot_ms) > 500) {
    send_snapshot(cur);
    last_snapshot_ms = now;
  }

  delay(2); // reduz ruído/bounce sem aumentar a latência perceptível
}
