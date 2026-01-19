// ==UserScript==
// @name         FSA - Fix Steam Activities
// @namespace    https://github.com/FSA
// @version      2.0.0
// @description  修复 Steam 社区动态页面的布局异常和无限滚动失效问题
// @author       FSA
// @match        https://steamcommunity.com/id/*/home*
// @match        https://steamcommunity.com/profiles/*/home*
// @match        https://steamcommunity.com/my/home*
// @match        https://steamcommunity.com/id/*/myactivity*
// @match        https://steamcommunity.com/profiles/*/myactivity*
// @match        https://steamcommunity.com/my/myactivity*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function FSA() {
  'use strict';

  const FSA_VERSION = '2.0.0';
  const LOG_PREFIX = '[FSA]';
  const MAX_RETRY = 3;
  const DEBUG = false;

  // ==================== 工具函数 ====================

  function log(...args) {
    if (DEBUG) console.log(LOG_PREFIX, ...args);
  }

  function warn(...args) {
    console.warn(LOG_PREFIX, ...args);
  }

  function error(...args) {
    console.error(LOG_PREFIX, ...args);
  }

  // ==================== 诊断函数 ====================

  function diagnose() {
    const structureChecks = {
      'ModalContentContainer': !!document.getElementById('ModalContentContainer'),
      'blotter_page': !!document.getElementById('blotter_page'),
      'blotter_content': !!document.getElementById('blotter_content'),
    };

    const blotterDays = document.querySelectorAll('.blotter_day');
    const orphanedBlotterDays = Array.from(blotterDays).filter(day => {
      return !day.closest('#blotter_content');
    });

    const issues = [];
    if (!structureChecks['ModalContentContainer']) issues.push('missing_modal');
    if (!structureChecks['blotter_page']) issues.push('missing_blotter_page');
    if (!structureChecks['blotter_content']) issues.push('missing_blotter_content');
    if (orphanedBlotterDays.length > 0) issues.push('orphaned_days');

    return {
      structureChecks,
      blotterBlockCount: document.querySelectorAll('.blotter_block').length,
      orphanedCount: orphanedBlotterDays.length,
      issues,
      needsFix: issues.length > 0,
    };
  }

  // ==================== 结构修复 ====================

  function fixStructure() {
    log('修复页面结构...');

    const templateContent = document.getElementById('responsive_page_template_content');
    if (!templateContent) {
      error('找不到 templateContent');
      return false;
    }

    const orphanedBlotterDays = Array.from(templateContent.querySelectorAll(':scope > .blotter_day'));

    let modalContainer = document.getElementById('ModalContentContainer');
    let blotterPage = document.getElementById('blotter_page');
    let blotterContent = document.getElementById('blotter_content');

    if (!modalContainer) {
      modalContainer = document.createElement('div');
      modalContainer.id = 'ModalContentContainer';
      modalContainer.className = 'pagecontent bluebg';
      templateContent.insertBefore(modalContainer, templateContent.firstChild);
    }

    if (!blotterPage) {
      blotterPage = document.createElement('div');
      blotterPage.id = 'blotter_page';
      modalContainer.appendChild(blotterPage);
    }

    if (!blotterContent) {
      blotterContent = document.createElement('div');
      blotterContent.id = 'blotter_content';
      blotterPage.appendChild(blotterContent);
    }

    if (!document.getElementById('blotter_throbber')) {
      const throbber = document.createElement('div');
      throbber.id = 'blotter_throbber';
      throbber.style.display = 'none';
      throbber.innerHTML = '<div class="throbber"></div>';
      blotterContent.after(throbber);
    }

    if (orphanedBlotterDays.length > 0) {
      log(`移动 ${orphanedBlotterDays.length} 个 blotter_day`);
      orphanedBlotterDays.forEach(day => blotterContent.appendChild(day));
    }

    return true;
  }

  // ==================== 滚动加载 ====================

  let scrollState = {
    isLoading: false,
    hasMore: true,
    nextUrl: null,
    retryCount: 0,
  };

  function getInitialTimestamp() {
    let minTs = Infinity;

    document.querySelectorAll('[id^="userstatus_"]').forEach(el => {
      const match = el.id.match(/userstatus_(\d+)_/);
      if (match) {
        const ts = parseInt(match[1], 10);
        if (ts < minTs) minTs = ts;
      }
    });

    document.querySelectorAll('[data-timestamp]').forEach(el => {
      const ts = parseInt(el.getAttribute('data-timestamp'), 10);
      if (ts && ts < minTs) minTs = ts;
    });

    if (minTs === Infinity) {
      const days = document.querySelectorAll('.blotter_day');
      if (days.length > 0) {
        const match = days[days.length - 1].id.match(/blotter_day_(\d+)/);
        if (match) minTs = parseInt(match[1], 10);
      }
    }

    return minTs === Infinity ? null : String(minTs);
  }

  function buildApiUrl(timestamp) {
    const pathMatch = location.pathname.match(/\/(id|profiles)\/([^/]+)/);
    if (!pathMatch) return null;

    const [, type, identifier] = pathMatch;
    const isMyActivity = location.pathname.includes('myactivity');

    let url = `https://steamcommunity.com/${type}/${identifier}/ajaxgetusernews/?start=${timestamp}`;
    if (isMyActivity) url += '&myactivity=1';

    return url;
  }

  function getEarlierUrl(url, hoursBack = 24) {
    const match = url.match(/start=(\d+)/);
    if (!match) return null;
    const ts = parseInt(match[1], 10) - (hoursBack * 3600);
    return url.replace(/start=\d+/, `start=${ts}`);
  }

  async function loadMore() {
    if (scrollState.isLoading || !scrollState.hasMore) return;

    let url = scrollState.nextUrl;
    if (!url) {
      const ts = getInitialTimestamp();
      if (!ts) {
        scrollState.hasMore = false;
        return;
      }
      url = buildApiUrl(ts);
    }

    log('加载:', url);
    scrollState.isLoading = true;

    const throbber = document.getElementById('blotter_throbber');
    if (throbber) throbber.style.display = '';

    try {
      const response = await fetch(url, {
        credentials: 'include',
        headers: {
          'X-Requested-With': 'XMLHttpRequest',
          'X-Prototype-Version': '1.7'
        }
      });

      if (!response.ok) {
        scrollState.retryCount++;
        if (scrollState.retryCount < MAX_RETRY) {
          scrollState.nextUrl = getEarlierUrl(url, 24 * scrollState.retryCount);
          log('重试:', scrollState.nextUrl);
        } else {
          scrollState.hasMore = false;
        }
        return;
      }

      scrollState.retryCount = 0;
      const json = await response.json();

      if (json.success && json.blotter_html && json.blotter_html.length > 100) {
        const container = document.getElementById('blotter_content');
        if (container) {
          const temp = document.createElement('div');
          temp.innerHTML = json.blotter_html;
          while (temp.firstChild) {
            container.appendChild(temp.firstChild);
          }
        }

        scrollState.nextUrl = json.next_request;
        scrollState.hasMore = !!json.next_request;
      } else {
        scrollState.hasMore = false;
      }
    } catch (err) {
      error('加载失败:', err);
    } finally {
      scrollState.isLoading = false;
      if (throbber) throbber.style.display = 'none';
    }
  }

  function onScroll() {
    if (scrollState.isLoading || !scrollState.hasMore) return;

    const scrollBottom = window.innerHeight + window.scrollY;
    const docHeight = document.documentElement.scrollHeight;

    if (docHeight - scrollBottom < 500) {
      loadMore();
    }
  }

  function setupScrollListener() {
    if (typeof $J !== 'undefined') {
      $J(window).off('scroll');
    }
    window.addEventListener('scroll', onScroll);
    log('滚动监听已设置');
  }

  // ==================== UI 悬浮按钮 ====================

  function createFixButton() {
    if (document.getElementById('fsa_fix_button')) {
      return;
    }

    // 创建悬浮按钮
    const btn = document.createElement('div');
    btn.id = 'fsa_fix_button';
    btn.innerHTML = 'FSA';
    btn.style.cssText = `
      position: fixed;
      top: 8px;
      right: 120px;
      z-index: 99999;
      background: linear-gradient(to bottom, #799905 5%, #4a7a0c 95%);
      color: #d2e885;
      padding: 6px 12px;
      border-radius: 2px;
      font-size: 12px;
      font-family: "Motiva Sans", sans-serif;
      cursor: pointer;
      user-select: none;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      transition: all 0.2s;
    `;

    const isFixed = () => btn.dataset.fixed === 'true';

    btn.addEventListener('mouseenter', () => {
      if (isFixed()) return;
      btn.style.background = 'linear-gradient(to bottom, #a4d007 5%, #6b9b14 95%)';
      btn.style.color = '#fff';
    });

    btn.addEventListener('mouseleave', () => {
      if (isFixed()) return;
      btn.style.background = 'linear-gradient(to bottom, #799905 5%, #4a7a0c 95%)';
      btn.style.color = '#d2e885';
    });

    btn.addEventListener('click', () => {
      if (isFixed()) return; // 已修复则不响应点击

      btn.innerHTML = '修复中...';
      btn.style.opacity = '0.7';
      btn.style.cursor = 'wait';

      setTimeout(() => {
        fix();
        btn.dataset.fixed = 'true';
        btn.innerHTML = '已修复 ✓';
        btn.style.background = 'linear-gradient(to bottom, #496d0d 5%, #3a5a0a 95%)';
        btn.style.cursor = 'default';
        btn.style.opacity = '0.6';
      }, 100);
    });

    document.body.appendChild(btn);
    log('悬浮按钮已添加');
  }

  // ==================== 主函数 ====================

  function fix() {
    const diag = diagnose();

    if (diag.needsFix) {
      log('检测到问题，开始修复...');
      fixStructure();
    }

    setupScrollListener();
    log('FSA 已激活');
  }

  // ==================== 初始化 ====================

  function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver((mutations, obs) => {
        const element = document.querySelector(selector);
        if (element) {
          obs.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error('timeout'));
      }, timeout);
    });
  }

  async function init() {
    log(`FSA v${FSA_VERSION} 初始化`);

    // 添加悬浮按钮（立即添加，不依赖页面结构）
    createFixButton();

    // 等待页面内容加载后自动修复
    try {
      await waitForElement('.blotter_day, #blotter_content');
      await new Promise(resolve => setTimeout(resolve, 300));

      // 检测是否需要修复
      const diag = diagnose();
      if (diag.needsFix) {
        log('检测到问题，自动修复...');
        fix();

        // 更新按钮状态为已修复（不可点击）
        const btn = document.getElementById('fsa_fix_button');
        if (btn) {
          btn.innerHTML = '已修复 ✓';
          btn.style.background = 'linear-gradient(to bottom, #496d0d 5%, #3a5a0a 95%)';
          btn.style.cursor = 'default';
          btn.style.opacity = '0.6';
          // 标记按钮为已修复状态（通过 data 属性）
          btn.dataset.fixed = 'true';
        }
      } else {
        // 即使没问题也设置滚动监听
        setupScrollListener();
      }
    } catch (err) {
      log('初始化超时');
    }
  }

  // 导出调试接口
  window.FSA = {
    version: FSA_VERSION,
    diagnose,
    fix,
    loadMore,
    reset: () => {
      scrollState.isLoading = false;
      scrollState.hasMore = true;
      scrollState.nextUrl = null;
      scrollState.retryCount = 0;
    },
    status: () => ({ ...scrollState }),
  };

  // 启动
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }

})();
