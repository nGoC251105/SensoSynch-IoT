// Giữ nguyên shape dữ liệu của giao diện V12; backend/MySQL là nguồn dữ liệu thật.
const $ = s => document.querySelector(s);
const state = {
 page:'dashboard',led1:false,led2:false,busy:false,
 sensorRows:[],chartRows:[],sensorTotal:0,
 logs:[],historyTotal:0,
 filterType:'all',sensorDate:'',sensorSort:'desc',sensorPage:1,sensorPageSize:10,
 actionFilter:'all',statusFilter:'all',historyDate:'',historyPage:1,historyPageSize:10,
 online:false,mqttConnected:false
};
let reading={temperature:'--',humidity:'--',light:'--'};
// Không tạo dữ liệu random; không lưu trạng thái LED vào localStorage.
