// DOM元素
const toggleBtn = document.getElementById('toggleBtn');
const toggleIcon = document.getElementById('toggleIcon');
const toggleText = document.getElementById('toggleText');
const clearBtn = document.getElementById('clearBtn');
const downloadBtn = document.getElementById('downloadBtn');
const searchInput = document.getElementById('searchInput');
const searchTags = document.getElementById('searchTags');
const filterMode = document.getElementById('filterMode');
const eventCount = document.getElementById('eventCount');
const noEvents = document.getElementById('noEvents');
const eventsList = document.getElementById('eventsList');
const resizeHandle = document.querySelector('.resize-handle');

// 存储所有事件数据
let allEvents = [];
let isCapturing = false;
let searchKeywords = []; // 存储搜索关键词
let currentFilterMode = 'include'; // 当前过滤模式

// 性能优化配置
const RENDER_DEBOUNCE_TIME = 50; // 渲染防抖时间(ms)
const SEARCH_DEBOUNCE_TIME = 200; // 搜索防抖时间(ms)
const MAX_VISIBLE_EVENTS = 100; // 最大可见事件数量

// 防抖和性能优化变量
let renderTimeout = null;
let searchTimeout = null;
let isRendering = false;

// 拖拽调整宽度相关变量
let isDragging = false;
let startX = 0;
let startWidth = 0;
let currentWidth = 400; // 当前宽度
let lastUpdateTime = 0; // 上次更新时间，用于防抖
const minWidth = 280; // 最小宽度
const maxWidth = 800; // 最大宽度
const defaultWidth = 400; // 默认宽度
const UPDATE_THROTTLE = 16; // 更新节流，约60fps

// 添加解码函数来处理中文字符乱码
function decodeChineseText(text) {
  if (typeof text !== 'string') {
    return text;
  }

  try {

    if (text.includes('%')) {
      try {
        const decoded = decodeURIComponent(text);
        if (decoded !== text && !decoded.includes('�')) {
          return decoded;
        }
      } catch (e) {
      }
    }

    if (/[àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿ]/.test(text)) {
      try {
        const bytes = [];
        for (let i = 0; i < text.length; i++) {
          const char = text.charCodeAt(i);
          if (char > 255) {

            bytes.push((char >> 8) & 0xFF);
            bytes.push(char & 0xFF);
          } else {
            bytes.push(char);
          }
        }


        const decoder = new TextDecoder('utf-8');
        const uint8Array = new Uint8Array(bytes);
        const decoded = decoder.decode(uint8Array);

        // 检查解码结果是否包含中文字符
        if (/[\u4e00-\u9fff]/.test(decoded)) {
          return decoded;
        }
      } catch (e) {

      }
    }

    try {
      const bytes = new Uint8Array(text.length);
      for (let i = 0; i < text.length; i++) {
        bytes[i] = text.charCodeAt(i) & 0xFF;
      }

      const decoder = new TextDecoder('utf-8');
      const decoded = decoder.decode(bytes);

      if (/[\u4e00-\u9fff]/.test(decoded) && !decoded.includes('�')) {
        return decoded;
      }
    } catch (e) {
    }

    return text;
  } catch (error) {
    console.warn('解码文本时出错:', error);
    return text;
  }
}

function decodeObjectStrings(obj) {
  if (typeof obj === 'string') {
    return decodeChineseText(obj);
  } else if (Array.isArray(obj)) {
    return obj.map(item => decodeObjectStrings(item));
  } else if (obj && typeof obj === 'object') {
    const decoded = {};
    for (const [key, value] of Object.entries(obj)) {
      decoded[decodeChineseText(key)] = decodeObjectStrings(value);
    }
    return decoded;
  }
  return obj;
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  // 初始化拖拽功能
  initResizeHandler();

  // 恢复保存的宽度
  restorePanelWidth();

  // 默认开始捕获
  chrome.runtime.sendMessage({ action: 'startCapturing' }, (response) => {
    if (response && response.success) {
      isCapturing = true;
      updateToggleButton();
    }
  });

  chrome.runtime.sendMessage({ action: 'getEvents' }, (response) => {
    if (response && response.events) {
      allEvents = response.events;
      renderEvents(allEvents);
      updateEventCount();
    }
  });

  const eventsContainer = document.querySelector('.events-container');
  let scrollTimeout;

  eventsContainer.addEventListener('scroll', () => {
    isUserInteracting = true;

    clearTimeout(scrollTimeout);

    // 1秒后恢复自动滚动
    scrollTimeout = setTimeout(() => {
      // 检查是否滚动到底部，如果是则恢复自动滚动
      const isAtBottom = Math.abs(eventsContainer.scrollHeight - eventsContainer.scrollTop - eventsContainer.clientHeight) < 10;
      if (isAtBottom) {
        isUserInteracting = false;
      }
    }, 1000);
  });
});

// 切换按钮点击事件
toggleBtn.addEventListener('click', () => {
  if (isCapturing) {
    // 当前正在捕获，点击后停止
    chrome.runtime.sendMessage({ action: 'stopCapturing' }, (response) => {
      if (response && response.success) {
        isCapturing = false;
        updateToggleButton();
      }
    });
  } else {
    // 当前已停止，点击后开始
    chrome.runtime.sendMessage({ action: 'startCapturing' }, (response) => {
      if (response && response.success) {
        isCapturing = true;
        updateToggleButton();
      }
    });
  }
});

clearBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'clearEvents' }, (response) => {
    if (response && response.success) {
      allEvents = [];
      // 清除展开状态记录
      expandedCards.clear();
      renderEvents(allEvents);
      updateEventCount();
      // 清除搜索关键词
      searchKeywords = [];
      renderSearchTags();
    }
  });
});

// CSV下载按钮事件
downloadBtn.addEventListener('click', () => {
  if (allEvents.length === 0) {
    showNotification('暂无数据可下载', 'warning');
    return;
  }

  // 设置下载状态
  downloadBtn.classList.add('downloading');
  downloadBtn.disabled = true;

  try {
    const csvData = generateCSV(allEvents);
    downloadCSV(csvData, `tea_events_${new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')}.csv`);

    // 显示成功状态
    downloadBtn.classList.remove('downloading');
    downloadBtn.classList.add('success');
    showNotification('CSV文件下载成功', 'success');

    // 2秒后恢复正常状态
    setTimeout(() => {
      downloadBtn.classList.remove('success');
      downloadBtn.disabled = false;
    }, 2000);
  } catch (error) {
    console.error('下载CSV失败:', error);
    downloadBtn.classList.remove('downloading');
    downloadBtn.disabled = false;
    showNotification('下载失败: ' + error.message, 'error');
  }
});

// 更新切换按钮状态
function updateToggleButton() {
  if (isCapturing) {
    toggleIcon.className = 'ri-pause-fill';
    toggleText.textContent = 'Stop';
    toggleBtn.classList.remove('btn-primary');
    toggleBtn.classList.add('btn-secondary');
  } else {
    toggleIcon.className = 'ri-play-fill';
    toggleText.textContent = 'RadarUp';
    toggleBtn.classList.remove('btn-secondary');
    toggleBtn.classList.add('btn-primary');
  }
}

// 搜索过滤 - 防抖优化
searchInput.addEventListener('input', (e) => {
  // 清除之前的搜索防抖
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }

  // 防抖搜索
  searchTimeout = setTimeout(() => {
    filterEvents();
  }, SEARCH_DEBOUNCE_TIME);
});

// 回车键添加搜索标签
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && searchInput.value.trim() !== '') {
    // 添加单个关键词作为标签
    const keyword = searchInput.value.trim().toLowerCase();

    // 如果关键词不存在，则添加
    if (!searchKeywords.includes(keyword)) {
      searchKeywords.push(keyword);
    }

    // 清空输入框
    searchInput.value = '';

    // 渲染搜索标签
    renderSearchTags();

    // 过滤事件
    filterEvents();
  }
});

// 监听过滤模式变化
filterMode.addEventListener('change', (e) => {
  currentFilterMode = e.target.value;
  filterEvents();
});

// 渲染搜索标签
function renderSearchTags() {
  searchTags.innerHTML = '';

  searchKeywords.forEach(keyword => {
    const tag = document.createElement('span');
    tag.className = 'search-tag';
    tag.innerHTML = `${keyword} <i class="ri-close-line"></i>`;

    // 点击删除标签
    tag.querySelector('i').addEventListener('click', () => {
      searchKeywords = searchKeywords.filter(k => k !== keyword);
      renderSearchTags();
      filterEvents();
    });

    searchTags.appendChild(tag);
  });
}

// 过滤事件 - 支持多种过滤模式
function filterEvents() {
  // 组合输入框中的关键词和已添加的标签关键词
  const inputStr = searchInput.value.trim().toLowerCase();
  const allKeywords = [...searchKeywords];

  // 支持输入框中以空格分隔的多个关键词
  if (inputStr) {
    inputStr.split(/\s+/).forEach(k => {
      if (k && !allKeywords.includes(k)) {
        allKeywords.push(k);
      }
    });
  }

  // 根据过滤模式进行过滤
  let filteredEvents = allEvents;

  if (allKeywords.length > 0) {
    switch (currentFilterMode) {
      case 'include':
        // 只看匹配：事件必须包含任意一个关键词
        filteredEvents = allEvents.filter(event => {
          const eventData = JSON.stringify(event).toLowerCase();
          return allKeywords.some(keyword => eventData.includes(keyword));
        });
        break;
      case 'exclude':
        // 排除匹配：事件不能包含任何关键词
        filteredEvents = allEvents.filter(event => {
          const eventData = JSON.stringify(event).toLowerCase();
          return !allKeywords.some(keyword => eventData.includes(keyword));
        });
        break;
      default:
        filteredEvents = allEvents;
        break;
    }
  }

  renderEvents(filteredEvents);
}

// 更新事件计数
function updateEventCount() {
  eventCount.textContent = allEvents.length;
}

// 监听来自background的消息
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'updateEvents' && message.events) {
    allEvents = message.events;
    updateEventCount();

    // 应用当前的过滤条件
    filterEvents();
  }
});

// 用于跟踪用户是否正在悬停事件卡片
let isUserInteracting = false;
let userInteractTimeout;
let isCardExpanded = false; // 是否有卡片处于展开状态
let expandedCards = new Set(); // 存储已展开卡片的ID

// 自动滚动到底部函数
function autoScrollToBottom() {
  if (!isUserInteracting && !isCardExpanded) {
    setTimeout(() => {
      if (!isUserInteracting && !isCardExpanded) {
        const eventsContainer = document.querySelector('.events-container');
        eventsContainer.scrollTop = eventsContainer.scrollHeight;
      }
    }, 100);
  }
}

// 防抖渲染事件列表
function renderEvents(events) {
  // 清除之前的渲染防抖
  if (renderTimeout) {
    clearTimeout(renderTimeout);
  }

  // 防抖渲染
  renderTimeout = setTimeout(() => {
    doRenderEvents(events);
  }, RENDER_DEBOUNCE_TIME);
}

// 实际渲染事件列表
function doRenderEvents(events) {
  // 防止重复渲染
  if (isRendering) return;
  isRendering = true;

  try {
    // 清空列表
    eventsList.innerHTML = '';

    // 显示或隐藏无事件提示
    if (events.length === 0) {
      noEvents.style.display = 'flex';
      eventsList.style.display = 'none';
      return;
    }

    noEvents.style.display = 'none';
    eventsList.style.display = 'flex';

    // 按时间顺序排序（旧 -> 新），确保最新事件位于底部
    const sortedEvents = [...events].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // 限制可见事件数量以提高性能
    const visibleEvents = sortedEvents.slice(-MAX_VISIBLE_EVENTS);

    // 使用DocumentFragment批量添加DOM元素
    const fragment = document.createDocumentFragment();

    // 渲染每个事件卡片
    visibleEvents.forEach(event => {
      const card = createEventCard(event);

      // 添加悬停事件监听（防抖）
      card.addEventListener('mouseenter', () => {
        clearTimeout(userInteractTimeout);
        isUserInteracting = true;
      });

      card.addEventListener('mouseleave', () => {
        // 500ms 后再恢复自动滚动，防止抖动
        userInteractTimeout = setTimeout(() => {
          isUserInteracting = false;
        }, 500);
      });

      fragment.appendChild(card);
    });

    // 批量添加到DOM
    eventsList.appendChild(fragment);

    // 如果事件被截断，显示提示
    if (sortedEvents.length > MAX_VISIBLE_EVENTS) {
      const truncateNotice = document.createElement('div');
      truncateNotice.className = 'truncate-notice';
      truncateNotice.innerHTML = `
        <div style="text-align: center; padding: 12px; color: var(--muted-foreground); font-size: 12px; background: var(--muted); border-radius: var(--radius); margin-bottom: 8px;">
          <i class="ri-information-line" style="margin-right: 4px;"></i>
          为了性能考虑，仅显示最新的 ${MAX_VISIBLE_EVENTS} 个事件（共 ${sortedEvents.length} 个）
        </div>
      `;
      eventsList.insertBefore(truncateNotice, eventsList.firstChild);
    }

    // 自动滚动到底部显示最新事件
    autoScrollToBottom();
  } finally {
    isRendering = false;
  }
}

// 创建事件卡片
function createEventCard(event) {
  const card = document.createElement('div');
  card.className = 'event-card';

  // 解析事件数据
  let eventName = '未知事件';
  let eventUser = '未知用户';
  let eventType = '';
  let parsedEvents = [];

  try {
    // 尝试解析请求数据
    if (event.requestData) {
      const requestData = JSON.parse(event.requestData);

      // 提取事件名称和用户信息
      if (requestData && requestData[0] && requestData[0].events) {
        parsedEvents = requestData[0].events;

        // 获取第一个事件的名称作为卡片标题
        if (parsedEvents.length > 0) {
          eventName = decodeChineseText(parsedEvents[0].event || '未知事件');

          // 根据事件名称确定类型标签
          if (eventName.includes('api')) {
            eventType = 'api';
          } else {
            eventType = 'event';
          }

          // 尝试从params中提取用户信息
          if (parsedEvents[0].params) {
            try {
              const params = JSON.parse(parsedEvents[0].params);
              const decodedParams = decodeObjectStrings(params);
              eventUser = decodedParams.user || '未知用户';
            } catch (e) {
              // 如果params不是JSON格式，尝试直接提取
              const paramsStr = decodeChineseText(parsedEvents[0].params.toString());
              const userMatch = paramsStr.match(/user[\"']?\s*:\s*[\"']([^\"']+)[\"']/i);
              if (userMatch && userMatch[1]) {
                eventUser = decodeChineseText(userMatch[1]);
              }
            }
          }
        }
      }

      // 如果没有从events中获取到用户信息，尝试从user字段获取
      if (eventUser === '未知用户' && requestData[0] && requestData[0].user) {
        eventUser = decodeChineseText(requestData[0].user.user_unique_id || '未知用户');
      }
    }
  } catch (error) {
  }

  // 创建卡片头部
  const header = document.createElement('div');
  header.className = 'event-header';

  // 格式化时间
  const eventTime = new Date(event.timestamp).toLocaleTimeString();

  // 创建左侧内容
  const headerLeft = document.createElement('div');
  headerLeft.className = 'event-header-left';

  // 添加事件名称和标签
  const nameContainer = document.createElement('div');
  nameContainer.innerHTML = `
    <span class="tag tag-${eventType}">${eventType.toUpperCase()}</span>
    <span class="event-name">${eventName}</span>
  `;
  headerLeft.appendChild(nameContainer);

  // 添加用户信息
  const userElem = document.createElement('div');
  userElem.className = 'event-user';
  userElem.textContent = `@${eventUser}`;
  headerLeft.appendChild(userElem);

  // 创建右侧内容
  const headerRight = document.createElement('div');
  headerRight.className = 'event-header-right';

  // 添加时间（不显示状态）
  headerRight.innerHTML = `
    <span class="event-time">${eventTime}</span>
  `;

  // 将左右两侧添加到头部
  header.appendChild(headerLeft);
  header.appendChild(headerRight);

  // 创建卡片内容
  const content = document.createElement('div');
  content.className = 'event-content';

  // 事件信息部分
  const eventsSection = document.createElement('div');
  eventsSection.className = 'event-section';

  // 创建标题和复制按钮
  const eventsSectionTitle = document.createElement('h3');
  eventsSectionTitle.className = 'event-section-title';
  eventsSectionTitle.innerHTML = `
    <span>事件信息</span>
    <button class="copy-btn" title="复制事件信息">
      <i class="ri-file-copy-line"></i>
    </button>
  `;
  eventsSection.appendChild(eventsSectionTitle);

  const eventDetailList = document.createElement('div');
  eventDetailList.className = 'event-detail-list';

  // 添加每个事件的详细信息
  if (parsedEvents.length > 0) {
    parsedEvents.forEach((evt, index) => {
      const eventDetail = document.createElement('div');
      eventDetail.className = 'event-detail-item';

      // 事件名称
      const eventNameElem = document.createElement('div');
      eventNameElem.className = 'event-param';
      const decodedEventName = decodeChineseText(evt.event || '未知');
      eventNameElem.innerHTML = `
        <span class="event-param-name">事件名称:</span>
        <span class="event-param-value">${decodedEventName}</span>
      `;
      eventDetail.appendChild(eventNameElem);

      // 事件参数
      if (evt.params) {
        try {
          const params = JSON.parse(evt.params);
          // 对参数进行解码处理
          const decodedParams = decodeObjectStrings(params);

          const paramsElem = document.createElement('div');
          paramsElem.className = 'event-param';
          paramsElem.innerHTML = `<span class="event-param-name">参数:</span>`;

          // 创建参数表格
          const paramsTable = document.createElement('table');
          paramsTable.className = 'params-table';

          // 创建表头和表体
          const tableHead = document.createElement('thead');
          tableHead.innerHTML = `
            <tr>
              <th>参数名</th>
              <th>值</th>
            </tr>
          `;

          const tableBody = document.createElement('tbody');

          // 添加参数行
          Object.entries(decodedParams).forEach(([key, value]) => {
            const row = document.createElement('tr');

            // 参数名列
            const keyCell = document.createElement('td');
            keyCell.textContent = key;
            row.appendChild(keyCell);

            // 参数值列
            const valueCell = document.createElement('td');
            const displayValue = typeof value === 'object' ? JSON.stringify(value, null, 2) : value;
            valueCell.textContent = displayValue;
            row.appendChild(valueCell);

            tableBody.appendChild(row);
          });

          paramsTable.appendChild(tableHead);
          paramsTable.appendChild(tableBody);
          paramsElem.appendChild(paramsTable);
          eventDetail.appendChild(paramsElem);
        } catch (e) {
          // 如果解析失败，尝试解码原始字符串后显示
          const decodedParams = decodeChineseText(evt.params);
          const paramsElem = document.createElement('div');
          paramsElem.className = 'event-param';
          paramsElem.innerHTML = `
            <span class="event-param-name">参数:</span>
            <span class="event-param-value">${decodedParams}</span>
          `;
          eventDetail.appendChild(paramsElem);
        }
      }

      eventDetailList.appendChild(eventDetail);
    });
  } else {
    const noEventsElem = document.createElement('div');
    noEventsElem.className = 'no-events-detail';
    noEventsElem.textContent = '无事件详情';
    eventDetailList.appendChild(noEventsElem);
  }

  eventsSection.appendChild(eventDetailList);
  content.appendChild(eventsSection);

  // 请求信息部分
  const requestSection = document.createElement('div');
  requestSection.className = 'event-section';
  requestSection.innerHTML = `<h3 class="event-section-title">请求信息</h3>`;

  const urlElem = document.createElement('div');
  urlElem.className = 'event-url';
  urlElem.textContent = event.url;
  requestSection.appendChild(urlElem);

  content.appendChild(requestSection);

  // 原始JSON部分
  const jsonSection = document.createElement('div');
  jsonSection.className = 'event-section';

  // 创建标题和复制按钮
  const jsonSectionTitle = document.createElement('h3');
  jsonSectionTitle.className = 'event-section-title';
  jsonSectionTitle.innerHTML = `
    <span>原始数据</span>
    <button class="copy-btn" title="复制原始数据">
      <i class="ri-file-copy-line"></i>
    </button>
  `;
  jsonSection.appendChild(jsonSectionTitle);

  const jsonViewer = document.createElement('pre');
  jsonViewer.className = 'json-viewer';

  let rawJsonData = '';
  try {
    // 格式化JSON并添加语法高亮
    const formattedJson = JSON.stringify(JSON.parse(event.requestData), null, 2);
    rawJsonData = formattedJson;
    jsonViewer.innerHTML = syntaxHighlight(formattedJson);
  } catch (e) {
    rawJsonData = event.requestData || '无数据';
    jsonViewer.textContent = rawJsonData;
  }

  jsonSection.appendChild(jsonViewer);
  content.appendChild(jsonSection);

  // 添加到卡片
  card.appendChild(header);
  card.appendChild(content);

  // 检查当前卡片是否之前已展开
  if (expandedCards.has(event.id)) {
    content.classList.add('active');
  }

  // 添加点击事件，展开/折叠卡片
  header.addEventListener('click', () => {
    content.classList.toggle('active');

    // 更新展开状态记录
    if (content.classList.contains('active')) {
      expandedCards.add(event.id);
    } else {
      expandedCards.delete(event.id);
    }

    // 更新是否有展开卡片
    isCardExpanded = document.querySelector('.event-content.active') !== null;

    // 如果所有卡片都已折叠，恢复自动滚动到底部
    if (!isCardExpanded) {
      autoScrollToBottom();
    }
  });

  // 添加复制按钮事件监听器
  // 事件信息复制按钮
  const eventCopyBtn = eventsSectionTitle.querySelector('.copy-btn');
  eventCopyBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // 阻止冒泡到卡片展开事件

    // 仅复制事件名称（每行一个）
    let eventNamesText = parsedEvents.map(p => p.event || '未知').join('\n');
    if (!eventNamesText) {
      eventNamesText = eventName; // 回退到主事件名称
    }
    copyToClipboard(eventNamesText, eventCopyBtn);
  });

  // 原始数据复制按钮
  const jsonCopyBtn = jsonSectionTitle.querySelector('.copy-btn');
  jsonCopyBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // 阻止冒泡到卡片展开事件
    copyToClipboard(rawJsonData, jsonCopyBtn);
  });

  return card;
}

// 复制到剪贴板功能 - 支持多种复制方式
function copyToClipboard(text, button) {
  const icon = button.querySelector('i');
  const originalClass = icon.className;

  // 方法1: 尝试使用现代剪贴板API
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showCopySuccess(icon, originalClass, button);
    }).catch(err => {
      console.warn('现代剪贴板API失败，尝试备用方法:', err);
      fallbackCopyToClipboard(text, icon, originalClass, button);
    });
  } else {
    // 方法2: 使用备用复制方法
    fallbackCopyToClipboard(text, icon, originalClass, button);
  }
}

// 备用复制方法
function fallbackCopyToClipboard(text, icon, originalClass, button) {
  try {
    // 创建临时文本区域
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    textArea.style.opacity = '0';
    textArea.style.pointerEvents = 'none';

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    // 尝试使用 document.execCommand
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);

    if (successful) {
      showCopySuccess(icon, originalClass, button);
    } else {
      // 如果 execCommand 也失败，显示文本选择提示
      showCopyFallback(text, icon, originalClass, button);
    }
  } catch (err) {
    console.error('备用复制方法失败:', err);
    showCopyFallback(text, icon, originalClass, button);
  }
}

// 显示复制成功状态
function showCopySuccess(icon, originalClass, button) {
  icon.className = 'ri-check-line';
  button.classList.add('copied');
  button.title = '复制成功！';

  setTimeout(() => {
    icon.className = originalClass;
    button.classList.remove('copied');
    button.title = '复制';
  }, 2000);
}

// 显示复制失败，提供手动复制选项
function showCopyFallback(text, icon, originalClass, button) {
  // 创建模态框显示文本供用户手动复制
  const modal = document.createElement('div');
  modal.className = 'tea-copy-modal';

  const modalContent = document.createElement('div');
  modalContent.className = 'tea-copy-modal-content';

  modalContent.innerHTML = `
    <h3>手动复制内容</h3>
    <p>由于权限限制，请手动选择并复制以下内容：</p>
    <textarea readonly>${text}</textarea>
    <div class="tea-copy-modal-footer">
      <button>关闭</button>
    </div>
  `;

  // 关闭按钮事件
  const closeBtn = modalContent.querySelector('button');
  closeBtn.addEventListener('click', () => {
    document.body.removeChild(modal);
  });

  // 点击背景关闭
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  });

  // 自动选择文本
  const textarea = modalContent.querySelector('textarea');
  setTimeout(() => {
    textarea.select();
    textarea.focus();
  }, 100);

  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // 更新按钮状态
  icon.className = 'ri-information-line';
  button.style.color = '#ffc107';
  button.title = '点击查看复制内容';

  setTimeout(() => {
    icon.className = originalClass;
    button.style.color = '';
    button.title = '复制';
  }, 3000);
}

// JSON语法高亮
function syntaxHighlight(json) {
  json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
    let cls = 'json-number';
    if (/^"/.test(match)) {
      if (/:$/.test(match)) {
        cls = 'json-key';
      } else {
        cls = 'json-string';
      }
    } else if (/true|false/.test(match)) {
      cls = 'json-boolean';
    } else if (/null/.test(match)) {
      cls = 'json-null';
    }
    return '<span class="' + cls + '">' + match + '</span>';
  });
}

// 初始化拖拽调整宽度功能
function initResizeHandler() {
  if (!resizeHandle) return;

  resizeHandle.addEventListener('mousedown', startResize, { passive: false });

  // 防止选中文本和右键菜单
  resizeHandle.addEventListener('selectstart', (e) => e.preventDefault());
  resizeHandle.addEventListener('contextmenu', (e) => e.preventDefault());

  // 添加双击重置宽度功能
  resizeHandle.addEventListener('dblclick', () => {
    currentWidth = defaultWidth;
    setPanelWidth(defaultWidth);
    savePanelWidth(defaultWidth);
  });
}

// 开始拖拽
function startResize(e) {
  isDragging = true;
  startX = e.clientX;
  startWidth = currentWidth;

  // 添加拖拽样式
  resizeHandle.classList.add('dragging');
  document.body.classList.add('resizing');

  // 动态添加事件监听器，只在拖拽时监听
  document.addEventListener('mousemove', doResize, { passive: false });
  document.addEventListener('mouseup', stopResize, { passive: false });

  // 防止拖拽时的默认行为
  e.preventDefault();
  e.stopPropagation();
}

// 执行拖拽
function doResize(e) {
  if (!isDragging) return;

  // 性能优化：节流更新
  const now = Date.now();
  if (now - lastUpdateTime < UPDATE_THROTTLE) {
    return;
  }
  lastUpdateTime = now;

  // 面板在右侧，向左拖拽应该增加宽度，向右拖拽应该减小宽度
  const deltaX = startX - e.clientX; // 向左拖动为正值，向右拖动为负值
  let newWidth = startWidth + deltaX;

  // 限制宽度范围
  newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));

  // 只有宽度真正改变时才更新
  if (Math.abs(newWidth - currentWidth) > 1) {
    currentWidth = newWidth;
    setPanelWidth(newWidth);
  }

  e.preventDefault();
}

// 停止拖拽
function stopResize(e) {
  if (!isDragging) return;

  isDragging = false;

  // 移除拖拽样式
  resizeHandle.classList.remove('dragging');
  document.body.classList.remove('resizing');

  // 移除动态添加的事件监听器
  document.removeEventListener('mousemove', doResize);
  document.removeEventListener('mouseup', stopResize);

  // 保存当前宽度
  savePanelWidth(currentWidth);

  e.preventDefault();
}

// 设置面板宽度
function setPanelWidth(width) {
  // 首先尝试直接调整当前面板宽度（侧边栏模式）
  try {
    if (window.parent && window.parent !== window) {
      // 在iframe中，尝试调整父容器
      const parentPanel = window.parent.document.getElementById('tea-event-radar-panel');
      if (parentPanel) {
        parentPanel.style.width = width + 'px';
        return;
      }
    }
    
    // 尝试调整当前窗口的body宽度（侧边栏模式）
    if (document.body) {
      document.body.style.width = width + 'px';
    }
  } catch (error) {
    console.debug('直接调整面板宽度失败:', error);
  }
  
  // 向service worker发送消息调整页面内面板宽度（备用方案）
  chrome.runtime.sendMessage({
    action: 'resizePanel',
    width: width
  }).catch(error => {
    console.debug('发送调整宽度消息失败:', error);
  });
}

// 保存面板宽度到本地存储
function savePanelWidth(width) {
  try {
    chrome.storage.local.set({ panelWidth: width });
  } catch (error) {
    console.warn('保存面板宽度失败:', error);
  }
}

// 恢复面板宽度
function restorePanelWidth() {
  try {
    chrome.storage.local.get(['panelWidth'], (result) => {
      const savedWidth = result.panelWidth || defaultWidth;
      currentWidth = savedWidth;
      setPanelWidth(savedWidth);
    });
  } catch (error) {
    console.warn('恢复面板宽度失败:', error);
    currentWidth = defaultWidth;
    setPanelWidth(defaultWidth);
  }
}

// CSV生成函数
function generateCSV(events) {
  if (!events || events.length === 0) {
    throw new Error('无数据可导出');
  }

  // CSV头部
  const headers = [
    '时间戳',
    '事件名称',
    '用户ID',
    '状态码',
    '请求URL',
    '事件参数',
    '原始数据'
  ];

  const csvRows = [headers.join(',')];

  events.forEach(event => {
    try {
      let eventName = '';
      let userId = '';
      let eventParams = '';
      let rawData = '';

      // 解析请求数据
      if (event.requestData) {
        try {
          const parsedData = JSON.parse(event.requestData);
          rawData = JSON.stringify(parsedData).replace(/"/g, '""'); // CSV转义

          if (Array.isArray(parsedData) && parsedData.length > 0) {
            const firstItem = parsedData[0];

            // 提取用户ID
            if (firstItem.user && firstItem.user.user_unique_id) {
              userId = firstItem.user.user_unique_id;
            }

            // 提取事件信息
            if (firstItem.events && Array.isArray(firstItem.events)) {
              const eventNames = firstItem.events.map(e => e.event || '').filter(Boolean);
              eventName = eventNames.join('; ');

              // 提取事件参数
              const allParams = firstItem.events.map(e => {
                if (e.params) {
                  try {
                    const params = typeof e.params === 'string' ? JSON.parse(e.params) : e.params;
                    return JSON.stringify(params);
                  } catch (err) {
                    return e.params;
                  }
                }
                return '';
              }).filter(Boolean);
              eventParams = allParams.join('; ');
            }
          }
        } catch (parseError) {
          rawData = event.requestData.replace(/"/g, '""');
        }
      }

      // 格式化时间戳
      const timestamp = new Date(event.timestamp).toLocaleString('zh-CN');

      // 构建CSV行
      const row = [
        `"${timestamp}"`,
        `"${eventName}"`,
        `"${userId}"`,
        `"${event.status || 'pending'}"`,
        `"${event.url || ''}"`,
        `"${eventParams}"`,
        `"${rawData}"`
      ];

      csvRows.push(row.join(','));
    } catch (error) {
      console.warn('处理事件数据时出错:', error, event);
      // 添加错误行
      csvRows.push(`"${new Date(event.timestamp).toLocaleString('zh-CN')}","解析错误","","","${event.url || ''}","","${(event.requestData || '').replace(/"/g, '""')}"`);
    }
  });

  return csvRows.join('\n');
}

// CSV下载函数
function downloadCSV(csvData, filename) {
  // 添加BOM以支持中文
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvData], { type: 'text/csv;charset=utf-8;' });

  // 创建下载链接
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // 清理URL对象
  URL.revokeObjectURL(url);
}

// 通知函数
function showNotification(message, type = 'info') {
  // 创建通知元素
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 16px;
    border-radius: 6px;
    color: white;
    font-size: 13px;
    font-weight: 500;
    z-index: 9999;
    max-width: 280px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    animation: slideInNotification 0.3s ease;
  `;

  // 根据类型设置背景色
  const colors = {
    success: '#10b981',
    error: '#ef4444',
    warning: '#f59e0b',
    info: '#3b82f6'
  };

  notification.style.backgroundColor = colors[type] || colors.info;
  notification.textContent = message;

  // 添加动画样式
  if (!document.getElementById('notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
      @keyframes slideInNotification {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      @keyframes fadeOutNotification {
        from { opacity: 1; }
        to { opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(notification);

  // 3秒后自动移除
  setTimeout(() => {
    notification.style.animation = 'fadeOutNotification 0.3s ease forwards';
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 300);
  }, 3000);
} 