mermaid.initialize({
    startOnLoad: true,
    theme: 'dark',
    themeVariables: {
        primaryColor: '#a855f7',
        primaryTextColor: '#fff',
        primaryBorderColor: '#d8b4fe',
        lineColor: '#d8b4fe',
        secondaryColor: '#3b82f6',
        tertiaryColor: '#22c55e',
        background: '#1a1a1a',
        mainBkg: '#1a1a1a',
        secondBkg: '#0d0d0d',
        textColor: '#e5e5e5',
        fontSize: '14px'
    }
});

document.addEventListener('DOMContentLoaded', function() {
    // --- Mermaid diagram viewer ---
    const modal = document.getElementById('diagram-modal');
    const svgWrap = document.getElementById('diagram-modal-svg-wrap');
    let zoomLevel = 1;
    const ZOOM_STEP = 0.2;
    const ZOOM_MIN = 0.3;
    const ZOOM_MAX = 5;

    function setZoom(z) {
        zoomLevel = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z));
        svgWrap.style.transform = `scale(${zoomLevel})`;
    }

    // Wrap each mermaid div and add a view button
    document.querySelectorAll('.mermaid').forEach(el => {
        const wrapper = document.createElement('div');
        wrapper.className = 'mermaid-wrapper';
        el.parentNode.insertBefore(wrapper, el);
        wrapper.appendChild(el);

        const btn = document.createElement('button');
        btn.className = 'mermaid-view-btn';
        btn.innerHTML = '<i class="fa-solid fa-up-right-and-down-left-from-center"></i> View';
        btn.addEventListener('click', () => {
            const svg = el.querySelector('svg');
            if (!svg) return;
            svgWrap.innerHTML = svg.outerHTML;
            // Make the SVG fill the modal nicely
            const cloned = svgWrap.querySelector('svg');
            cloned.removeAttribute('width');
            cloned.removeAttribute('height');
            cloned.style.width = 'auto';
            cloned.style.minWidth = '600px';
            cloned.style.maxWidth = '100%';
            setZoom(1);
            modal.classList.add('open');
            document.body.style.overflow = 'hidden';
        });
        wrapper.appendChild(btn);
    });

    document.getElementById('dm-zoom-in').addEventListener('click', () => setZoom(zoomLevel + ZOOM_STEP));
    document.getElementById('dm-zoom-out').addEventListener('click', () => setZoom(zoomLevel - ZOOM_STEP));
    document.getElementById('dm-zoom-reset').addEventListener('click', () => setZoom(1));
    document.getElementById('dm-close').addEventListener('click', closeModal);
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

    // Scroll-to-zoom inside modal
    document.getElementById('diagram-modal-body').addEventListener('wheel', e => {
        e.preventDefault();
        setZoom(zoomLevel + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP));
    }, { passive: false });

    function closeModal() {
        modal.classList.remove('open');
        document.body.style.overflow = '';
    }

    // --- Sidebar & scroll ---
    const links = document.querySelectorAll('.sidebar-nav a');
    const sections = document.querySelectorAll('section[id], h3[id]');
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                links.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') && link.getAttribute('href').replace(/^[^#]*/, '') === '#' + entry.target.id) {
                        link.classList.add('active');
                    }
                });
            }
        });
    }, { rootMargin: "-50% 0px -50% 0px" });

    sections.forEach(section => observer.observe(section));

    const backToTopButton = document.getElementById('back-to-top');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 300) {
            backToTopButton.classList.remove('scale-0');
        } else {
            backToTopButton.classList.add('scale-0');
        }
    });
    backToTopButton.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
});
