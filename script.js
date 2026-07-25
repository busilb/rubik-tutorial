/* ============================================
   三阶魔方教程 - 交互脚本
   ============================================ */

document.addEventListener('DOMContentLoaded', function () {

  // --- Sidebar active link tracking ---
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-link');
  const progressFill = document.getElementById('progressFill');
  const mobileProgressFill = document.getElementById('mobileProgressFill');
  const totalSteps = navLinks.length;

  function updateActiveLink() {
    let current = '';
    const scrollY = window.scrollY + 120;

    sections.forEach(function (section) {
      if (section.offsetTop <= scrollY) {
        current = section.id;
      }
    });

    let activeIndex = 0;
    navLinks.forEach(function (link, index) {
      link.classList.remove('active');
      if (link.getAttribute('href') === '#' + current) {
        link.classList.add('active');
        activeIndex = index;
      }
    });

    var pct = ((activeIndex + 1) / totalSteps) * 100;
    if (progressFill) progressFill.style.width = pct + '%';
    if (mobileProgressFill) mobileProgressFill.style.width = pct + '%';
  }

  window.addEventListener('scroll', updateActiveLink);
  updateActiveLink();

  // --- Smooth scroll for nav links ---
  navLinks.forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      var targetId = this.getAttribute('href').slice(1);
      var target = document.getElementById(targetId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth' });
      }
      // Close mobile sidebar
      var sidebar = document.getElementById('sidebar');
      if (sidebar) sidebar.classList.remove('open');
    });
  });

  // --- Mobile menu toggle ---
  var menuToggle = document.getElementById('menu-toggle');
  var sidebar = document.getElementById('sidebar');

  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', function () {
      sidebar.classList.toggle('open');
    });

    // Close sidebar when clicking outside
    document.addEventListener('click', function (e) {
      if (sidebar.classList.contains('open') &&
          !sidebar.contains(e.target) &&
          e.target !== menuToggle) {
        sidebar.classList.remove('open');
      }
    });
  }

  // --- Scroll animations for content cards ---
  var cards = document.querySelectorAll('.content-card');

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  });

  cards.forEach(function (card) {
    observer.observe(card);
  });

  // --- Formula click to highlight ---
  var formulaMoves = document.querySelectorAll('.formula-move');
  formulaMoves.forEach(function (move) {
    move.addEventListener('click', function () {
      this.style.transform = 'scale(1.2)';
      var self = this;
      setTimeout(function () {
        self.style.transform = 'scale(1)';
      }, 200);
    });
  });

  // --- Practice counter ---
  var practiceBtn = document.getElementById('practiceBtn');
  var practiceCount = document.getElementById('practiceCount');
  var count = 0;

  if (practiceBtn && practiceCount) {
    practiceBtn.addEventListener('click', function () {
      count++;
      practiceCount.textContent = count;
      if (count >= 10) {
        practiceBtn.textContent = '太棒了！你已经掌握了基本手法！';
        practiceBtn.style.background = '#10B981';
        practiceBtn.disabled = true;
      } else if (count >= 6) {
        practiceBtn.textContent = '魔方是不是回原了？继续！(' + (10 - count) + ' 遍)';
      } else {
        practiceBtn.textContent = '再来一遍！还剩 ' + (10 - count) + ' 遍';
      }
    });
  }

  // --- Keyboard navigation ---
  var stepSections = [
    'hero', 'basics', 'holding', 'notation',
    'step1', 'step2', 'step3', 'step4',
    'step5', 'step6', 'step7'
  ];

  document.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      navigateStep(1);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      navigateStep(-1);
    }
  });

  function navigateStep(direction) {
    var currentIndex = 0;
    var scrollY = window.scrollY + 200;

    for (var i = stepSections.length - 1; i >= 0; i--) {
      var el = document.getElementById(stepSections[i]);
      if (el && el.offsetTop <= scrollY) {
        currentIndex = i;
        break;
      }
    }

    var nextIndex = Math.max(0, Math.min(stepSections.length - 1, currentIndex + direction));
    var target = document.getElementById(stepSections[nextIndex]);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
    }
  }

});
