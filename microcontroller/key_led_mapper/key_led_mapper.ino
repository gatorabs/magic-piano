#include <Adafruit_NeoPixel.h>

// Número total de teclas e LEDs.
static const uint8_t  KEY_COUNT = 48;
static const uint16_t LED_COUNT = 296; // 4 oitavas * (7 brancas * 7 LEDs + 5 pretas * 5 LEDs)

// Ajuste o pino conforme a ligação da tira de LEDs.
static const uint8_t  LED_PIN = 6;

// Cores utilizadas.
static const uint32_t COLOR_WHITE = Adafruit_NeoPixel::Color(255, 255, 255);
static const uint32_t COLOR_RED   = Adafruit_NeoPixel::Color(255,   0,   0);

// Quantidade de LEDs por tecla dentro de uma oitava (C a B).
static const uint8_t LEDS_PER_KEY_PATTERN[12] = {
  7, // C  (branca)
  5, // C# (preta)
  7, // D  (branca)
  5, // D# (preta)
  7, // E  (branca)
  7, // F  (branca)
  5, // F# (preta)
  7, // G  (branca)
  5, // G# (preta)
  7, // A  (branca)
  5, // A# (preta)
  7  // B  (branca)
};

Adafruit_NeoPixel strip(LED_COUNT, LED_PIN, NEO_GRB + NEO_KHZ800);

// Vetores calculados dinamicamente no setup.
static uint16_t keyStart[KEY_COUNT];
static uint8_t  keyLength[KEY_COUNT];

static uint8_t currentKey = 0; // 0 = nenhuma tecla destacada.

void computeKeyMapping() {
  uint16_t cursor = 0;
  uint8_t keyIndex = 0;

  for (uint8_t octave = 0; octave < 4; ++octave) {
    for (uint8_t note = 0; note < 12; ++note) {
      if (keyIndex >= KEY_COUNT) {
        return;
      }
      uint8_t length = LEDS_PER_KEY_PATTERN[note];
      keyStart[keyIndex]  = cursor;
      keyLength[keyIndex] = length;
      cursor += length;
      ++keyIndex;
    }
  }
}

void renderKeyboard(uint8_t highlightKey) {
  for (uint16_t led = 0; led < LED_COUNT; ++led) {
    strip.setPixelColor(led, COLOR_WHITE);
  }

  if (highlightKey >= 1 && highlightKey <= KEY_COUNT) {
    uint8_t keyIdx = highlightKey - 1;
    uint16_t start = keyStart[keyIdx];
    uint8_t length = keyLength[keyIdx];

    for (uint16_t offset = 0; offset < length; ++offset) {
      strip.setPixelColor(start + offset, COLOR_RED);
    }
  }

  strip.show();
}

void setup() {
  Serial.begin(115200);
  Serial.setTimeout(10); // Evita bloqueios longos do parseInt.

  strip.begin();
  strip.show(); // Inicializa tudo apagado.

  computeKeyMapping();
  renderKeyboard(currentKey);

  Serial.println(F("Digite o número da tecla (1-48). Use 0 para limpar."));
}

void loop() {
  if (Serial.available() > 0) {
    int value = Serial.parseInt();

    if (value == 0) {
      currentKey = 0;
      renderKeyboard(currentKey);
      Serial.println(F("Nenhuma tecla destacada."));
    } else if (value >= 1 && value <= KEY_COUNT) {
      currentKey = static_cast<uint8_t>(value);
      renderKeyboard(currentKey);
      Serial.print(F("Tecla "));
      Serial.print(currentKey);
      Serial.print(F(" -> LEDs "));
      Serial.print(keyStart[currentKey - 1]);
      Serial.print(F(" a "));
      Serial.println(keyStart[currentKey - 1] + keyLength[currentKey - 1] - 1);
    } else {
      Serial.println(F("Valor inválido. Informe 0-48."));
    }

    // Consome qualquer caractere remanescente (como \n).
    while (Serial.available() > 0 && Serial.peek() <= ' ') {
      Serial.read();
    }
  }
}
