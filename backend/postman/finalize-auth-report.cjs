'use strict';

const fs=require('fs');
const path=require('path');
const root=__dirname;
const file=path.join(root,'reports/auth-test-results.json');
const report=JSON.parse(fs.readFileSync(file,'utf8'));
const checks=['security-check-results.json','frontend-auth-results.json'].map(name=>({file:name,...JSON.parse(fs.readFileSync(path.join(root,'reports',name),'utf8'))}));
report.additionalChecks=checks;
report.overallCounts={total:report.counts.total+checks.reduce((n,c)=>n+c.counts.total,0),pass:report.counts.pass+checks.reduce((n,c)=>n+c.counts.pass,0),fail:report.counts.fail+checks.reduce((n,c)=>n+c.counts.fail,0),blocked:report.counts.blocked};
fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');
const doc=path.join(root,'AUTH_TEST_REPORT.md');
let text=fs.readFileSync(doc,'utf8').split('\n## Kiểm tra bổ sung')[0];
text+='\n## Kiểm tra bổ sung\n\n';
for(const check of checks){
    text+=`[${check.file}](reports/${check.file}) — ${check.counts.pass}/${check.counts.total} PASS, ${check.counts.fail} FAIL. Phạm vi: ${check.scope}.\n\n`;
    text+='| Check | Trạng thái | Lý do |\n| --- | --- | --- |\n'+check.results.map(r=>`| ${r.name} | ${r.status} | ${r.reason||'Đã thực thi và đạt assertion'} |`).join('\n')+'\n\n';
}
text+=`Tổng hợp cả Newman, ma trận bảo vệ/WebSocket và frontend: **${report.overallCounts.total} ca, PASS ${report.overallCounts.pass}, FAIL ${report.overallCounts.fail}, BLOCKED ${report.overallCounts.blocked}**. Không cộng kiểm tra cú pháp/schema vào số test hành vi. Các kết quả có timestamp riêng trong JSON.\n\n`;
text+='## File triển khai\n\n- Backend thêm: src/config/auth.js, src/services/auth.js, src/middleware/authenticate.js, src/routes/auth.js, src/app.js, scripts/configure-auth.cjs.\n- Backend sửa: server.js, src/realtime/mqtt.js (trả interval handle để dọn runtime test), src/realtime/websocket.js (auth trước broadcast), src/middleware/error-handler.js (không log body/credential), package.json/package-lock.json, .env.example; .env riêng có secret/hash, không commit.\n- Frontend sửa: frontend/js/api.js — login dialog, Bearer headers, auth WebSocket, logout; không sửa profile.css/profile.js có thay đổi sẵn của người dùng.\n- Postman thêm/cập nhật: hai file IoT Collection/Environment; đồng bộ hai tên SensoSynch cũ; generate.cjs, validate.cjs, auth-run.cjs, run.cjs, security-check.cjs, frontend-auth-check.cjs, finalize-auth-report.cjs, package.json và test-cases.json; AUTH_TEST_REPORT.md, API_REFERENCE.md, README.md, reports/auth-test-results.json và các báo cáo bổ sung.\n\nChưa kiểm tra trực quan giao diện trong trình duyệt; frontend đã kiểm tra hành vi bằng VM/stubs. Không có valid LED POST tới hệ thống thật. Bốn FAIL ở kiểm thử hồi quy là các lỗi parser/date cũ, không phải JWT vượt qua middleware.\n';
fs.writeFileSync(doc,text);
console.log(JSON.stringify({newman:report.counts,auth:report.authCounts,overall:report.overallCounts},null,2));
