#define BAUD 115200

struct KeyMap { uint8_t tecla; uint8_t pino; };

// === J1 ===
KeyMap mapa[] = {
  {  1, 23 }, {  2, 25 }, {  3, 19 }, {  4, 21 },
  {  5, 17 }, {  6, 15 }, {  7,  7 }, {  8, 13 },
  {  9,  5 }, { 10, 11 }, { 11,  3 }, { 12,  9 },

  // === J2 ===
  { 13, 22 }, { 14, 24 }, { 15, 18 }, { 16, 20 },
  { 17, 16 }, { 18, 14 }, { 19,  6 }, { 20, 12 },
  { 21,  4 }, { 22, 10 }, { 23,  2 }, { 24,  8 },

  // === J3 ===
  { 25, 46 }, { 26, 44 }, { 27, 48 }, { 28, 47 },
  { 29, 50 }, { 30, 52 }, { 31, 31 }, { 32, 26 },
  { 33, 29 }, { 34, 28 }, { 35, 27 }, { 36, 30 },

  // === J4 (novo) ===
  { 37, A4 }, { 38, A6 }, { 39, A8 }, { 40, A10 }, { 41, A12 },
  { 42, 32 }, { 43, 34 }, { 44, 36 }, { 45, 38 }, { 46, 40 }, { 47, 42 },
};

const uint8_t N_KEYS = sizeof(mapa) / sizeof(mapa[0]);
uint8_t lastState[N_KEYS];

void setup() {
  Serial.begin(BAUD);
  delay(200);

  for (uint8_t i = 0; i < N_KEYS; i++) {
    pinMode(mapa[i].pino, INPUT_PULLUP);     // pressionado = LOW
    lastState[i] = digitalRead(mapa[i].pino);
  }

  Serial.println(F("=== MAPEADOR POR TECLA (J1+J2+J3+J4) ==="));
}

void loop() {
  for (uint8_t i = 0; i < N_KEYS; i++) {
    uint8_t r = digitalRead(mapa[i].pino);
    if (r != lastState[i]) {
      lastState[i] = r;

      // Protocolo binário: 1 byte por evento
      //uint8_t key_id = mapa[i].tecla - 1;  // 0-based
      //uint8_t state  = (r == LOW);         // 1 = DOWN, 0 = UP
      //uint8_t evt    = (state << 7) | (key_id & 0x3F);
      //Serial.write(&evt, 1);

      // (para debug humano, descomente abaixo)
       Serial.print(mapa[i].tecla);
       Serial.println(r == LOW ? F("  DOWN") : F("  UP"));
    }
  }
  delay(1); // anti-bounce leve
}
