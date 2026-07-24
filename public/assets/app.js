(() => {
  const root = document.documentElement;
  const savedTheme = localStorage.getItem("study-theme");
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;

  if (savedTheme === "dark" || (!savedTheme && prefersDark)) {
    root.dataset.theme = "dark";
  }

  const updateThemeLabels = () => {
    const dark = root.dataset.theme === "dark";
    document.querySelectorAll(".theme-toggle").forEach((button) => {
      button.textContent = dark ? "浅色" : "深色";
      button.setAttribute("aria-label", dark ? "切换为浅色主题" : "切换为深色主题");
    });
  };

  document.querySelectorAll(".theme-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      const next = root.dataset.theme === "dark" ? "light" : "dark";
      root.dataset.theme = next;
      localStorage.setItem("study-theme", next);
      updateThemeLabels();
    });
  });
  updateThemeLabels();

  const librarySearch = document.querySelector("[data-library-search]");
  if (librarySearch) {
    const cards = [...document.querySelectorAll(".document-card")];
    const sections = [...document.querySelectorAll(".library-section")];
    const status = document.querySelector(".search-status");
    const noResults = document.querySelector(".no-results");

    const filterLibrary = () => {
      const query = librarySearch.value.trim().toLowerCase();
      let visibleCount = 0;

      cards.forEach((card) => {
        const visible = !query || card.dataset.searchText.includes(query);
        card.hidden = !visible;
        if (visible) visibleCount += 1;
      });

      sections.forEach((section) => {
        section.hidden = !section.querySelector(".document-card:not([hidden])");
      });

      status.textContent = query
        ? `找到 ${visibleCount} 篇匹配文档`
        : `显示全部 ${cards.length} 篇文档`;
      noResults.hidden = visibleCount !== 0;
    };

    librarySearch.addEventListener("input", filterLibrary);
    document.addEventListener("keydown", (event) => {
      if (
        event.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        event.preventDefault();
        librarySearch.focus();
      }
    });
  }

  const sidebarSearch = document.querySelector("[data-sidebar-search]");
  if (sidebarSearch) {
    const links = [...document.querySelectorAll(".doc-nav-item")];
    sidebarSearch.addEventListener("input", () => {
      const query = sidebarSearch.value.trim().toLowerCase();
      links.forEach((link) => {
        link.hidden = Boolean(query) && !link.textContent.toLowerCase().includes(query);
      });
    });
  }

  const openSidebar = () => document.body.classList.add("sidebar-open");
  const closeSidebar = () => document.body.classList.remove("sidebar-open");
  document.querySelector(".mobile-nav-toggle")?.addEventListener("click", openSidebar);
  document.querySelector(".sidebar-close")?.addEventListener("click", closeSidebar);
  document.querySelector(".sidebar-scrim")?.addEventListener("click", closeSidebar);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeSidebar();
  });

  document.querySelectorAll(".copy-code").forEach((button) => {
    button.addEventListener("click", async () => {
      const code = button.closest(".code-block")?.querySelector("code")?.textContent ?? "";
      try {
        await navigator.clipboard.writeText(code);
        const previous = button.textContent;
        button.textContent = "已复制";
        setTimeout(() => {
          button.textContent = previous;
        }, 1400);
      } catch {
        button.textContent = "复制失败";
      }
    });
  });

  const tocLinks = [...document.querySelectorAll(".toc-list a")];
  if (tocLinks.length > 0 && "IntersectionObserver" in window) {
    const linkById = new Map(
      tocLinks.map((link) => [decodeURIComponent(link.hash.slice(1)), link]),
    );
    const headings = [...linkById.keys()]
      .map((id) => document.getElementById(id))
      .filter(Boolean);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top);
        if (visible.length === 0) return;
        tocLinks.forEach((link) => link.classList.remove("is-active"));
        linkById.get(visible[0].target.id)?.classList.add("is-active");
      },
      { rootMargin: "-82px 0px -72% 0px", threshold: [0, 1] },
    );

    headings.forEach((heading) => observer.observe(heading));
  }
})();
