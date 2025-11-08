// SHORT SCAN para J1 + J2 — Mega2560
// Detecta se alguma linha (entre 24 pinos) está eletricamente colada a outra.
// 1) Todas como INPUT_PULLUP;
// 2) Uma por vez vira OUTPUT LOW;
// 3) Se outras lerem LOW -> curto/cruzamento.

#define BAUD 115200

// J1 e J2 (24 linhas)
const uint8_t pins[] = {
  // J1 (impares)
  3,5,7,9,11,13,15,17,19,21,23,25,
  // J2 (pares)
  2,4,6,8,10,12,14,16,18,20,22,24
};

const uint8_t N = sizeof(pins)/sizeof(pins[0]);

void setup() {
  Serial.begin(BAUD);
  delay(200);
  Serial.println(F("=== SHORT SCAN J1+J2 (D2..D25) ==="));
  for (uint8_t i=0;i<N;i++){ pinMode(pins[i], INPUT_PULLUP); }
}

void driveOneLow(uint8_t k){
  // todas INPUT_PULLUP, a k-ésima vira OUTPUT LOW
  for (uint8_t i=0;i<N;i++){ pinMode(pins[i], INPUT_PULLUP); }
  pinMode(pins[k], OUTPUT);
  digitalWrite(pins[k], LOW);
  delay(2);
}

void loop() {
  bool any=false;
  for (uint8_t k=0;k<N;k++){
    driveOneLow(k);
    for (uint8_t j=0;j<N;j++){
      int v = digitalRead(pins[j]); // 0=LOW, 1=HIGH
      if (j!=k && v==LOW){
        Serial.print(F("[ALERTA] CURTO/CRUZAMENTO entre "));
        Serial.print(F("pino ")); Serial.print(pins[k]);
        Serial.print(F(" e pino ")); Serial.println(pins[j]);
        any=true;
      }
    }
  }
  if(!any) Serial.println(F("Nenhum curto detectado entre J1 e J2."));
  delay(1000);
}
