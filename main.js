(() => {
  'use strict';

  const TOTAL_FRAMES = 240;
  const LERP_FACTOR = 0.08;
  const INITIAL_READY_THRESHOLD = 15; // Percent needed before allowing interaction

  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const loaderOverlay = document.getElementById('loaderOverlay');
  const loaderFill = document.getElementById('loaderFill');
  const loaderText = document.getElementById('loaderText');
  const currentFrameNum = document.getElementById('currentFrameNum');
  const toastContainer = document.getElementById('toastContainer');
  const copyEmailBtn = document.getElementById('copyEmailBtn');
  const navEmailBtn = document.getElementById('navEmailBtn');
  const mobileCopyEmailBtn = document.getElementById('mobileCopyEmailBtn');
  const contactForm = document.getElementById('contactForm');
  const filterPills = document.querySelectorAll('.filter-pill');
  const projectCards = document.querySelectorAll('.project-card');

  // Mobile Navigation Drawer Elements
  const mobileMenuToggle = document.getElementById('mobileMenuToggle');
  const mobileCloseBtn = document.getElementById('mobileCloseBtn');
  const mobileNavDrawer = document.getElementById('mobileNavDrawer');
  const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');

  const images = new Array(TOTAL_FRAMES).fill(null);
  let loadedCount = 0;
  let targetProgress = 0;
  let currentProgress = 0;
  let lastDrawnIndex = -1;
  let isInitialRenderDone = false;

  function getFramePath(index) {
    const formatted = String(index).padStart(4, '0');
    return `frames/frame_${formatted}.png`;
  }

  // Handle Canvas Resizing with High-DPI support (capped at 2x for mobile GPU efficiency)
  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = window.innerWidth;
    const height = window.innerHeight;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);

    if (lastDrawnIndex >= 0) {
      drawFrame(lastDrawnIndex, true);
    }
  }

  // Draw image with object-fit: cover calculation (centered)
  function drawImageCover(img) {
    if (!img || !img.complete || img.naturalWidth === 0) return;

    const cw = canvas.width;
    const ch = canvas.height;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;

    const scale = Math.max(cw / iw, ch / ih);
    const sw = iw * scale;
    const sh = ih * scale;
    const dx = (cw - sw) / 2;
    const dy = (ch - sh) / 2;

    ctx.drawImage(img, 0, 0, iw, ih, dx, dy, sw, sh);
  }

  // Find the closest loaded image if the requested frame is still buffering
  function getClosestLoadedImage(index) {
    if (images[index] && images[index].complete && images[index].naturalWidth > 0) {
      return images[index];
    }
    for (let offset = 1; offset < TOTAL_FRAMES; offset++) {
      const prev = index - offset;
      if (prev >= 0 && images[prev] && images[prev].complete && images[prev].naturalWidth > 0) {
        return images[prev];
      }
      const next = index + offset;
      if (next < TOTAL_FRAMES && images[next] && images[next].complete && images[next].naturalWidth > 0) {
        return images[next];
      }
    }
    return null;
  }

  function drawFrame(index, force = false) {
    if (index === lastDrawnIndex && !force) return;

    const img = getClosestLoadedImage(index);
    if (img) {
      drawImageCover(img);
      lastDrawnIndex = index;
    }
  }

  // Update scroll target progress based on page scroll depth
  function onScroll() {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    if (maxScroll > 0) {
      targetProgress = Math.min(Math.max(window.scrollY / maxScroll, 0), 1);
    } else {
      targetProgress = 0;
    }
  }

  // Physics animation loop (Smooth LERP)
  function renderLoop() {
    const delta = targetProgress - currentProgress;
    if (Math.abs(delta) > 0.0001) {
      currentProgress += delta * LERP_FACTOR;
    } else {
      currentProgress = targetProgress;
    }

    const frameIndex = Math.min(
      TOTAL_FRAMES - 1,
      Math.max(0, Math.round(currentProgress * (TOTAL_FRAMES - 1)))
    );

    drawFrame(frameIndex);

    if (currentFrameNum) {
      currentFrameNum.textContent = String(frameIndex + 1).padStart(3, '0');
    }

    requestAnimationFrame(renderLoop);
  }

  // Preload frames progressively
  function preloadFrames() {
    const firstImg = new Image();
    firstImg.src = getFramePath(0);
    images[0] = firstImg;

    firstImg.onload = () => {
      loadedCount++;
      updateLoadingStatus();
      if (!isInitialRenderDone) {
        isInitialRenderDone = true;
        drawFrame(0, true);
      }
      loadRemainingFrames();
    };

    firstImg.onerror = () => {
      console.warn('Failed to load initial frame 0');
      loadRemainingFrames();
    };
  }

  function loadRemainingFrames() {
    const priorityQueue = [];
    const queuedSet = new Set();

    // Priority 1: frames 1 to 30 (initial scrub window)
    for (let i = 1; i < Math.min(30, TOTAL_FRAMES); i++) {
      priorityQueue.push(i);
      queuedSet.add(i);
    }

    // Priority 2: Keyframes distributed evenly across entire sequence
    for (let i = 30; i < TOTAL_FRAMES; i += 6) {
      if (!queuedSet.has(i)) {
        priorityQueue.push(i);
        queuedSet.add(i);
      }
    }

    // Priority 3: All remaining frames
    for (let i = 1; i < TOTAL_FRAMES; i++) {
      if (!queuedSet.has(i)) {
        priorityQueue.push(i);
        queuedSet.add(i);
      }
    }

    const CONCURRENCY = 6;
    let queueIndex = 0;

    function loadNext() {
      if (queueIndex >= priorityQueue.length) return;

      const idx = priorityQueue[queueIndex++];
      const img = new Image();
      images[idx] = img;

      img.onload = () => {
        loadedCount++;
        updateLoadingStatus();
        loadNext();
      };

      img.onerror = () => {
        console.warn(`Failed to load frame ${idx}`);
        loadNext();
      };

      img.src = getFramePath(idx);
    }

    for (let c = 0; c < CONCURRENCY; c++) {
      loadNext();
    }
  }

  function updateLoadingStatus() {
    const percent = Math.round((loadedCount / TOTAL_FRAMES) * 100);

    if (loaderFill) {
      loaderFill.style.width = `${percent}%`;
    }
    if (loaderText) {
      loaderText.textContent = `Loading Frames ${percent}%`;
    }

    if (percent >= INITIAL_READY_THRESHOLD && loaderOverlay && !loaderOverlay.classList.contains('hidden')) {
      loaderOverlay.classList.add('hidden');
    }
  }

  // Toast Notification
  function showToast(message) {
    if (!toastContainer) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ff3344" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
      <span>${message}</span>
    `;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(30px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  // Copy Email Helper
  function copyEmail() {
    const email = 'anuragpal00018@gmail.com';
    navigator.clipboard.writeText(email).then(() => {
      showToast(`Copied to clipboard: ${email}`);
    }).catch(() => {
      showToast(`Email: ${email}`);
    });
  }

  // Project Category Filter Handler
  function setupProjectFilters() {
    if (!filterPills.length || !projectCards.length) return;

    filterPills.forEach(pill => {
      pill.addEventListener('click', () => {
        filterPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');

        const selectedFilter = pill.getAttribute('data-filter');

        projectCards.forEach(card => {
          const category = card.getAttribute('data-category');
          if (selectedFilter === 'all' || category === selectedFilter) {
            card.style.display = 'flex';
            card.style.opacity = '0';
            card.style.transform = 'translateY(12px)';
            setTimeout(() => {
              card.style.transition = 'all 0.3s ease';
              card.style.opacity = '1';
              card.style.transform = 'translateY(0)';
            }, 50);
          } else {
            card.style.display = 'none';
          }
        });
      });
    });
  }

  // Mobile Navigation Drawer Logic
  function setupMobileNav() {
    if (!mobileMenuToggle || !mobileNavDrawer) return;

    function openMenu() {
      mobileNavDrawer.classList.add('open');
      document.body.style.overflow = 'hidden'; // Prevent background scrolling when menu is open
    }

    function closeMenu() {
      mobileNavDrawer.classList.remove('open');
      document.body.style.overflow = '';
    }

    mobileMenuToggle.addEventListener('click', openMenu);

    if (mobileCloseBtn) {
      mobileCloseBtn.addEventListener('click', closeMenu);
    }

    // Close when tapping any nav link
    mobileNavLinks.forEach(link => {
      link.addEventListener('click', closeMenu);
    });

    // Close on Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && mobileNavDrawer.classList.contains('open')) {
        closeMenu();
      }
    });

    // Close when tapping outside drawer
    document.addEventListener('click', (e) => {
      if (mobileNavDrawer.classList.contains('open') &&
          !mobileNavDrawer.contains(e.target) &&
          !mobileMenuToggle.contains(e.target)) {
        closeMenu();
      }
    });
  }

  // Initialize Event Listeners
  function init() {
    window.addEventListener('resize', resizeCanvas, { passive: true });
    window.addEventListener('orientationchange', () => {
      setTimeout(resizeCanvas, 150);
    });
    window.addEventListener('scroll', onScroll, { passive: true });

    if (copyEmailBtn) {
      copyEmailBtn.addEventListener('click', copyEmail);
    }
    if (navEmailBtn) {
      navEmailBtn.addEventListener('click', copyEmail);
    }
    if (mobileCopyEmailBtn) {
      mobileCopyEmailBtn.addEventListener('click', copyEmail);
    }

    if (contactForm) {
      contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('senderName')?.value || 'Guest';
        showToast(`Thank you, ${name}! Your message has been sent to Anurag.`);
        contactForm.reset();
      });
    }

    setupProjectFilters();
    setupMobileNav();
    resizeCanvas();
    preloadFrames();
    renderLoop();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
