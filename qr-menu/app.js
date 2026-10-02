(() => {
  "use strict";

  const config = window.TCB_QR_MENU_CONFIG;
  const loading = document.getElementById("loading");
  const error = document.getElementById("error");
  const empty = document.getElementById("empty");
  const menu = document.getElementById("menu");
  const nav = document.getElementById("categoryNav");
  const retry = document.getElementById("retry");

  function setView(view) {
    loading.hidden = view !== "loading";
    error.hidden = view !== "error";
    empty.hidden = view !== "empty";
    menu.hidden = view !== "menu";
    nav.hidden = view !== "menu";
  }

  function slugify(value) {
    return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "section";
  }

  function formatPrice(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "₹—";
    const hasPaise = Math.round(n * 100) % 100 !== 0;
    return "₹" + n.toLocaleString("en-IN", {
      minimumFractionDigits: hasPaise ? 2 : 0,
      maximumFractionDigits: 2
    });
  }

  function buildMenu(items) {
    menu.replaceChildren();
    nav.replaceChildren();

    const grouped = new Map();
    for (const item of items) {
      const category = String(item.category || "Menu").trim() || "Menu";
      if (!grouped.has(category)) grouped.set(category, []);
      grouped.get(category).push(item);
    }

    let i = 0;
    for (const [category, rows] of grouped.entries()) {
      const id = "cat-" + slugify(category) + "-" + i++;

      const link = document.createElement("a");
      link.href = "#" + id;
      link.textContent = category;
      nav.append(link);

      const section = document.createElement("section");
      section.className = "menu-section";
      section.id = id;

      const title = document.createElement("h2");
      title.className = "section-title";
      title.textContent = category;
      section.append(title);

      for (const row of rows) {
        const item = document.createElement("div");
        item.className = "menu-row";

        const name = document.createElement("span");
        name.className = "dish-name";
        name.textContent = String(row.name || "").trim();

        const price = document.createElement("span");
        price.className = "dish-price";
        price.textContent = formatPrice(row.price);

        item.append(name, price);
        section.append(item);
      }

      menu.append(section);
    }
  }

  async function fetchMenu() {
    setView("loading");

    const query = new URLSearchParams({
      select: "category,name,price,sort_order,category_sort",
      active: "eq.true",
      order: "category_sort.asc,sort_order.asc,name.asc"
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6500);

    try {
      const response = await fetch(
        config.supabaseUrl + "/rest/v1/qr_menu_items?" + query.toString(),
        {
          headers: {
            apikey: config.anonKey,
            Authorization: "Bearer " + config.anonKey,
            Accept: "application/json"
          },
          signal: controller.signal,
          cache: "no-store"
        }
      );

      if (!response.ok) throw new Error("Menu request failed");
      const items = await response.json();

      if (!Array.isArray(items) || items.length === 0) {
        setView("empty");
        return;
      }

      buildMenu(items);
      setView("menu");
    } catch {
      setView("error");
    } finally {
      clearTimeout(timer);
    }
  }

  retry.addEventListener("click", fetchMenu);
  fetchMenu();
})();