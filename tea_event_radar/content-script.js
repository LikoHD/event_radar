// 监听来自服务工作者的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "openSidePanel") {
    console.log("收到打开侧边栏的请求");
    
    // 尝试通过DOM操作或其他方式提示用户
    showNotification("请点击浏览器右侧的侧边栏图标打开插件面板");
    sendResponse({ success: true });
  } 
  else if (message.action === "showInPagePanel") {
    console.log("收到显示页面内面板的请求");
    
    // 检查是否已存在面板
    const existingPanel = document.getElementById('tea-event-radar-panel');
    if (existingPanel) {
      existingPanel.style.display = 'block';
      existingPanel.classList.remove('hidden');
    }
    
    sendResponse({ success: true });
  }
  return true;
});

// 显示通知
function showNotification(message) {
  // 检查是否已存在通知
  const existingNotification = document.getElementById('tea-event-radar-notification');
  if (existingNotification) {
    existingNotification.remove();
  }
  
  // 创建通知元素
  const notification = document.createElement("div");
  notification.id = 'tea-event-radar-notification';
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background-color: #4CAF50;
    color: white;
    padding: 16px;
    border-radius: 4px;
    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    z-index: 9999;
    max-width: 300px;
    animation: slideIn 0.3s ease;
  `;
  
  // 添加动画样式
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes fadeOut {
      from { opacity: 1; }
      to { opacity: 0; }
    }
  `;
  document.head.appendChild(style);
  
  // 设置通知内容
  notification.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 8px;">Tea Event Radar</div>
    <div>${message}</div>
  `;
  
  // 添加关闭按钮
  const closeBtn = document.createElement('div');
  closeBtn.style.cssText = `
    position: absolute;
    top: 5px;
    right: 5px;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 14px;
  `;
  closeBtn.innerHTML = '✕';
  closeBtn.addEventListener('click', () => {
    notification.style.animation = 'fadeOut 0.3s ease forwards';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  });
  
  notification.appendChild(closeBtn);
  document.body.appendChild(notification);
  
  // 5秒后自动移除通知
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.animation = 'fadeOut 0.3s ease forwards';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }
  }, 5000);
}

console.log("Tea Event Radar 内容脚本已加载"); 