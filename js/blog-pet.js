(function () {
    'use strict';

    const root = document.getElementById('blogPet');
    const button = document.getElementById('blogPetButton');
    const restore = document.getElementById('blogPetRestore');
    if (!root || !button || !restore) return;

    const message = document.getElementById('blogPetMessage');
    const name = root.dataset.name || '啤啤';
    const storageKey = 'blog-pet-closed';
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const normalLines = [
        '今天又挖到漏洞了吗？',
        '先看仿真跑起来，再谈 RCE。',
        '这个 strcpy 看起来不太对劲……',
        '不进则退，努力努力再努力！',
        '保持好奇，也要记得授权边界。',
        '摸头不会增加攻击力，但会恢复心情。'
    ];
    const petLines = [
        '心情值 +1，继续审计！',
        '再摸一下也不是不行。',
        '已收到今日份的鼓励。',
        '呼噜呼噜……'
    ];
    const feedLines = [
        '咖啡已注入，调试速度提升！',
        '咖啡因加载完成，再 trace 一遍。',
        '这杯不错，bug 也出来喝一杯吧。'
    ];

    let bubbleTimer;
    let idleTimer;
    let idleVariationTimer;
    let reactionTimer;
    let lastNormalLine = -1;
    let lookFrame;
    let scrollFrame;
    const readMilestones = new Set();
    const article = document.getElementById('articleContent');
    const reactionClasses = ['is-petted', 'is-fed', 'is-excited', 'is-thinking'];
    const idleClasses = ['idle-nod', 'idle-tilt', 'idle-tail'];

    function randomLine(lines) {
        return lines[Math.floor(Math.random() * lines.length)];
    }

    function nextNormalLine() {
        let index;
        do {
            index = Math.floor(Math.random() * normalLines.length);
        } while (normalLines.length > 1 && index === lastNormalLine);
        lastNormalLine = index;
        return normalLines[index];
    }

    function showMessage(text, duration) {
        window.clearTimeout(bubbleTimer);
        message.textContent = text;
        root.classList.add('is-talking');
        bubbleTimer = window.setTimeout(function () {
            root.classList.remove('is-talking');
        }, duration || 4200);
    }

    function setSleeping(sleeping) {
        root.classList.toggle('is-sleeping', sleeping);
        if (sleeping) {
            root.classList.remove('is-talking', ...idleClasses);
        }
    }

    function resetIdle() {
        window.clearTimeout(idleTimer);
        setSleeping(false);
        idleTimer = window.setTimeout(function () {
            setSleeping(true);
        }, 45000);
    }

    function scheduleIdleVariation() {
        window.clearTimeout(idleVariationTimer);
        idleVariationTimer = window.setTimeout(function () {
            const isReacting = reactionClasses.some(function (className) {
                return root.classList.contains(className);
            });
            if (!root.hidden && !document.hidden && !isReacting && !reducedMotion.matches &&
                !root.classList.contains('is-sleeping')) {
                const idleClass = randomLine(idleClasses);
                root.classList.add(idleClass);
                window.setTimeout(function () {
                    root.classList.remove(idleClass);
                }, 1800);
            }
            scheduleIdleVariation();
        }, 7000 + Math.random() * 6000);
    }

    function react(type, text) {
        window.clearTimeout(reactionTimer);
        root.classList.remove(...reactionClasses, ...idleClasses);
        void root.offsetWidth;
        root.classList.add('is-' + type);
        showMessage(text);
        reactionTimer = window.setTimeout(function () {
            root.classList.remove(...reactionClasses);
        }, type === 'feed' ? 2400 : 1400);
        resetIdle();
    }

    function setClosed(closed) {
        root.hidden = closed;
        restore.hidden = !closed;
        try {
            window.localStorage.setItem(storageKey, closed ? '1' : '0');
        } catch (error) {
            // 禁用本地存储时，宠物仍可在当前页面正常使用。
        }
    }

    function readClosed() {
        try {
            return window.localStorage.getItem(storageKey) === '1';
        } catch (error) {
            return false;
        }
    }

    button.addEventListener('click', function () {
        react(randomLine(['petted', 'excited', 'thinking']), nextNormalLine());
    });

    root.querySelectorAll('[data-pet-action]').forEach(function (control) {
        control.addEventListener('click', function () {
            const action = control.dataset.petAction;
            if (action === 'close') {
                setClosed(true);
            } else if (action === 'feed') {
                react('feed', randomLine(feedLines));
            } else {
                react(randomLine(['petted', 'excited']), randomLine(petLines));
            }
        });
    });

    restore.addEventListener('click', function () {
        setClosed(false);
        showMessage(name + '回来了，继续加油！');
        resetIdle();
        button.focus();
    });

    document.addEventListener('pointermove', function (event) {
        if (root.hidden || reducedMotion.matches) return;
        window.cancelAnimationFrame(lookFrame);
        lookFrame = window.requestAnimationFrame(function () {
            const rect = button.getBoundingClientRect();
            const dx = event.clientX - (rect.left + rect.width / 2);
            const dy = event.clientY - (rect.top + rect.height * .38);
            root.style.setProperty('--pet-look-x', Math.max(-3, Math.min(3, dx / 80)) + 'px');
            root.style.setProperty('--pet-look-y', Math.max(-2, Math.min(2, dy / 90)) + 'px');
            root.style.setProperty('--pet-head-x', Math.max(-2, Math.min(2, dx / 160)) + 'px');
            root.style.setProperty('--pet-head-y', Math.max(-1.5, Math.min(1.5, dy / 180)) + 'px');
            root.style.setProperty('--pet-head-angle', Math.max(-2.5, Math.min(2.5, dx / 150)) + 'deg');
        });
    }, {passive: true});

    document.addEventListener('copy', function (event) {
        if (root.hidden || !article || !article.contains(event.target)) return;
        showMessage('Payload 已复制，请仅在授权环境测试。');
        resetIdle();
    });

    function checkReadingProgress() {
        scrollFrame = null;
        if (root.hidden || !article || window.scrollY < 120) return;
        const rect = article.getBoundingClientRect();
        const articleTop = rect.top + window.scrollY;
        const progress = (window.scrollY + window.innerHeight * .55 - articleTop) / article.offsetHeight;
        const milestones = [
            {at: .5, key: 'half', text: '审计进度过半，漏洞点可能就藏在前面。'},
            {at: .95, key: 'done', text: '审计完成，奖励摸头一次！'}
        ];
        milestones.forEach(function (milestone) {
            if (progress >= milestone.at && !readMilestones.has(milestone.key)) {
                readMilestones.add(milestone.key);
                showMessage(milestone.text, 4800);
            }
        });
    }

    window.addEventListener('scroll', function () {
        if (scrollFrame) return;
        scrollFrame = window.requestAnimationFrame(checkReadingProgress);
        if (!root.classList.contains('is-sleeping')) resetIdle();
    }, {passive: true});

    document.addEventListener('keydown', resetIdle, {passive: true});
    document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
            window.clearTimeout(idleTimer);
        } else if (!root.hidden) {
            resetIdle();
        }
    });

    setClosed(readClosed());
    resetIdle();
    scheduleIdleVariation();
    window.setTimeout(function () {
        if (!root.hidden) {
            showMessage(article ? '文章加载完成，开始审计吧。' : '欢迎来到' + name + '的 0day Diary。', 5000);
        }
    }, 800);
})();
