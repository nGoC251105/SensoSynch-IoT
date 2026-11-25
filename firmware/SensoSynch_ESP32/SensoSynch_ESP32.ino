#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <ArduinoJson.h>  // Arduino IDE > Library Manager > ArduinoJson (v7)

// Local settings are kept outside version control. See secrets.example.h.
#include "secrets.h"

const int MQTT_PORT = 1884;

const char* SENSOR_TOPIC = "sensor/data";
const char* CONTROL_TOPIC = "device/control/+";
const char* STATUS_TOPIC = "device/status";

#define DHT_PIN 4
#define DHT_TYPE DHT11
#define LIGHT_PIN 34
// Inverted by user request for the current LDR wiring; verify by cover/illuminate test.
// See ../LDR_CALIBRATION.md. Conversion belongs here, never in backend/frontend.
constexpr bool LIGHT_RAW_DECREASES_WHEN_BRIGHTER = true;
constexpr int LIGHT_ADC_MAX = 4095;
#define LED_1_PIN 25
#define LED_2_PIN 26
#define LED_3_PIN 27
#define LED_4_PIN 32

DHT dht(DHT_PIN, DHT_TYPE);
WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);
unsigned long lastSend=0, lastWifiTry=0, lastMqttTry=0, lastStatus=0;
const unsigned long SEND_INTERVAL=2000;

void publishStatus(const char* device,bool on,const char* result,unsigned long commandId=0) {
  if(!mqttClient.connected()) return;
  StaticJsonDocument<160> doc;
  doc["device"]=device;
  doc["state"]=on?"ON":"OFF";
  doc["status"]=result;
  doc["commandId"]=commandId;
  char output[160];
  size_t n=serializeJson(doc,output,sizeof(output));
  if(!mqttClient.publish(STATUS_TOPIC,(const uint8_t*)output,n,false)) Serial.println("Publish status loi");
  Serial.print("STATUS -> "); Serial.println(output);
}
void sendAllStates() {
  publishStatus("led1",digitalRead(LED_1_PIN)==HIGH,"SUCCESS",0);
  publishStatus("led2",digitalRead(LED_2_PIN)==HIGH,"SUCCESS",0);
  publishStatus("led3",digitalRead(LED_3_PIN)==HIGH,"SUCCESS",0);
  publishStatus("led4",digitalRead(LED_4_PIN)==HIGH,"SUCCESS",0);
}
void mqttCallback(char* topic,byte* payload,unsigned int length) {
  String message;
  for(unsigned int i=0;i<length;i++) message+=(char)payload[i];
  message.trim();
  String action=message;
  unsigned long commandId=0;
  if(message.startsWith("{")) {
    StaticJsonDocument<192> doc;
    if(deserializeJson(doc,message)) { Serial.println("JSON command loi");return; }
    action=doc["action"].as<String>();
    commandId=doc["commandId"] | 0UL;
  }
  action.toUpperCase();
  String t(topic);
  Serial.printf("CONTROL %s -> %s (id=%lu)\n",topic,action.c_str(),commandId);
  if(t!="device/control/1" && t!="device/control/2" &&
     t!="device/control/3" && t!="device/control/4" && t!="device/control/all") return;
  const bool valid=action=="ON" || action=="OFF";
  const bool on=action=="ON";
  if(!valid) {
    publishStatus(t=="device/control/1"?"led1":t=="device/control/2"?"led2":
                  t=="device/control/3"?"led3":t=="device/control/4"?"led4":"all",false,"FAILED",commandId);
    return;
  }
  if(t=="device/control/1" || t=="device/control/all") {
    digitalWrite(LED_1_PIN,on?HIGH:LOW);
    publishStatus("led1",on,"SUCCESS",commandId);
  }
  if(t=="device/control/2" || t=="device/control/all") {
    digitalWrite(LED_2_PIN,on?HIGH:LOW);
    publishStatus("led2",on,"SUCCESS",commandId);
  }
  if(t=="device/control/3" || t=="device/control/all") {
    digitalWrite(LED_3_PIN,on?HIGH:LOW);
    publishStatus("led3",on,"SUCCESS",commandId);
  }
  if(t=="device/control/4" || t=="device/control/all") {
    digitalWrite(LED_4_PIN,on?HIGH:LOW);
    publishStatus("led4",on,"SUCCESS",commandId);
  }
  // ALL is one command; backend waits for all four individual LED ACKs.
  if(t=="device/control/all") publishStatus("all",on,"SUCCESS",commandId);
}
void connectWiFi() {
  if(WiFi.status()==WL_CONNECTED || millis()-lastWifiTry<5000) return;
  lastWifiTry=millis(); WiFi.mode(WIFI_STA); WiFi.begin(WIFI_NAME,WIFI_PASSWORD);
  Serial.println("Dang ket noi WiFi...");
}
void connectMQTT() {
  if(WiFi.status()!=WL_CONNECTED || mqttClient.connected() || millis()-lastMqttTry<3000) return;
  lastMqttTry=millis();
  String id="ESP32-"+String((uint32_t)ESP.getEfuseMac(),HEX);
  if(mqttClient.connect(id.c_str(),MQTT_USERNAME,MQTT_PASSWORD)) {
    Serial.println("MQTT connected"); mqttClient.subscribe(CONTROL_TOPIC,1);
    sendAllStates();
  } else {Serial.printf("MQTT fail rc=%d\n",mqttClient.state());}
}
void sendSensorData() {
  if(!mqttClient.connected()) return;
  float humidity=dht.readHumidity();
  float temperature=dht.readTemperature();
  const int lightRaw=analogRead(LIGHT_PIN);
  const int lightDisplay=LIGHT_RAW_DECREASES_WHEN_BRIGHTER
      ? LIGHT_ADC_MAX-lightRaw : lightRaw;
  Serial.printf("LIGHT raw=%d display=%d inverted=%s\n",lightRaw,lightDisplay,
                LIGHT_RAW_DECREASES_WHEN_BRIGHTER?"yes":"no");
  StaticJsonDocument<160> doc;
  if(!isnan(temperature) && temperature>=-40 && temperature<=80) doc["temperature"]=roundf(temperature*10)/10.0f;
  if(!isnan(humidity) && humidity>=0 && humidity<=100) doc["humidity"]=roundf(humidity*10)/10.0f;
  doc["light"]=lightDisplay;
  char output[160];
  size_t n=serializeJson(doc,output,sizeof(output));
  if(!mqttClient.publish(SENSOR_TOPIC,(const uint8_t*)output,n,false)) Serial.println("Publish sensor loi");
  Serial.print("SENSOR -> ");Serial.println(output);
}
void setup() {
  Serial.begin(115200);
  Serial.println("SENSOSYNCH 4LED: GPIO25/26/27/32 | build " __DATE__ " " __TIME__);
  pinMode(LED_1_PIN,OUTPUT);
  pinMode(LED_2_PIN,OUTPUT);
  pinMode(LED_3_PIN, OUTPUT);
  pinMode(LED_4_PIN, OUTPUT);
  digitalWrite(LED_1_PIN,LOW);
  digitalWrite(LED_2_PIN,LOW);
  digitalWrite(LED_3_PIN, LOW);
  digitalWrite(LED_4_PIN, LOW);
  analogReadResolution(12); // Explicit 0..4095 ADC range, unit remains ADC.
  dht.begin(); WiFi.mode(WIFI_STA);
  mqttClient.setServer(MQTT_SERVER,MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setBufferSize(256);
  connectWiFi();
}
void loop() {
  connectWiFi();
  connectMQTT();
  if(mqttClient.connected())mqttClient.loop();
  const unsigned long now=millis();
  if(now-lastSend>=SEND_INTERVAL) {lastSend=now;sendSensorData();}
  // Khoi phuc trang thai sau khi backend restart, khong tao Action History.
  if(now-lastStatus>=15000 && mqttClient.connected()) {lastStatus=now;sendAllStates();}
}
