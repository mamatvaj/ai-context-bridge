// AI Context Bridge — Help Guide nav scroll highlighting
const sections = document.querySelectorAll('section[id], div[id="overview"]');
const navLinks  = document.querySelectorAll('nav a');

const obs = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      navLinks.forEach(a => a.classList.remove('active'));
      const active = document.querySelector(`nav a[href="#${e.target.id}"]`);
      if (active) active.classList.add('active');
    }
  });
}, { rootMargin: '-20% 0px -70% 0px' });

sections.forEach(s => obs.observe(s));
