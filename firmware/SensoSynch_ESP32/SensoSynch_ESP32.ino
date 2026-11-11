#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <ArduinoJson.h>  // Arduino IDE > Library Manager > ArduinoJson (v7)

// Cac gia tri nay la cau hinh tren may cua ban. KHONG day mat khau len GitHub.
const char* WIFI_NAME = "RatOk";
const char* WIFI_PASSWORD = "00000000";
const char* MQTT_SERVER = "172.20.10.7"; // IP may tinh chay Mosquitto; kiem tra khi doi mang
const int MQTT_PORT = 1884;
const char* MQTT_USERNAME = "ngoc";
const char* MQTT_PASSWORD = "123456";
const char* SENSOR_TOPIC = "sensor/data";
const char* CONTROL_TOPIC = "device/control/+";
const char* STATUS_TOPIC = "device/status";

#define DHT_PIN 4
#define DHT_TYPE DHT11
#define LIGHT_PIN 34
#define LED_1_PIN 25
#define LED_2_PIN 26

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
void sendBothStates() {
  publishStatus("led1",digitalRead(LED_1_PIN)==HIGH,"SUCCESS",0);
  publishStatus("led2",digitalRead(LED_2_PIN)==HIGH,"SUCCESS",0);
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
  if(t!="device/control/1" && t!="device/control/2" && t!="device/control/all") return;
  const bool valid=action=="ON" || action=="OFF";
  const bool on=action=="ON";
  if(!valid) {
    publishStatus(t=="device/control/1"?"led1":t=="device/control/2"?"led2":"all",false,"FAILED",commandId);
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
  // ALL la 1 thao tac nguoi dung; backend doi DU 2 ACK led1,led2.
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
    sendBothStates();
  } else {Serial.printf("MQTT fail rc=%d\n",mqttClient.state());}
}
void sendSensorData() {
  if(!mqttClient.connected()) return;
  float humidity=dht.readHumidity();
  float temperature=dht.readTemperature();
  int light=analogRead(LIGHT_PIN);
  StaticJsonDocument<160> doc;
  if(!isnan(temperature) && temperature>=-40 && temperature<=80) doc["temperature"]=roundf(temperature*10)/10.0f;
  if(!isnan(humidity) && humidity>=0 && humidity<=100) doc["humidity"]=roundf(humidity*10)/10.0f;
  doc["light"]=light;
  char output[160];
  size_t n=serializeJson(doc,output,sizeof(output));
  if(!mqttClient.publish(SENSOR_TOPIC,(const uint8_t*)output,n,false)) Serial.println("Publish sensor loi");
  Serial.print("SENSOR -> ");Serial.println(output);
}
void setup() {
  Serial.begin(115200);
  pinMode(LED_1_PIN,OUTPUT);pinMode(LED_2_PIN,OUTPUT);
  digitalWrite(LED_1_PIN,LOW);digitalWrite(LED_2_PIN,LOW);
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
  if(now-lastStatus>=15000 && mqttClient.connected()) {lastStatus=now;sendBothStates();}
}
