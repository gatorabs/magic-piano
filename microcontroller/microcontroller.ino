void setup() {
  Serial.begin(115200);

  // Entradas com pull-up habilitado (ativo em baixo):
  DDRA = 0x00; PORTA = 0xFF;
  DDRB = 0x00; PORTB = 0xFF;
  DDRC = 0x00; PORTC = 0xFF;
  DDRD = 0x00; PORTD = 0xFF;
  DDRE = 0x00; PORTE = 0xFF;
  DDRF = 0x00; PORTF = 0xFF;
}

static inline uint8_t read_port(uint8_t idx) {
  switch (idx) {
    case 0: return ~PINA;
    case 1: return ~PINB;
    case 2: return ~PINC;
    case 3: return ~PIND;
    case 4: return ~PINE;
    default: return ~PINF; // idx == 5
  }
}

void loop() {
  uint8_t cur[6];
  for (uint8_t p = 0; p < 6; ++p) cur[p] = read_port(p);

  // Estado anterior (estático na RAM)
  static uint8_t prev[6] = {0,0,0,0,0,0};

  // Calcula difs e emite eventos de mudança
  for (uint8_t p = 0; p < 6; ++p) {
    uint8_t diff = cur[p] ^ prev[p];
    while (diff) {
      uint8_t bit = __builtin_ctz(diff);  // índice do primeiro bit 1
      diff &= (diff - 1);                  // limpa esse bit
      uint8_t key   = (p * 8) + bit;       // 0..47
      uint8_t state = (cur[p] >> bit) & 1; // 1=pressionada, 0=solta
      uint8_t evt   = (state << 7) | (key & 0x3F);
      Serial.write(&evt, 1);
    }
    prev[p] = cur[p];
  }
}
