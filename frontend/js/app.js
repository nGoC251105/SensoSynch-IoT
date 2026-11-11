// SENSOSYNCH - APP: Điều hướng giữa các trang.
// app.js chỉ chịu trách nhiệm chuyển trang; logic mỗi trang nằm ở file riêng.
/** Hiển thị đúng trang đã được chọn, sau đó gắn sự kiện của trang đó. */
function render() {
    const page = state.page;
    document.body.classList.toggle('is-dashboard', page === 'dashboard');
    document.body.classList.toggle('is-history', page === 'history');
    document.body.classList.toggle('is-sensors', page === 'sensors');
    // Đánh dấu menu đang chọn.
    document.querySelectorAll('[data-page]').forEach(button => {
        button.classList.toggle('active', button.dataset.page === page);
    });
    // HTML của mỗi trang do module riêng cung cấp.
    const pages = { dashboard, sensors, history, profile };
    $('#main').innerHTML = pages[page]();
    // Khi innerHTML thay đổi phải gắn lại sự kiện click, hover cho trang mới.
    if (page === 'dashboard')
        bindDashboard();
    if (page === 'sensors')
        bindSensors();
    if (page === 'history')
        bindHistory();
}
// Click menu -> đổi trang -> render.
document.querySelectorAll('[data-page]').forEach(button => {
    button.onclick = () => {
        state.page = button.dataset.page;
        render();
        if(state.page==='dashboard')refreshDashboard();
        if(state.page==='sensors')loadSensors();
        if(state.page==='history')loadHistory();
    };
});
render(); // Hiển thị Dashboard lần đầu.
refreshDashboard();
connectRealtime();
