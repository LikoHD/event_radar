// 存储捕获的埋点数据
let capturedEvents = [];
let isCapturing = false;

// 性能优化配置
const MAX_EVENTS = 1000; // 最大事件数量
const CLEANUP_THRESHOLD = 1200; // 清理阈值
const UPDATE_DEBOUNCE_TIME = 100; // 更新防抖时间(ms)

// 防抖和批量更新相关变量
let updateTimeout = null;
let pendingUpdates = false;

// 监听网络请求
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    if (!isCapturing) return;
    
    // 只捕获POST请求且URL包含list的请求
    if (details.method === "POST" && details.url.includes("list")) {
      try {
        // 尝试解析请求体
        const requestBody = details.requestBody;
        if (requestBody && requestBody.raw) {
          // 改进的解码方式，更好地处理中文字符
          let postedString;
          try {
            // 首先尝试使用TextDecoder进行UTF-8解码
            const decoder = new TextDecoder('utf-8');
            postedString = decoder.decode(new Uint8Array(requestBody.raw[0].bytes));
          } catch (e) {
            // 如果UTF-8解码失败，回退到原来的方式
            try {
              postedString = decodeURIComponent(String.fromCharCode.apply(null,
                new Uint8Array(requestBody.raw[0].bytes)));
            } catch (e2) {
              // 如果都失败了，直接转换为字符串
              postedString = String.fromCharCode.apply(null,
                new Uint8Array(requestBody.raw[0].bytes));
            }
          }
          
          // 存储请求信息
          const eventData = {
            id: Date.now(),
            timestamp: new Date().toISOString(),
            url: details.url,
            requestData: postedString,
            headers: null, // 请求头在onSendHeaders中获取
            status: "pending"
          };
          
          capturedEvents.unshift(eventData); // 新事件放在前面
          
          // 检查并清理过多的事件
          cleanupEventsIfNeeded();
          
          // 防抖更新面板
          debouncedUpdatePanel();
        }
      } catch (error) {
       
      }
    }
  },
  { urls: ["<all_urls>"] },
  ["requestBody"]
);

// 获取请求头信息
chrome.webRequest.onSendHeaders.addListener(
  (details) => {
    if (!isCapturing) return;
    
    if (details.method === "POST" && details.url.includes("list")) {
      // 查找匹配的请求并添加头信息
      const event = capturedEvents.find(e => e.url === details.url && !e.headers);
      if (event) {
        event.headers = details.requestHeaders;
        debouncedUpdatePanel();
      }
    }
  },
  { urls: ["<all_urls>"] },
  ["requestHeaders"]
);

// 更新请求状态
chrome.webRequest.onCompleted.addListener(
  (details) => {
    if (details.method === "POST" && details.url.includes("list")) {
      // 查找匹配的请求并更新状态
      const event = capturedEvents.find(e => e.url === details.url && e.status === "pending");
      if (event) {
        event.status = details.statusCode;
        event.statusText = details.statusLine;
        debouncedUpdatePanel();
      }
    }
  },
  { urls: ["<all_urls>"] }
);

// 清理过多的事件
function cleanupEventsIfNeeded() {
  if (capturedEvents.length >= CLEANUP_THRESHOLD) {
    // 保留最新的MAX_EVENTS个事件
    capturedEvents = capturedEvents.slice(0, MAX_EVENTS);
    console.log(`事件数量已清理，当前保留 ${capturedEvents.length} 个事件`);
  }
}

// 防抖更新面板
function debouncedUpdatePanel() {
  if (updateTimeout) {
    clearTimeout(updateTimeout);
  }
  
  pendingUpdates = true;
  updateTimeout = setTimeout(() => {
    if (pendingUpdates) {
      updatePanel();
      pendingUpdates = false;
    }
  }, UPDATE_DEBOUNCE_TIME);
}

// 更新侧边栏面板
function updatePanel() {
  chrome.runtime.sendMessage({
    action: "updateEvents",
    events: capturedEvents
  }).catch(error => {
    // 忽略消息传递错误
    console.debug("面板更新消息发送失败，可能面板未打开", error);
  });
}

// 监听来自面板的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "getEvents") {
    sendResponse({ events: capturedEvents });
  } else if (message.action === "clearEvents") {
    capturedEvents = [];
    debouncedUpdatePanel();
    sendResponse({ success: true });
  } else if (message.action === "startCapturing") {
    isCapturing = true;
    sendResponse({ success: true, isCapturing });
  } else if (message.action === "stopCapturing") {
    isCapturing = false;
    sendResponse({ success: true, isCapturing });
  } else if (message.action === "getStatus") {
    sendResponse({ isCapturing });
  } else if (message.action === "resizePanel") {
    // 调整面板宽度
    resizeInPagePanel(message.width);
    sendResponse({ success: true });
  }
  return true;
});

// 当用户点击扩展图标时，直接注入页面内面板
chrome.action.onClicked.addListener(async (tab) => {
  // 确保在有效的标签页上
  if (!tab || !tab.id) {
    console.error("无效的标签页");
    return;
  }

  try {
    // 直接注入页面内面板
    await injectInPagePanel(tab.id);
  } catch (error) {
    console.error("注入页面内面板失败:", error);
    // 如果注入失败，尝试创建新标签页
    try {
      chrome.tabs.create({ url: "panel.html" });
    } catch (e) {
      console.error("创建标签页失败:", e);
    }
  }
});

// 注入页面内面板
async function injectInPagePanel(tabId) {
  try {
    // 注入CSS
    await chrome.scripting.insertCSS({
      target: { tabId },
      files: ["in-page-panel.css"]
    });
    
    // 注入HTML和JS
    await chrome.scripting.executeScript({
      target: { tabId },
      function: createInPagePanel
    });
    
    console.log("页面内面板已注入");
  } catch (error) {
    console.error("注入页面内面板失败:", error);
    throw error;
  }
}

// 创建页面内面板的函数
function createInPagePanel() {
  // 检查是否已存在面板
  if (document.getElementById('tea-event-radar-panel')) {
    document.getElementById('tea-event-radar-panel').style.display = 'block';
    document.getElementById('tea-event-radar-panel').classList.remove('hidden');
    return;
  }
  
  // 创建面板容器
  const panelContainer = document.createElement('div');
  panelContainer.id = 'tea-event-radar-panel';
  panelContainer.style.cssText = `
    position: fixed;
    top: 0;
    right: 0;
    width: 400px;
    height: 100vh;
    background-color: #fff;
    box-shadow: -2px 0 10px rgba(0, 0, 0, 0.1);
    z-index: 9999999;
    border-left: 1px solid #ddd;
    display: flex;
    flex-direction: column;
  `;
  
  // 创建iframe加载面板
  const iframe = document.createElement('iframe');
  iframe.src = chrome.runtime.getURL('panel.html');
  iframe.style.cssText = `
    width: 100%;
    height: 100%;
    border: none;
    overflow: hidden;
  `;
  
  // 创建关闭按钮
  const closeBtn = document.createElement('div');
  closeBtn.className = 'tea-event-radar-close-btn';
  closeBtn.innerHTML = '✕';
  closeBtn.addEventListener('click', () => {
    panelContainer.classList.add('hidden');
    setTimeout(() => {
      panelContainer.style.display = 'none';
    }, 300);
  });
  
  // 添加到面板
  panelContainer.appendChild(iframe);
  panelContainer.appendChild(closeBtn);
  
  // 添加到页面
  document.body.appendChild(panelContainer);
}

// 初始化扩展
function initializeExtension() {
  console.log("Tea Event Radar 服务工作者已启动");
}

// 防抖变量
let resizeTimeout = null;
let lastResizeWidth = null;

// 调整页面内面板宽度（防抖优化）
function resizeInPagePanel(width) {
  // 如果宽度没有变化，直接返回
  if (lastResizeWidth === width) {
    return;
  }
  
  // 清除之前的延时调用
  if (resizeTimeout) {
    clearTimeout(resizeTimeout);
  }
  
  // 使用防抖机制，减少频繁调用
  resizeTimeout = setTimeout(() => {
    lastResizeWidth = width;
    
    // 向所有标签页发送调整宽度的消息
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          action: 'resizePanel',
          width: width
        }).catch(() => {
          // 忽略消息发送失败的情况（标签页可能没有注入面板）
        });
      });
    });
  }, 10); // 10ms防抖延迟
}

// 启动初始化
initializeExtension(); 