#include <Wire.h>
#include <SPI.h>
#include <MFRC522.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include "DHT.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <time.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, -1);

#define SS_PIN 5
#define RST_PIN 27
MFRC522 mfrc522(SS_PIN, RST_PIN);

#define DHTPIN 26
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);

#define GREEN_LED 25
#define YELLOW_LED 33
#define RED_LED 32
#define BUZZER_PIN 13

const char* ssid      = "BIMA SAKTI";
const char* password  = "Andreakanawa";
const char* serverURL = "http://192.168.100.25:3000/api/attendance";

// -------------------------------------------------------
// JAM MASUK & PULANG
// Ubah angka di bawah sesuai kebutuhan sekolah
// Format: jam dalam angka bulat, menit dalam angka bulat
// -------------------------------------------------------
const int JAM_MASUK_H   = 6;   // Jam masuk = 06:30
const int JAM_MASUK_M   = 30;
const int JAM_TELAT_H   = 6;   // Batas telat = 06:30 (sama dengan jam masuk)
const int JAM_TELAT_M   = 30;  // Lewat jam ini = TELAT
const int JAM_PULANG_H  = 15;  // Jam pulang = 15:20
const int JAM_PULANG_M  = 20;

// -------------------------------------------------------
// THRESHOLD CUACA UNTUK DATA ANALYST
// Ubah nilai di bawah sesuai kondisi lokal
// Humidity > HUJAN_HUMIDITY dianggap kondisi hujan/lembab
// Temp < HUJAN_TEMP dianggap cuaca dingin/hujan
// -------------------------------------------------------
const float HUJAN_HUMIDITY = 85.0;  // % - ubah sesuai kebutuhan
const float HUJAN_TEMP     = 24.0;  // °C - ubah sesuai kebutuhan

unsigned long lastDHTRead     = 0;
unsigned long lastClockUpdate = 0;
const unsigned long dhtInterval   = 10000;
const unsigned long clockInterval = 1000;

float lastTemp = 0;
float lastHum  = 0;

// -------- FORWARD DECLARATIONS --------
void showStudent(String name, String kelas, String status);
void showAlready(String name, String kelas);
void showWaiting();
void showScanning();
void showUnknown();
void showError();
void showClosed();


// -------- WIFI --------

void connectWiFi() {
  WiFi.begin(ssid, password);
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 20);
  display.println("Connecting WiFi...");
  display.display();

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi: " + WiFi.localIP().toString());
  display.clearDisplay();
  display.setCursor(0, 20);
  display.println("WiFi Connected!");
  display.println(WiFi.localIP().toString());
  display.display();
  delay(1500);
}


// -------- NTP TIME --------

void setupTime() {
  configTime(7 * 3600, 0, "pool.ntp.org", "time.nist.gov");
  Serial.print("Syncing time");

  struct tm timeinfo;
  while (!getLocalTime(&timeinfo)) {
    Serial.print(".");
    delay(500);
  }
  Serial.println("\nTime synced!");
}

String getTimeString() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) return "--:--:--";
  char buf[10];
  strftime(buf, sizeof(buf), "%H:%M:%S", &timeinfo);
  return String(buf);
}

String getDateString() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) return "--/--/----";
  char buf[12];
  strftime(buf, sizeof(buf), "%d/%m/%Y", &timeinfo);
  return String(buf);
}

// Ambil total menit dari tengah malam
int getCurrentMinutes() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) return 0;
  return timeinfo.tm_hour * 60 + timeinfo.tm_min;
}

// -------------------------------------------------------
// CEK STATUS KEHADIRAN
// Returns: "tepat_waktu", "telat", "ga_masuk", "pulang"
// "pulang"    = scan saat jam pulang (15:20)
// "ga_masuk"  = scan di luar jam masuk dan pulang
// "telat"     = scan setelah batas jam masuk
// "tepat_waktu" = scan sebelum atau tepat jam masuk
// -------------------------------------------------------
String getAttendanceStatus() {
  int now        = getCurrentMinutes();
  int masuk      = JAM_MASUK_H  * 60 + JAM_MASUK_M;
  int telat      = JAM_TELAT_H  * 60 + JAM_TELAT_M;
  int pulang     = JAM_PULANG_H * 60 + JAM_PULANG_M;

  // Jam pulang (15:20) — toleransi ±10 menit
  if (now >= pulang - 10 && now <= pulang + 10) {
    return "pulang";
  }

  // Sebelum atau tepat jam masuk
  if (now <= masuk) {
    return "tepat_waktu";
  }

  // Setelah jam masuk tapi sebelum jam pulang = telat
  if (now > telat && now < pulang - 10) {
    return "telat";
  }

  // Di luar semua range = ga masuk / scan tidak valid
  return "ga_masuk";
}

// -------------------------------------------------------
// CEK KONDISI HUJAN BERDASARKAN SENSOR DHT22
// Untuk data analyst: korelasi cuaca dengan kehadiran
// Humidity tinggi + suhu rendah = kemungkinan hujan
// -------------------------------------------------------
String getWeatherCondition() {
  if (lastHum > HUJAN_HUMIDITY && lastTemp < HUJAN_TEMP) {
    return "hujan";
  } else if (lastHum > HUJAN_HUMIDITY) {
    return "lembab";
  } else if (lastTemp > 32.0) {
    // -------------------------------------------------------
    // Ubah 32.0 sesuai threshold panas di lokasi kamu
    // -------------------------------------------------------
    return "panas";
  } else {
    return "normal";
  }
}


// -------- SEND & GET RESPONSE --------

String sendAndGetResponse(String uid) {
  if (WiFi.status() != WL_CONNECTED) return "error";

  String attendanceStatus = getAttendanceStatus();
  String weatherCondition = getWeatherCondition();

  HTTPClient http;
  http.begin(serverURL);
  http.addHeader("Content-Type", "application/json");

  StaticJsonDocument<256> doc;
  doc["uid"]         = uid;
  doc["temperature"] = lastTemp;
  doc["humidity"]    = lastHum;
  doc["time"]        = getTimeString();
  doc["date"]        = getDateString();
  doc["status"]      = attendanceStatus;
  doc["weather"]     = weatherCondition;

  String payload;
  serializeJson(doc, payload);
  Serial.println("Sending: " + payload);

  int httpCode = http.POST(payload);
  Serial.println("HTTP Code: " + String(httpCode));

  if (httpCode != 200) {
    http.end();
    return "error";
  }

  String response = http.getString();
  Serial.println("Response: " + response);
  http.end();

  StaticJsonDocument<256> res;
  DeserializationError err = deserializeJson(res, response);

  if (err) {
    Serial.println("JSON parse error: " + String(err.c_str()));
    return "error";
  }

  String serverStatus = res["status"].as<String>();

  if (serverStatus == "found") {
    String name         = res["name"].as<String>();
    String kelas        = res["class"].as<String>();
    String finalStatus  = res["attendance_status"].as<String>();
    showStudent(name, kelas, finalStatus);
  }

  if (serverStatus == "already") {
    String name  = res["name"].as<String>();
    String kelas = res["class"].as<String>();
    showAlready(name, kelas);
  }

  if (serverStatus == "closed") {
    showClosed();
  }

  return serverStatus;
}


// -------- DISPLAY FUNCTIONS --------

void showWaiting() {
  display.clearDisplay();
  display.setTextSize(2);
  display.setCursor(0, 0);
  display.println("Waiting");
  display.setTextSize(1);
  display.setCursor(0, 40);
  display.println(getDateString());
  display.setCursor(0, 52);
  display.println(getTimeString());
  display.display();
}

void showScanning() {
  display.clearDisplay();
  display.setTextSize(2);
  display.setCursor(0, 20);
  display.println("Scanning");
  display.display();
}

void showStudent(String name, String kelas, String status) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("Name: " + name);
  display.println("Class: " + kelas);
  display.println("Time: " + getTimeString());

  // Tampilkan status dengan label yang jelas
  if (status == "tepat_waktu") {
    display.println("Status: Tepat Waktu");
  } else if (status == "telat") {
    display.println("Status: TELAT!");
  } else if (status == "pulang") {
    display.println("Status: Pulang");
  } else {
    display.println("Status: " + status);
  }

  display.display();
}

void showAlready(String name, String kelas) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 0);
  display.println("Name: " + name);
  display.println("Class: " + kelas);
  display.println("");
  display.println("Sudah Absen!");
  display.print("Time: ");
  display.println(getTimeString());
  display.display();
}

void showUnknown() {
  display.clearDisplay();
  display.setTextSize(2);
  display.setCursor(0, 20);
  display.println("Unknown!");
  display.display();
}

void showClosed() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setCursor(0, 20);
  display.println("Absen Ditutup");
  display.println("Di luar jam sekolah");
  display.display();
}

void showError() {
  display.clearDisplay();
  display.setTextSize(2);
  display.setCursor(0, 20);
  display.println("No Signal");
  display.display();
}


// -------- BUZZER FUNCTIONS --------

void playGreenMelody() {
  for (int i = 0; i < 3; i++) {
    digitalWrite(BUZZER_PIN, HIGH); delay(120);
    digitalWrite(BUZZER_PIN, LOW);  delay(120);
  }
}

void playYellowMelody() {
  for (int i = 0; i < 2; i++) {
    digitalWrite(BUZZER_PIN, HIGH); delay(250);
    digitalWrite(BUZZER_PIN, LOW);  delay(200);
  }
}

void playRedMelody() {
  digitalWrite(BUZZER_PIN, HIGH); delay(800);
  digitalWrite(BUZZER_PIN, LOW);
}

void playUnknownBuzzer() {
  for (int i = 0; i < 10; i++) {
    digitalWrite(BUZZER_PIN, HIGH); delay(80);
    digitalWrite(BUZZER_PIN, LOW);  delay(80);
  }
}

void playTelatMelody() {
  // Bunyi panjang 1x lalu pendek 2x = tanda telat
  digitalWrite(BUZZER_PIN, HIGH); delay(500);
  digitalWrite(BUZZER_PIN, LOW);  delay(200);
  for (int i = 0; i < 2; i++) {
    digitalWrite(BUZZER_PIN, HIGH); delay(150);
    digitalWrite(BUZZER_PIN, LOW);  delay(150);
  }
}


// -------- SETUP --------

void setup() {
  Serial.begin(115200);

  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("OLED not found");
    while (true);
  }
  display.setTextColor(SSD1306_WHITE);

  connectWiFi();
  setupTime();

  SPI.begin();
  mfrc522.PCD_Init();
  Serial.println("RFID Ready");

  dht.begin();

  pinMode(GREEN_LED,  OUTPUT);
  pinMode(YELLOW_LED, OUTPUT);
  pinMode(RED_LED,    OUTPUT);
  pinMode(BUZZER_PIN, OUTPUT);

  showWaiting();
}


// -------- LOOP --------

void loop() {
  unsigned long currentMillis = millis();

  // ---- DHT every 10 sec ----
  if (currentMillis - lastDHTRead >= dhtInterval) {
    float temp = dht.readTemperature();
    float hum  = dht.readHumidity();
    if (!isnan(temp) && !isnan(hum)) {
      lastTemp = temp;
      lastHum  = hum;
      Serial.printf("Temp: %.1f C, Hum: %.1f%%\n", temp, hum);
    }
    lastDHTRead = currentMillis;
  }

  // ---- Update clock every 1 sec ----
  if (currentMillis - lastClockUpdate >= clockInterval) {
    if (!mfrc522.PICC_IsNewCardPresent()) {
      showWaiting();
    }
    lastClockUpdate = currentMillis;
  }

  // ---- RFID ----
  if (!mfrc522.PICC_IsNewCardPresent()) return;
  if (!mfrc522.PICC_ReadCardSerial())   return;

  showScanning();

  String uid = "";
  for (byte i = 0; i < mfrc522.uid.size; i++) {
    if (mfrc522.uid.uidByte[i] < 0x10) uid += "0";
    uid += String(mfrc522.uid.uidByte[i], HEX);
    if (i != mfrc522.uid.size - 1) uid += " ";
  }
  uid.toUpperCase();
  Serial.println("Card: " + uid);

  String result = sendAndGetResponse(uid);

  if (result == "found") {
    String attStatus = getAttendanceStatus();
    if (attStatus == "telat") {
      digitalWrite(YELLOW_LED, HIGH);
      playTelatMelody();
      digitalWrite(YELLOW_LED, LOW);
    } else {
      digitalWrite(GREEN_LED, HIGH);
      playGreenMelody();
      digitalWrite(GREEN_LED, LOW);
    }

  } else if (result == "already") {
    digitalWrite(YELLOW_LED, HIGH);
    playYellowMelody();
    digitalWrite(YELLOW_LED, LOW);

  } else if (result == "unknown") {
    showUnknown();
    digitalWrite(RED_LED, HIGH);
    playUnknownBuzzer();
    digitalWrite(RED_LED, LOW);

  } else if (result == "closed") {
    digitalWrite(RED_LED, HIGH);
    playRedMelody();
    digitalWrite(RED_LED, LOW);

  } else {
    showError();
    digitalWrite(RED_LED, HIGH);
    playRedMelody();
    digitalWrite(RED_LED, LOW);
  }

  delay(3000);
  showWaiting();
  mfrc522.PICC_HaltA();
}