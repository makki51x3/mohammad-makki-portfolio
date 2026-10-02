//Created by Abdughafur
const card = document.getElementById('glass-card');
    const zoomInBtn = document.getElementById('zoom-in');
    const zoomOutBtn = document.getElementById('zoom-out');
    
   
    let currentScale = 1;
    const SCALE_STEP = 0.1;
    const MAX_SCALE = 2.0;
    const MIN_SCALE = 0.5;

    zoomInBtn.addEventListener('click', () => {
      if (currentScale < MAX_SCALE) {
        currentScale += SCALE_STEP;
        card.style.setProperty('--scale-factor', currentScale.toFixed(2));
      }
    });

    zoomOutBtn.addEventListener('click', () => {
      if (currentScale > MIN_SCALE) {
        currentScale -= SCALE_STEP;
        card.style.setProperty('--scale-factor', currentScale.toFixed(2));
      }
    });


    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    card.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);

    card.addEventListener('touchstart', dragStart, { passive: false });
    document.addEventListener('touchmove', drag, { passive: false });
    document.addEventListener('touchend', dragEnd);

    function dragStart(e) {
     
      if (e.target.closest('button') || e.target.closest('a')) return;
      
      isDragging = true;
      card.classList.add('dragging');

      if (e.type === 'touchstart') {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
      } else {
        startX = e.clientX;
        startY = e.clientY;
      }

      const rect = card.getBoundingClientRect();
      if (window.getComputedStyle(card).position !== 'absolute') {
        card.style.position = 'absolute';
        card.style.margin = '0';
        
        card.style.left = card.offsetLeft + 'px';
        card.style.top = card.offsetTop + 'px';
      }

      initialLeft = card.offsetLeft;
      initialTop = card.offsetTop;
    }

    function drag(e) {
      if (!isDragging) return;
      e.preventDefault(); 

      let currentX, currentY;

      if (e.type === 'touchmove') {
        currentX = e.touches[0].clientX;
        currentY = e.touches[0].clientY;
      } else {
        currentX = e.clientX;
        currentY = e.clientY;
      }

      const diffX = currentX - startX;
      const diffY = currentY - startY;

      card.style.left = (initialLeft + diffX) + 'px';
      card.style.top = (initialTop + diffY) + 'px';
    }

    function dragEnd() {
      if (!isDragging) return;
      isDragging = false;
      card.classList.remove('dragging');
    }

// 2026 - Abdughafur Khujzoda
