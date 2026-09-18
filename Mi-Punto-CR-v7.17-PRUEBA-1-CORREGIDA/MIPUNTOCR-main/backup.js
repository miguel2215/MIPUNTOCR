/* =========================
   RESPALDOS / RESTAURACIÓN
   Mi Punto CR v7.15
========================= */
const MPCR_BACKUP_VERSION = 1;
const MPCR_BACKUP_TABLES = [
  "categories",
  "products",
  "clients",
  "restaurant_tables",
  "cash_shifts",
  "table_accounts",
  "sales",
  "sale_items",
  "payments",
  "credit_movements",
  "cash_movements",
  "orders",
  "order_items",
  "inventory_movements",
  "audit_log"
];

let pendingBackupRestore = null;

function backupReady() {
  return !!(role === "owner" && mpCloud && mpCloudUser && mpCloudBusiness?.id && state.settings.cloudLinked);
}

function renderBackupSettingsPanel() {
  if (role !== "owner") return "";
  const online = navigator.onLine;
  return `<div class="panel" style="margin-top:14px">
    <div class="row-head">
      <div>
        <strong>Copias de seguridad</strong>
        <p class="muted" style="margin:5px 0 0">Descarga un respaldo del negocio desde Supabase y úsalo para recuperar información si fuera necesario.</p>
      </div>
    </div>
    <div class="toolbar" style="margin-top:12px">
      <button class="btn primary" onclick="cloudExportBusinessBackup()" ${online ? "" : "disabled"}>Descargar respaldo</button>
      <button class="btn ghost" onclick="openBackupRestore()" ${online ? "" : "disabled"}>Restaurar respaldo</button>
    </div>
    <input id="backupRestoreFile" type="file" accept="application/json,.json" hidden onchange="readBackupRestoreFile(this)">
    <p class="muted" style="margin:10px 0 0">Solo el Dueño puede exportar o restaurar. La restauración recupera los registros incluidos en el archivo y no elimina información más nueva que no esté en ese respaldo.</p>
  </div>`;
}

function backupFileName(name, exportedAt) {
  const safe = String(name || "negocio")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "negocio";
  const date = new Date(exportedAt || Date.now()).toISOString().slice(0, 10);
  return `Mi-Punto-CR-${safe}-${date}.json`;
}

async function backupSelectAll(table, businessId) {
  const pageSize = 1000;
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await mpCloud
      .from(table)
      .select("*")
      .eq("business_id", businessId)
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const batch = data || [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows;
}

async function backupAudit(action, newData = null) {
  if (!backupReady()) return;
  try {
    await mpCloud.from("audit_log").insert({
      business_id: mpCloudBusiness.id,
      user_id: mpCloudUser.id,
      action,
      entity_type: "backup",
      entity_id: null,
      old_data: null,
      new_data: newData
    });
  } catch (error) {
    console.warn("Auditoría respaldo:", error?.message || error);
  }
}

window.cloudExportBusinessBackup = async () => {
  if (role !== "owner") return toast("Solo el Dueño puede crear respaldos.");
  if (!navigator.onLine) return toast("Necesitas Internet para descargar el respaldo.");
  if (!backupReady()) return toast("La cuenta no está conectada a la nube.");

  try {
    modal(`<h3>Preparando respaldo</h3><p class="muted">Estamos leyendo la información del negocio desde Supabase. No cierres esta ventana.</p>`);

    // Primero intenta subir cualquier trabajo offline pendiente.
    await cloudSyncCatalogClients({ silent: true });
    await cloudSyncOperations({ silent: true });

    const businessId = mpCloudBusiness.id;
    const { data: business, error: businessError } = await mpCloud
      .from("businesses")
      .select("id,name,business_type,settings,created_at,updated_at")
      .eq("id", businessId)
      .single();
    if (businessError) throw businessError;

    const tables = {};
    for (const table of MPCR_BACKUP_TABLES) {
      tables[table] = await backupSelectAll(table, businessId);
    }

    const exportedAt = new Date().toISOString();
    const payload = {
      app: "Mi Punto CR",
      backupVersion: MPCR_BACKUP_VERSION,
      exportedAt,
      businessId,
      businessName: business?.name || state.settings.businessName || "Mi Punto CR",
      businessType: business?.business_type || state.settings.businessType || "food",
      business,
      tables
    };

    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = backupFileName(payload.businessName, exportedAt);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);

    await backupAudit("backup_export", {
      exported_at: exportedAt,
      counts: Object.fromEntries(Object.entries(tables).map(([key, value]) => [key, value.length]))
    });

    closeModal();
    toast("Respaldo descargado.");
  } catch (error) {
    console.error("Respaldo:", error);
    closeModal();
    toast(`No se pudo crear el respaldo: ${cloudAuthErrorMessage(error)}`);
  }
};

window.openBackupRestore = () => {
  if (role !== "owner") return toast("Solo el Dueño puede restaurar respaldos.");
  if (!navigator.onLine) return toast("Necesitas Internet para restaurar.");
  const input = document.querySelector("#backupRestoreFile");
  if (!input) return toast("Abre Configuración e inténtalo de nuevo.");
  input.value = "";
  input.click();
};

function backupSummaryHtml(backup) {
  const t = backup.tables || {};
  const items = [
    ["Productos / servicios", (t.products || []).length],
    ["Clientes", (t.clients || []).length],
    ["Ventas", (t.sales || []).length],
    ["Pagos", (t.payments || []).length],
    ["Cajas", (t.cash_shifts || []).length],
    ["Pedidos", (t.orders || []).length]
  ];
  return items.map(([label, count]) => `<div class="ticket-line"><span>${esc(label)}</span><strong>${Number(count || 0)}</strong></div>`).join("");
}

window.readBackupRestoreFile = async input => {
  const file = input?.files?.[0];
  if (!file) return;
  if (file.size > 50 * 1024 * 1024) {
    input.value = "";
    return toast("El archivo supera el límite de 50 MB.");
  }

  try {
    const parsed = JSON.parse(await file.text());
    if (parsed?.app !== "Mi Punto CR" || Number(parsed?.backupVersion || 0) !== MPCR_BACKUP_VERSION || !parsed?.tables) {
      throw new Error("El archivo no es un respaldo válido de Mi Punto CR.");
    }
    if (!backupReady()) throw new Error("La cuenta no está conectada a la nube.");
    if (String(parsed.businessId || "") !== String(mpCloudBusiness.id || "")) {
      throw new Error("Este respaldo pertenece a otro negocio.");
    }

    pendingBackupRestore = parsed;
    modal(`<h3>Restaurar respaldo</h3>
      <p class="muted">Respaldo de <strong>${esc(parsed.businessName || "Mi Punto CR")}</strong> · ${esc(dateTime(parsed.exportedAt))}</p>
      <div style="margin:14px 0">${backupSummaryHtml(parsed)}</div>
      <div class="setup-note">La restauración reemplaza por ID los registros incluidos en el respaldo, pero no borra registros más nuevos que no estén en el archivo. Debes estar conectado a Internet.</div>
      <p style="margin:14px 0 7px"><strong>Para confirmar escribe RESTAURAR</strong></p>
      <input id="restoreConfirmText" autocomplete="off" placeholder="RESTAURAR" style="text-transform:uppercase">
      <div class="toolbar" style="margin-top:14px">
        <button class="btn danger" onclick="confirmCloudRestoreBackup()">Restaurar ahora</button>
        <button class="btn ghost" onclick="pendingBackupRestore=null;closeModal()">Cancelar</button>
      </div>`);
  } catch (error) {
    console.error("Leer respaldo:", error);
    pendingBackupRestore = null;
    toast(error?.message || "No se pudo leer el respaldo.");
  } finally {
    input.value = "";
  }
};

function backupRows(backup, table) {
  return Array.isArray(backup?.tables?.[table]) ? backup.tables[table] : [];
}

function backupBusinessRows(backup, table, transform = null) {
  return backupRows(backup, table).map(row => {
    const next = { ...row, business_id: mpCloudBusiness.id };
    return transform ? transform(next, row) : next;
  });
}

async function backupUpsert(table, rows, { ignoreDuplicates = false } = {}) {
  if (!rows.length) return;
  const chunkSize = 200;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await mpCloud
      .from(table)
      .upsert(chunk, { onConflict: "id", ignoreDuplicates });
    if (error) throw error;
  }
}

window.confirmCloudRestoreBackup = async () => {
  if (role !== "owner") return toast("Solo el Dueño puede restaurar respaldos.");
  if (!navigator.onLine) return toast("Necesitas Internet para restaurar.");
  if (!pendingBackupRestore) return toast("Selecciona nuevamente el respaldo.");
  if (String(document.querySelector("#restoreConfirmText")?.value || "").trim().toUpperCase() !== "RESTAURAR") {
    return toast("Escribe RESTAURAR para confirmar.");
  }

  const backup = pendingBackupRestore;
  pendingBackupRestore = null;

  try {
    modal(`<h3>Restaurando</h3><p class="muted">Estamos recuperando la información en Supabase. No cierres Mi Punto CR hasta que termine.</p>`);

    const businessPatch = {
      name: backup.business?.name || backup.businessName || mpCloudBusiness.name,
      business_type: backup.business?.business_type || backup.businessType || mpCloudBusiness.business_type,
      settings: backup.business?.settings && typeof backup.business.settings === "object" ? backup.business.settings : (mpCloudBusiness.settings || {})
    };
    const { data: restoredBusiness, error: businessError } = await mpCloud
      .from("businesses")
      .update(businessPatch)
      .eq("id", mpCloudBusiness.id)
      .select("*")
      .single();
    if (businessError) throw businessError;

    // Dependencias básicas.
    await backupUpsert("categories", backupBusinessRows(backup, "categories"));
    await backupUpsert("products", backupBusinessRows(backup, "products"));
    await backupUpsert("clients", backupBusinessRows(backup, "clients"));
    await backupUpsert("restaurant_tables", backupBusinessRows(backup, "restaurant_tables"));
    await backupUpsert("cash_shifts", backupBusinessRows(backup, "cash_shifts"));

    // Rompemos temporalmente el ciclo table_accounts <-> sales.
    const originalAccounts = backupBusinessRows(backup, "table_accounts");
    await backupUpsert("table_accounts", originalAccounts.map(row => ({ ...row, paid_sale_id: null })));
    await backupUpsert("sales", backupBusinessRows(backup, "sales"));
    await backupUpsert("table_accounts", originalAccounts);

    await backupUpsert("sale_items", backupBusinessRows(backup, "sale_items"));
    await backupUpsert("payments", backupBusinessRows(backup, "payments"));
    await backupUpsert("credit_movements", backupBusinessRows(backup, "credit_movements"));
    await backupUpsert("cash_movements", backupBusinessRows(backup, "cash_movements"));
    await backupUpsert("orders", backupBusinessRows(backup, "orders"));
    await backupUpsert("order_items", backupBusinessRows(backup, "order_items"));

    // Tablas de solo historial: si el ID ya existe, se conserva el registro actual.
    await backupUpsert("inventory_movements", backupBusinessRows(backup, "inventory_movements"), { ignoreDuplicates: true });
    await backupUpsert("audit_log", backupBusinessRows(backup, "audit_log"), { ignoreDuplicates: true });

    mpCloudBusiness = restoredBusiness || { ...mpCloudBusiness, ...businessPatch };
    await cloudPersistLocalIdentity(mpCloudUser, mpCloudBusiness, mpCloudMembership);

    // Recarga local directamente desde la nube sin subir primero el caché viejo.
    const catalogRemote = await cloudLoadCatalogClientsRemote();
    await cloudMergeRemoteCatalogClients(catalogRemote);
    const operationsRemote = await cloudLoadOperationsRemote();
    await cloudMergeOperationsRemote(operationsRemote);

    await backupAudit("backup_restore", {
      backup_exported_at: backup.exportedAt || null,
      restored_at: new Date().toISOString()
    });

    closeModal();
    screen = "home";
    render();
    toast("Respaldo restaurado correctamente.");
  } catch (error) {
    console.error("Restaurar respaldo:", error);
    closeModal();
    toast(`No se pudo completar la restauración: ${cloudAuthErrorMessage(error)}`);
  }
};
