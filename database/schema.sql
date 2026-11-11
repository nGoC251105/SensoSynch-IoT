CREATE DATABASE IF NOT EXISTS sensosynch CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE sensosynch;
CREATE TABLE IF NOT EXISTS sensors (
 id INT AUTO_INCREMENT PRIMARY KEY,
 code VARCHAR(24) NOT NULL UNIQUE,
 type VARCHAR(24) NOT NULL UNIQUE,
 device_name VARCHAR(64) NOT NULL,
 unit VARCHAR(12) NOT NULL
);
CREATE TABLE IF NOT EXISTS devices (
 id INT PRIMARY KEY,
 code VARCHAR(24) NOT NULL UNIQUE,
 name VARCHAR(64) NOT NULL,
 current_state ENUM('ON','OFF') NOT NULL DEFAULT 'OFF',
 updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);
CREATE TABLE IF NOT EXISTS sensor_data (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 sensor_id INT NOT NULL,
 value DECIMAL(10,2) NOT NULL,
 measured_at DATETIME(3) NOT NULL,
 FOREIGN KEY (sensor_id) REFERENCES sensors(id),
 INDEX idx_sensor_time(sensor_id,measured_at),
 INDEX idx_time(measured_at)
);
CREATE TABLE IF NOT EXISTS action_history (
 id BIGINT AUTO_INCREMENT PRIMARY KEY,
 device VARCHAR(16) NOT NULL,
 action ENUM('ON','OFF') NOT NULL,
 status ENUM('PENDING','SUCCESS','FAILED') NOT NULL DEFAULT 'PENDING',
 requested_at DATETIME(3) NOT NULL,
 completed_at DATETIME(3) NULL,
 reason VARCHAR(180) NULL,
 INDEX idx_action_time(requested_at),
 INDEX idx_device_time(device, requested_at)
);
INSERT INTO sensors(code,type,device_name,unit) VALUES
 ('TEMP_01','Temperature','DHT11 Sensor','°C'),
 ('HUM_01','Humidity','DHT11 Sensor','%'),
 ('LIGHT_01','Light','Light Sensor','ADC')
 ON DUPLICATE KEY UPDATE code=VALUES(code);
INSERT INTO devices(id,code,name) VALUES
 (1,'LED1','LED 1'),(2,'LED2','LED 2')
 ON DUPLICATE KEY UPDATE code=VALUES(code);
