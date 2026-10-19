(function () {
  "use strict";

  var root = document.documentElement;
  var toggle = document.querySelector(".theme-toggle");

  function currentTheme() {
    return root.dataset.theme === "light" ? "light" : "dark";
  }

  function syncThemeControl() {
    if (!toggle) return;
    var isLight = currentTheme() === "light";
    toggle.setAttribute("aria-pressed", String(isLight));
    toggle.setAttribute("aria-label", isLight ? "Switch to dark theme" : "Switch to light theme");
  }

  function syncGiscus() {
    var frame = document.querySelector("iframe.giscus-frame");
    if (!frame || !frame.contentWindow) return;
    frame.contentWindow.postMessage({
      giscus: { setConfig: { theme: currentTheme() } }
    }, "https://giscus.app");
  }

  function connectGiscusFrame() {
    var frame = document.querySelector("iframe.giscus-frame");
    if (!frame || frame.dataset.themeListener === "true") return;
    frame.dataset.themeListener = "true";
    frame.addEventListener("load", syncGiscus);
    syncGiscus();
  }

  syncThemeControl();

  if (toggle) {
    toggle.addEventListener("click", function () {
      var next = currentTheme() === "dark" ? "light" : "dark";
      root.dataset.theme = next;
      try { localStorage.setItem("constellation-theme", next); } catch (_) {}
      syncThemeControl();
      syncGiscus();
    });
  }

  var observer = new MutationObserver(function () {
    connectGiscusFrame();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  connectGiscusFrame();

  if (typeof window.renderMathInElement === "function") {
    window.renderMathInElement(document.body, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "\\[", right: "\\]", display: true },
        { left: "\\(", right: "\\)", display: false }
      ],
      throwOnError: false
    });
  }

  var tocLinks = Array.prototype.slice.call(document.querySelectorAll(".toc a[href^='#']"));
  var tocEntries = tocLinks.map(function (link) {
    var id;
    try { id = decodeURIComponent(link.hash.slice(1)); } catch (_) { id = link.hash.slice(1); }
    return { link: link, section: document.getElementById(id) };
  }).filter(function (entry) { return entry.section; });
  var tocFramePending = false;

  function syncActiveTOC() {
    tocFramePending = false;
    if (!tocEntries.length) return;
    var headerHeight = parseFloat(getComputedStyle(root).getPropertyValue("--header-height")) || 70;
    var marker = headerHeight + 48;
    var active = tocEntries[0];

    tocEntries.forEach(function (entry) {
      if (entry.section.getBoundingClientRect().top <= marker) active = entry;
    });
    if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) {
      active = tocEntries[tocEntries.length - 1];
    }
    tocEntries.forEach(function (entry) {
      if (entry === active) entry.link.setAttribute("aria-current", "location");
      else entry.link.removeAttribute("aria-current");
    });
  }

  function queueTOCSync() {
    if (tocFramePending) return;
    tocFramePending = true;
    window.requestAnimationFrame(syncActiveTOC);
  }

  if (tocEntries.length) {
    syncActiveTOC();
    window.addEventListener("scroll", queueTOCSync, { passive: true });
    window.addEventListener("resize", queueTOCSync);
  }

  var dialog = document.querySelector(".search-dialog");
  var openButton = document.querySelector(".search-open");
  var closeButton = document.querySelector(".search-close");
  var input = document.getElementById("site-search");
  var results = document.querySelector(".search-results");
  var searchIndex = null;

  function openSearch() {
    if (!dialog) return;
    dialog.showModal();
    window.setTimeout(function () { input.focus(); }, 0);
    if (!searchIndex) {
      fetch("/index.json")
        .then(function (response) { return response.json(); })
        .then(function (data) { searchIndex = data; })
        .catch(function () {
          results.innerHTML = "<li class=\"search-empty\">Search could not be loaded.</li>";
        });
    }
  }

  function renderResults(query) {
    if (!searchIndex || query.length < 2) {
      results.innerHTML = "";
      return;
    }
    var terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    var matches = searchIndex.filter(function (item) {
      var haystack = (item.title + " " + item.summary + " " + item.content).toLowerCase();
      return terms.every(function (term) { return haystack.indexOf(term) !== -1; });
    }).slice(0, 8);
    results.innerHTML = matches.length ? matches.map(function (item) {
      return "<li><a href=\"" + item.permalink + "\"><strong>" + escapeHTML(item.title) + "</strong><span>" + escapeHTML(item.date) + "</span><p>" + escapeHTML(item.summary) + "</p></a></li>";
    }).join("") : "<li class=\"search-empty\">No matching notes found.</li>";
  }

  function escapeHTML(value) {
    var node = document.createElement("span");
    node.textContent = value || "";
    return node.innerHTML;
  }

  if (openButton) openButton.addEventListener("click", openSearch);
  if (closeButton) closeButton.addEventListener("click", function () { dialog.close(); });
  if (dialog) dialog.addEventListener("click", function (event) { if (event.target === dialog) dialog.close(); });
  if (input) input.addEventListener("input", function () { renderResults(input.value.trim()); });

  document.addEventListener("keydown", function (event) {
    if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey && !/INPUT|TEXTAREA/.test(document.activeElement.tagName)) {
      event.preventDefault();
      openSearch();
    }
  });
}());

