"use strict";

/* ===================== CONFIG ===================== */
const API = "http://127.0.0.1:4000";
const $ = (id) => document.getElementById(id);

/* ===================== NAV ===================== */
document.querySelectorAll(".navItem").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".navItem").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    document.querySelectorAll(".page").forEach((p) => p.classList.add("hidden"));
    const tab = btn.dataset.tab;
    if (tab) $(tab)?.classList.remove("hidden");
  });
});

/* ===================== HELPERS ===================== */
function formatBRL(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "R$ 0,00";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getName(p) {
  // você tinha um item no Mongo com "no me" em vez de "nome"
  return p?.nome ?? p?.["no me"] ?? "-";
}

function debounce(fn, wait = 250) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

async function apiGet(path) {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function apiSend(path, method, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.status === 204 ? null : res.json();
}

/* ===================== API STATUS ===================== */
async function testApi() {
  const el = $("apiStatus");
  if (!el) return;

  try {
    const res = await fetch(`${API}/products`);
    const ok = res.ok;
    el.textContent = ok ? "API: OK" : "API: OFF";
    el.classList.toggle("ok", ok);
    el.classList.toggle("off", !ok);
  } catch {
    el.textContent = "API: OFF";
    el.classList.remove("ok");
    el.classList.add("off");
  }
}

/* ===================== CATEGORIES ===================== */
let categories = [];

function normalizeCategories(raw) {
  if (Array.isArray(raw) && raw.length && typeof raw[0] === "string") {
    return raw.map((name) => ({ _id: name, name }));
  }
  return (raw || []).map((c) => ({
    _id: c._id ?? c.id ?? c.nome ?? c.name,
    name: c.name ?? c.nome ?? String(c._id ?? ""),
  }));
}

async function loadCategories() {
  const raw = await apiGet("/categories");
  categories = normalizeCategories(raw);

  const filter = $("categoryFilter");
  const pCategory = $("pCategory");
  const list = $("categoriesList");

  if (filter) {
    filter.innerHTML =
      `<option value="">Todas categorias</option>` +
      categories.map((c) => `<option value="${c.name}">${c.name}</option>`).join("");
  }

  if (pCategory) {
    pCategory.innerHTML = categories
      .map((c) => `<option value="${c.name}">${c.name}</option>`)
      .join("");
  }

  if (list) {
    list.innerHTML = categories
      .map(
        (c) => `
        <div class="item">
          <div class="itemLeft">
            <div class="itemTitle">${c.name}</div>
          </div>
        </div>`
      )
      .join("");
  }
}

/* ===================== ADD CATEGORY ===================== */
$("categoryForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = $("cName")?.value?.trim?.() || "";
  if (!name) return;

  try {
    await apiSend("/categories", "POST", { name });
    $("cName").value = "";
    await refreshAll();
  } catch (err) {
    console.error(err);
    alert("Erro ao criar categoria.");
  }
});

/* ===================== PRODUCTS TABLE ===================== */
async function loadProductsTable() {
  const q = ($("globalSearch")?.value || "").trim().toLowerCase();
  const cat = ($("categoryFilter")?.value || "").trim();

  const products = await apiGet("/products");

  const filtered = (products || []).filter((p) => {
    const nome = String(getName(p)).toLowerCase();
    const categoria = String(p.categoria ?? "");
    const okSearch = !q || nome.includes(q);
    const okCat = !cat || categoria.toLowerCase() === cat.toLowerCase();
    return okSearch && okCat;
  });

  const tbody = $("productsTbody");

  if (!filtered.length) {
  tbody.innerHTML = `
    <tr>
      <td colspan="6" style="text-align:center;color:#9ca3af;padding:20px">
        Nenhum produto encontrado
      </td>
    </tr>
  `;
  return;
}
  if (!tbody) return;

  const totalEl = $("totalProductsTable");
if (totalEl) totalEl.textContent = filtered.length;

  tbody.innerHTML = filtered
    .map((p) => {
      const estoque = Number(p.estoque) || 0;
      const low = estoque < 10;
      const critical = estoque < 5;

      const badge =
        critical
          ? `<span class="badgeLow">crítico</span>`
          : low
          ? `<span class="badgeLow">baixo</span>`
          : "";

      return `
<tr>
        <td>${getName(p)}</td>
        <td>${p.marca ?? "-"}</td>
        <td>${p.veiculo ?? "-"}</td>
        <td>${formatBRL(p.preco)}</td>
        <td>${estoque} ${badge}</td>
        <td class="actions">
          <button class="smallBtn" data-plus="${p._id}" data-stock="${estoque}">+1</button>
          <button class="smallBtn" data-minus="${p._id}" data-stock="${estoque}">-1</button>
          <button class="smallBtn danger" data-delete="${p._id}">Excluir</button>
        </td>
      </tr>`;
    })
    .join("");

  document.querySelectorAll("[data-plus]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-plus");
      const current = Number(btn.getAttribute("data-stock") || 0);
      await apiSend(`/products/${id}/stock`, "PATCH", { estoque: current + 1 });
      await refreshAll();
    });
  });

  document.querySelectorAll("[data-minus]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-minus");
      const current = Number(btn.getAttribute("data-stock") || 0);
      await apiSend(`/products/${id}/stock`, "PATCH", { estoque: Math.max(0, current - 1) });
      await refreshAll();
    });
  });

  document.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-delete");
      await apiSend(`/products/${id}`, "DELETE");
      await refreshAll();
    });
  });
}

/* ===================== ADD PRODUCT ===================== */
$("productForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const body = {
    nome: $("pName")?.value?.trim?.() || "",
    marca: $("pBrand")?.value?.trim?.() || "",
    veiculo: $("pSku")?.value?.trim?.() || "",
    categoria: $("pCategory")?.value || "",
    preco: Number($("pPrice")?.value),
    estoque: Number($("pStock")?.value),
  };

  try {
    await apiSend("/products", "POST", body);
    e.target.reset();
    await refreshAll();
  } catch (err) {
    console.error(err);
    alert("Erro ao cadastrar produto.");
  }
});

/* ===================== CHART ===================== */
function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawChart(items) {
  const canvas = $("chart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;

  const Wcss = canvas.clientWidth || 600;
  const Hcss = canvas.getAttribute("height") ? Number(canvas.getAttribute("height")) : 240;

  canvas.width = Math.floor(Wcss * dpr);
  canvas.height = Math.floor(Hcss * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const W = Wcss;
  const H = Hcss;

  ctx.clearRect(0, 0, W, H);

  if (!items || !items.length) {
    ctx.fillStyle = "rgba(229,231,235,.65)";
    ctx.font = "14px system-ui";
    ctx.fillText("Sem dados para gráfico", 14, 22);
    return;
  }

  const padL = 44, padR = 16, padT = 18, padB = 36;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const values = items.map((x) => Number(x.count) || 0);
  const max = Math.max(...values, 1);

  // grid
  ctx.strokeStyle = "rgba(148,163,184,.22)";
  ctx.lineWidth = 1;
  ctx.font = "12px system-ui";
  ctx.fillStyle = "rgba(229,231,235,.60)";

  const ticks = 4;
  for (let i = 0; i <= ticks; i++) {
    const y = padT + (plotH * i) / ticks;

    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(W - padR, y);
    ctx.stroke();

    const v = Math.round(max * (1 - i / ticks));
    ctx.fillText(String(v), 10, y + 4);
  }

  const n = items.length;
  const slot = plotW / n;
  const barW = Math.max(18, Math.floor(slot * 0.62));

  items.forEach((it, i) => {
    const count = Number(it.count) || 0;
    const x = padL + i * slot + (slot - barW) / 2;
    const barH = (count / max) * plotH;
    const y = padT + plotH - barH;

    const grad = ctx.createLinearGradient(0, y, 0, y + barH);
    grad.addColorStop(0, "rgba(124,130,255,.95)");
    grad.addColorStop(1, "rgba(181,92,255,.92)");

    ctx.shadowColor = "rgba(0,0,0,.28)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 6;

    ctx.fillStyle = grad;
    roundRect(ctx, x, y, barW, barH, 10);
    ctx.fill();

    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // value
    ctx.fillStyle = "rgba(229,231,235,.88)";
    ctx.font = "12px system-ui";
    ctx.textAlign = "center";
    ctx.fillText(String(count), x + barW / 2, Math.max(14, y - 6));

    // label
    ctx.fillStyle = "rgba(229,231,235,.55)";
    const raw = String(it.category || "");
    const label = raw.length > 12 ? raw.slice(0, 12) + "…" : raw;
    ctx.fillText(label, x + barW / 2, H - 12);
  });

  ctx.textAlign = "start";
}

/* ===================== DASHBOARD ===================== */
async function loadDashboard() {
  // tenta usar /dashboard (melhor), se falhar calcula por /products
  let d = null;
  try {
    d = await apiGet("/dashboard");
  } catch {
    d = null;
  }

  let totalProducts = 0;
  let totalStockValue = 0;
  let lowStock = [];
  let byCategory = [];

  if (d && typeof d === "object") {
    totalProducts = Number(d.totalProducts) || 0;
    totalStockValue = Number(d.totalStockValue) || 0;
    lowStock = Array.isArray(d.lowStock) ? d.lowStock : [];

    if (Array.isArray(d.byCategory)) {
      byCategory = d.byCategory;
    }
  }

  // fallback completo: calcula tudo de /products
  if (!d || !Array.isArray(byCategory) || !byCategory.length) {
    const products = await apiGet("/products");
    totalProducts = (products || []).length;

    const map = new Map();
    lowStock = [];
    totalStockValue = 0;

    (products || []).forEach((p) => {
      const preco = Number(p.preco) || 0;
      const estoque = Number(p.estoque) || 0;
      totalStockValue += preco * estoque;

      if (estoque < 10) lowStock.push(p);

      const cat = String(p.categoria || "Sem categoria");
      map.set(cat, (map.get(cat) || 0) + 1);
    });

    byCategory = Array.from(map.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  }

  // KPIs
  if ($("kpiTotalProducts")) $("kpiTotalProducts").textContent = totalProducts;
  if ($("kpiTotalValue")) $("kpiTotalValue").textContent = formatBRL(totalStockValue);
  if ($("kpiLowStock")) $("kpiLowStock").textContent = (lowStock || []).length;

  // estoque baixo (Top 20)
  const list = $("lowStockList");
  if (list) {
    list.innerHTML = (lowStock || [])
      .slice(0, 20)
      .map((p) => {
        const estoque = Number(p.estoque) || 0;
        const critical = estoque < 5;
        return `
          <div class="item">
            <div class="itemLeft">
              <div class="itemTitle">${getName(p)}</div>
              <div class="itemSub">${p.marca ?? "-"} • ${p.categoria ?? "-"}</div>
            </div>
            <span class="badgeLow">${estoque} un.${critical ? " • crítico" : ""}</span>
          </div>`;
      })
      .join("");
  }

  // lista por categoria
  const catList = $("byCategoryList");
  if (catList) {
    catList.innerHTML = (byCategory || [])
      .map((x) => `<div class="miniRow"><span>${x.category}</span><span>${x.count}</span></div>`)
      .join("");
  }

  drawChart(byCategory || []);
}

/* ===================== EVENTS ===================== */
$("btnRefresh")?.addEventListener("click", () => refreshAll());

// Busca instantânea (sem Enter) — só atualiza tabela pra não pesar
const onSearch = debounce(() => {
  loadProductsTable().catch(console.error);
}, 250);

$("globalSearch")?.addEventListener("input", onSearch);

// ainda mantém Enter como “atualizar tudo”
$("globalSearch")?.addEventListener("keyup", (e) => {
  if (e.key === "Enter") refreshAll();
});

$("categoryFilter")?.addEventListener("change", () => refreshAll());

/* ===================== BOOT ===================== */
async function refreshAll() {
  await testApi();
  await loadCategories();
  await loadProductsTable();
  await loadDashboard();
}

refreshAll().catch((e) => {
  console.error(e);
  alert("Erro: " + e.message);
});