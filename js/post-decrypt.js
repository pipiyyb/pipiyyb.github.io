(function () {
  'use strict';

  var root = document.getElementById('post-encrypt');
  if (!root) return;

  var dataEl = document.getElementById('post-encrypt-data');
  var lockEl = document.getElementById('post-encrypt-lock');
  var form = document.getElementById('post-encrypt-form');
  var input = document.getElementById('post-encrypt-password');
  var submitBtn = document.getElementById('post-encrypt-submit');
  var errorEl = document.getElementById('post-encrypt-error');
  var contentEl = document.getElementById('post-encrypt-content');

  if (!dataEl || !lockEl || !form || !input || !submitBtn || !errorEl || !contentEl) return;

  var payload;
  try {
    payload = JSON.parse(dataEl.textContent || dataEl.innerHTML);
  } catch (e) {
    return;
  }

  var storageKey = 'hexo-post-encrypt:' + location.pathname;
  var busy = false;
  var unlocked = false;

  function base64ToBytes(value) {
    var binary = atob(value);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  function deriveKey(password, salt) {
    var encoder = new TextEncoder();
    return crypto.subtle
      .importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey'])
      .then(function (baseKey) {
        return crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt: salt, iterations: payload.iter, hash: 'SHA-256' },
          baseKey,
          { name: 'AES-GCM', length: 256 },
          false,
          ['decrypt']
        );
      });
  }

  function decrypt(password) {
    return deriveKey(password, base64ToBytes(payload.salt))
      .then(function (key) {
        var ciphertext = base64ToBytes(payload.ct);
        var tag = base64ToBytes(payload.tag);
        var data = new Uint8Array(ciphertext.length + tag.length);
        data.set(ciphertext, 0);
        data.set(tag, ciphertext.length);
        return crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: base64ToBytes(payload.iv), tagLength: 128 },
          key,
          data
        );
      })
      .then(function (plain) {
        return new TextDecoder().decode(plain);
      });
  }

  function setBusy(state) {
    busy = state;
    input.disabled = state;
    submitBtn.disabled = state;
    submitBtn.textContent = state ? '解密中…' : '解锁文章';
  }

  function showError(message) {
    errorEl.textContent = message || '';
  }

  function reveal(html) {
    unlocked = true;
    contentEl.innerHTML = html;
    contentEl.hidden = false;
    lockEl.style.display = 'none';
    if (dataEl.parentNode) dataEl.parentNode.removeChild(dataEl);
    enhanceContent();
  }

  function enhanceContent() {
    contentEl.querySelectorAll('a[href]').forEach(function (link) {
      link.setAttribute('target', '_blank');
      link.setAttribute('rel', 'noopener');
    });

    contentEl.querySelectorAll('img').forEach(function (img) {
      if (img.parentNode && img.parentNode.classList && img.parentNode.classList.contains('img-item')) return;
      var src = img.getAttribute('src');
      if (!src) return;
      var wrapper = document.createElement('div');
      wrapper.className = 'img-item';
      wrapper.setAttribute('data-src', src);
      img.parentNode.insertBefore(wrapper, img);
      wrapper.appendChild(img);
      img.classList.add('img-shadow', 'img-margin');
    });

    if (window.jQuery && window.jQuery.fn.lightGallery) {
      var $article = window.jQuery('#articleContent');
      var gallery = $article.data('lightGallery');
      try {
        if (gallery) gallery.destroy(true);
        $article.lightGallery({
          selector: '.img-item',
          subHtmlSelectorRelative: true
        });
      } catch (e) {
        // 主题未启用灯箱时忽略。
      }
    }

    if (window.Prism && typeof window.Prism.highlightAllUnder === 'function') {
      window.Prism.highlightAllUnder(contentEl);
    }

    enhanceCodeBlocks();

    if (window.tocbot && typeof window.tocbot.refresh === 'function') {
      try {
        window.tocbot.refresh();
      } catch (e) {
        // TOC 未初始化时忽略。
      }
    }
  }

  function enhanceCodeBlocks() {
    var $ = window.jQuery;
    if (!$) return;

    var addCopy = root.getAttribute('data-code-copy') === 'true';
    var addShrink = root.getAttribute('data-code-shrink') === 'true';

    contentEl.querySelectorAll('pre').forEach(function (pre) {
      if (pre.parentNode && pre.parentNode.classList && pre.parentNode.classList.contains('code-area')) return;

      $(pre).wrap('<div class="code-area" style="position: relative"></div>');
      var $area = $(pre).parent();

      if (addShrink) {
        var $expand = $('<i class="fas fa-angle-up code-expand" aria-hidden="true"></i>');
        $area.prepend($expand);
        $expand.on('click', function () {
          var codeEl = pre.querySelector('code');
          if (!codeEl) return;
          if ($area.hasClass('code-closed')) {
            $(codeEl).show();
            $area.removeClass('code-closed');
          } else {
            $(codeEl).hide();
            $area.addClass('code-closed');
          }
        });
      }

      if (addCopy) {
        var $notice = $('<div class="codecopy_notice"></div>');
        var $icon = $('<i class="fas fa-copy code_copy" title="复制代码" aria-hidden="true"></i>');
        $area.prepend($icon);
        $area.prepend($notice);

        $icon.on('click', function () {
          var codeEl = pre.querySelector('code');
          if (!codeEl) return;
          var text = codeEl.textContent;
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function () {
              flashNotice($notice, '复制成功');
            }, function () {
              copyFallback(codeEl, $notice);
            });
          } else {
            copyFallback(codeEl, $notice);
          }
        });
      }
    });
  }

  function copyFallback(codeEl, $notice) {
    var selection = window.getSelection();
    var range = document.createRange();
    range.selectNodeContents(codeEl);
    selection.removeAllRanges();
    selection.addRange(range);
    var ok = false;
    try {
      ok = document.execCommand('copy');
    } catch (e) {
      ok = false;
    }
    selection.removeAllRanges();
    flashNotice($notice, ok ? '复制成功' : '复制失败');
  }

  function flashNotice($notice, text) {
    $notice
      .text(text)
      .stop(true, true)
      .css({ opacity: 1, top: 30 })
      .animate({ opacity: 0, top: 0 }, 700);
  }

  function unlock(password, silent) {
    if (busy || unlocked) return Promise.resolve(false);

    if (!window.crypto || !window.crypto.subtle) {
      showError('当前浏览器环境不支持 Web Crypto，请使用 HTTPS 或 localhost 访问本站。');
      return Promise.resolve(false);
    }

    setBusy(true);
    showError('');

    return decrypt(password)
      .then(function (html) {
        setBusy(false);
        try {
          sessionStorage.setItem(storageKey, password);
        } catch (e) {
          // 隐私模式可能禁用 sessionStorage。
        }
        reveal(html);
        return true;
      })
      .catch(function (err) {
        setBusy(false);
        try {
          sessionStorage.removeItem(storageKey);
        } catch (e) {
          // ignore
        }
        if (!silent) {
          if (err && err.name === 'OperationError') {
            showError('密码错误，请重试。');
            input.select();
          } else {
            showError('解密失败：' + (err && err.message ? err.message : String(err)));
          }
        }
        return false;
      });
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    var password = input.value;
    if (!password) {
      showError('请输入访问密码。');
      input.focus();
      return;
    }
    unlock(password, false);
  });

  function start() {
    var stored = '';
    try {
      stored = sessionStorage.getItem(storageKey) || '';
    } catch (e) {
      stored = '';
    }
    if (stored) {
      unlock(stored, true);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
