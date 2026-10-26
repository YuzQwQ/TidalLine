/* 普通锚点导航：支持直接链接、刷新、浏览器前进后退和键盘访问。 */
(() => {
  const pages = [...document.querySelectorAll('[data-wiki-page]')];
  const links = [...document.querySelectorAll('[data-wiki-link]')];
  function showPage() {
    const key = location.hash.slice(1);
    const active = pages.find(page => page.dataset.wikiPage === key) || pages[0];
    for (const page of pages) page.hidden = page !== active;
    for (const link of links) {
      if (link.dataset.wikiLink === active.dataset.wikiPage) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    document.title = '潮汐线 Wiki · ' + active.getAttribute('aria-label');
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', showPage);
  showPage();
})();
