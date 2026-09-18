/* =========================
   NUBE / SUPABASE AUTH
   Mi Punto CR v7.10
========================= */
const MPCR_SUPABASE_URL = "https://uspycwpztzkenwsevvrp.supabase.co";
const MPCR_SUPABASE_KEY = "sb_publishable_gRxzhxgEe3WnqSfA-fn6_w_nOtQ7sDy";
const MPCR_SITE_URL = "https://mipuntocr.mieduar2215.workers.dev/";

let mpCloud = null;
let mpCloudSession = null;
let mpCloudUser = null;
let mpCloudBusiness = null;
let mpCloudAuthSubscription = null;

function cloudSdkAvailable() {
  return !!window.supabase?.createClient;
}

function initCloudClient() {
  if (mpCloud) return true;
  if (!cloudSdkAvailable()) return false;
  mpCloud = window.supabase.createClient(MPCR_SUPABASE_URL, MPCR_SUPABASE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
  return true;
}

function cloudAuthErrorMessage(error) {
  const msg = String(error?.message || error || "").toLowerCase();
  if (!msg) return "No se pudo completar la operación.";
  if (msg.includes("invalid login credentials")) return "Correo o contraseña incorrectos.";
  if (msg.includes("email not confirmed")) return "Primero confirma tu correo electrónico.";
  if (msg.includes("user already registered")) return "Ese correo ya tiene una cuenta. Usa Iniciar sesión.";
  if (msg.includes("password should be")) return "La contraseña no cumple los requisitos de seguridad.";
  if (msg.includes("rate limit") || msg.includes("email rate limit")) return "Espera un momento antes de volver a solicitar el correo.";
  if (msg.includes("fetch") || msg.includes("network")) return "No se pudo conectar con la nube. Revisa Internet.";
  return error?.message || "No se pudo completar la operación.";
}

function cloudBusinessSettingsPayload() {
  return {
    phone: state.settings.phone || "",
    whatsapp: state.settings.whatsapp || "",
    sinpe: state.settings.sinpe || "",
    taxMode: state.settings.taxMode || "added",
    taxRate: Number(state.settings.taxRate ?? 13),
    tableCount: Number(state.settings.tableCount || 0)
  };
}


function cloudUuid() {
  if (crypto?.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
function cloudNorm(value) {
  return String(value || "").trim().toLocaleLowerCase("es");
}
function cloudCatalogConnected() {
  return !!(mpCloud && mpCloudUser && mpCloudBusiness?.id && state.settings.cloudLinked);
}
async function cloudCategoryRows() {
  if (!cloudCatalogConnected()) return [];
  const { data, error } = await mpCloud
    .from("categories")
    .select("id,business_id,name,business_type,sort_order,active")
    .eq("business_id", mpCloudBusiness.id)
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return data || [];
}
async function cloudEnsureCategory(name, businessType, cachedRows = null) {
  const cleanName = String(name || "Otros").trim() || "Otros";
  const kind = ["food", "products", "services"].includes(businessType) ? businessType : "food";
  const rows = cachedRows || await cloudCategoryRows();
  const found = rows.find(row => row.business_type === kind && cloudNorm(row.name) === cloudNorm(cleanName));
  if (found) return found;

  const { data, error } = await mpCloud
    .from("categories")
    .insert({ business_id: mpCloudBusiness.id, name: cleanName, business_type: kind, active: true, sort_order: rows.length })
    .select("id,business_id,name,business_type,sort_order,active")
    .single();
  if (error) {
    // Puede ocurrir si dos dispositivos crean la misma categoría a la vez.
    const refreshed = await cloudCategoryRows();
    const retry = refreshed.find(row => row.business_type === kind && cloudNorm(row.name) === cloudNorm(cleanName));
    if (retry) return retry;
    throw error;
  }
  if (cachedRows) cachedRows.push(data);
  return data;
}
async function cloudUpsertProduct(localProduct, categoryRows = null) {
  if (!cloudCatalogConnected() || !navigator.onLine) return null;
  const category = await cloudEnsureCategory(localProduct.category || "Otros", localProduct.businessType || type(), categoryRows);
  const remoteId = localProduct.cloudId || (String(localProduct.id || "").match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i) ? localProduct.id : cloudUuid());
  const payload = {
    id: remoteId,
    business_id: mpCloudBusiness.id,
    category_id: category.id,
    business_type: localProduct.businessType || type(),
    name: localProduct.name,
    description: localProduct.description || null,
    price: Number(localProduct.price || 0),
    cost: localProduct.cost == null ? null : Number(localProduct.cost),
    stock: isNaN(Number(localProduct.stock)) ? 0 : Number(localProduct.stock || 0),
    sku: localProduct.sku || null,
    variant: null,
    variants: Array.isArray(localProduct.variants) ? localProduct.variants : [],
    active: localProduct.active !== false,
    updated_at: new Date().toISOString()
  };
  const { data, error } = await mpCloud
    .from("products")
    .upsert(payload, { onConflict: "id" })
    .select("*")
    .single();
  if (error) throw error;
  localProduct.cloudId = data.id;
  localProduct.cloudPending = false;
  localProduct.cloudSyncedAt = new Date().toISOString();
  return data;
}
async function cloudDeleteProduct(localProduct) {
  if (!cloudCatalogConnected() || !navigator.onLine || !localProduct) return false;
  const remoteId = localProduct.cloudId || (String(localProduct.id || "").match(/^[0-9a-f-]{36}$/i) ? localProduct.id : "");
  if (!remoteId) return true;
  const { error } = await mpCloud.from("products").delete().eq("id", remoteId).eq("business_id", mpCloudBusiness.id);
  if (error) throw error;
  return true;
}
async function cloudUpsertClient(localClient) {
  if (!cloudCatalogConnected() || !navigator.onLine) return null;
  const remoteId = localClient.cloudId || (String(localClient.id || "").match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i) ? localClient.id : cloudUuid());
  const payload = {
    id: remoteId,
    business_id: mpCloudBusiness.id,
    name: localClient.name,
    phone: localClient.phone || null,
    email: localClient.email || null,
    notes: localClient.notes || null,
    active: localClient.active !== false,
    updated_at: new Date().toISOString()
  };
  const { data, error } = await mpCloud
    .from("clients")
    .upsert(payload, { onConflict: "id" })
    .select("*")
    .single();
  if (error) throw error;
  localClient.cloudId = data.id;
  localClient.cloudPending = false;
  localClient.cloudSyncedAt = new Date().toISOString();
  return data;
}
async function cloudLoadCatalogClientsRemote() {
  if (!cloudCatalogConnected() || !navigator.onLine) return null;
  const businessId = mpCloudBusiness.id;
  const [categoriesResult, productsResult, clientsResult] = await Promise.all([
    mpCloud.from("categories").select("id,name,business_type,sort_order,active").eq("business_id", businessId).eq("active", true),
    mpCloud.from("products").select("*").eq("business_id", businessId).eq("active", true).order("created_at", { ascending: true }),
    mpCloud.from("clients").select("*").eq("business_id", businessId).eq("active", true).order("created_at", { ascending: true })
  ]);
  if (categoriesResult.error) throw categoriesResult.error;
  if (productsResult.error) throw productsResult.error;
  if (clientsResult.error) throw clientsResult.error;
  return {
    categories: categoriesResult.data || [],
    products: productsResult.data || [],
    clients: clientsResult.data || []
  };
}
async function cloudMergeRemoteCatalogClients(remote) {
  if (!remote) return;
  const categoryById = new Map(remote.categories.map(row => [row.id, row]));
  const localProductByCloud = new Map(state.products.filter(p => p.cloudId).map(p => [p.cloudId, p]));
  const localClientByCloud = new Map(state.clients.filter(c => c.cloudId).map(c => [c.cloudId, c]));

  const products = remote.products.map(row => {
    const existing = localProductByCloud.get(row.id);
    const category = categoryById.get(row.category_id)?.name || existing?.category || "Otros";
    return {
      ...(existing || {}),
      id: existing?.id || row.id,
      cloudId: row.id,
      cloudPending: false,
      businessType: row.business_type || existing?.businessType || state.settings.businessType || "food",
      name: row.name,
      description: row.description || "",
      price: Number(row.price || 0),
      cost: row.cost == null ? null : Number(row.cost),
      stock: Number(row.stock || 0),
      sku: row.sku || "",
      variants: Array.isArray(row.variants) ? row.variants : [],
      category,
      active: row.active !== false,
      cloudSyncedAt: row.updated_at || new Date().toISOString()
    };
  });
  const clients = remote.clients.map(row => {
    const existing = localClientByCloud.get(row.id);
    return {
      ...(existing || {}),
      id: existing?.id || row.id,
      cloudId: row.id,
      cloudPending: false,
      name: row.name,
      phone: row.phone || "",
      email: row.email || "",
      notes: row.notes || "",
      active: row.active !== false,
      balance: existing?.balance || 0,
      cloudSyncedAt: row.updated_at || new Date().toISOString()
    };
  });

  await clearStore("products");
  await clearStore("clients");
  for (const product of products) await put("products", product);
  for (const client of clients) await put("clients", client);
  state.products = products;
  state.clients = clients;
}
async function cloudSyncCatalogClients({ silent = false } = {}) {
  if (!cloudCatalogConnected() || !navigator.onLine) return false;
  try {
    let remote = await cloudLoadCatalogClientsRemote();
    const categoryRows = remote.categories.slice();

    // Primera sincronización: lo que exista en el caché de ESTE negocio se sube
    // antes de descargar, para no perder pruebas hechas justo antes de v7.10.
    for (const product of state.products) {
      if (!product.cloudId && remote.products.length) {
        const catName = product.category || "Otros";
        const match = remote.products.find(row => {
          const cat = categoryRows.find(c => c.id === row.category_id);
          return row.business_type === (product.businessType || type()) && cloudNorm(row.name) === cloudNorm(product.name) && cloudNorm(cat?.name || "Otros") === cloudNorm(catName);
        });
        if (match) product.cloudId = match.id;
      }
      if (!product.cloudId || product.cloudPending) {
        await cloudUpsertProduct(product, categoryRows);
        await put("products", product);
      }
    }

    for (const client of state.clients) {
      if (!client.cloudId && remote.clients.length) {
        const match = remote.clients.find(row => cloudNorm(row.name) === cloudNorm(client.name) && cloudNorm(row.phone || "") === cloudNorm(client.phone || ""));
        if (match) client.cloudId = match.id;
      }
      if (!client.cloudId || client.cloudPending) {
        await cloudUpsertClient(client);
        await put("clients", client);
      }
    }

    remote = await cloudLoadCatalogClientsRemote();
    await cloudMergeRemoteCatalogClients(remote);
    state.settings.catalogCloudV710Ready = true;
    state.settings.catalogLastCloudSyncAt = new Date().toISOString();
    await put("settings", state.settings);
    if (!silent) toast("Catálogo y clientes sincronizados.");
    return true;
  } catch (error) {
    console.error("Supabase catálogo/clientes:", error);
    if (!silent) toast("No se pudo sincronizar con la nube. Los datos quedan pendientes.");
    return false;
  }
}
async function cloudSaveProductFromApp(product) {
  if (!state.settings.cloudLinked) return false;
  if (!navigator.onLine) {
    product.cloudPending = true;
    return false;
  }
  await cloudUpsertProduct(product);
  return true;
}
async function cloudSaveClientFromApp(client) {
  if (!state.settings.cloudLinked) return false;
  if (!navigator.onLine) {
    client.cloudPending = true;
    return false;
  }
  await cloudUpsertClient(client);
  return true;
}

async function cloudPersistLocalIdentity(user, business) {
  const meta = user?.user_metadata || {};
  const remoteSettings = business?.settings && typeof business.settings === "object" ? business.settings : {};
  const nextBusinessId = business?.id || "";

  // Cada cuenta/negocio usa su propio caché local. Los datos locales anteriores
  // eran de prueba y no se mezclan con una cuenta real distinta.
  if (nextBusinessId && state.settings.localDataBusinessId !== nextBusinessId) {
    await resetLocalBusinessCache();
    state.settings.pinEnabled = false;
    state.settings.ownerPin = "";
    state.settings.cashierPin = "";
  }

  state.settings = {
    ...state.settings,
    ...remoteSettings,
    ownerName: meta.full_name || state.settings.ownerName || "",
    businessName: business?.name || meta.business_name || state.settings.businessName || "Mi Punto CR",
    email: user?.email || state.settings.email || "",
    businessType: business?.business_type || meta.business_type || state.settings.businessType || "food",
    accountCreated: true,
    onboardingComplete: true,
    activated: !!user?.email_confirmed_at,
    activationUsed: !!user?.email_confirmed_at,
    pendingCloudConfirmation: false,
    cloudLinked: true,
    cloudUserId: user?.id || "",
    cloudBusinessId: business?.id || "",
    localDataBusinessId: nextBusinessId,
    sessionActive: true
  };

  if (!state.settings.businessId || String(state.settings.businessId).startsWith("00000000-")) {
    const short = String(business?.id || "").replace(/-/g, "").slice(0, 10).toUpperCase();
    state.settings.businessId = short ? `MPCR-${short}` : state.settings.businessId;
  }

  await put("settings", state.settings);
}

async function cloudFindOwnedBusiness(userId) {
  if (!mpCloud || !userId) return null;
  const { data, error } = await mpCloud
    .from("businesses")
    .select("*")
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

async function cloudCreateBusinessForUser(user) {
  const meta = user?.user_metadata || {};
  const name = String(meta.business_name || state.settings.businessName || "Mi Punto CR").trim() || "Mi Punto CR";
  const businessType = ["food", "products", "services"].includes(meta.business_type)
    ? meta.business_type
    : (state.settings.businessType || "food");

  const payload = {
    name,
    business_type: businessType,
    owner_user_id: user.id,
    active: true,
    settings: cloudBusinessSettingsPayload()
  };

  const { data, error } = await mpCloud
    .from("businesses")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

async function cloudEnsureBusiness(user) {
  if (!mpCloud || !user) return null;
  let business = await cloudFindOwnedBusiness(user.id);
  if (!business) business = await cloudCreateBusinessForUser(user);
  mpCloudBusiness = business;
  await cloudPersistLocalIdentity(user, business);
  return business;
}

async function cloudHydrateSession(session) {
  mpCloudSession = session || null;
  mpCloudUser = session?.user || null;
  if (!mpCloudUser) return null;
  const business = await cloudEnsureBusiness(mpCloudUser);
  try { await cloudSyncCatalogClients({ silent: true }); } catch (error) { console.error("Catálogo inicial:", error); }
  return { user: mpCloudUser, business };
}

async function initCloudAuth() {
  if (!initCloudClient()) return false;

  try {
    const { data, error } = await mpCloud.auth.getSession();
    if (error) throw error;

    if (data?.session) {
      await cloudHydrateSession(data.session);
    } else if (navigator.onLine && state.settings.cloudLinked) {
      state.settings.sessionActive = false;
      await put("settings", state.settings);
    }

    if (!mpCloudAuthSubscription) {
      const { data: listener } = mpCloud.auth.onAuthStateChange(async (event, session) => {
        mpCloudSession = session || null;
        mpCloudUser = session?.user || null;

        if (session?.user && ["SIGNED_IN", "TOKEN_REFRESHED", "USER_UPDATED", "INITIAL_SESSION"].includes(event)) {
          try {
            await cloudHydrateSession(session);
            if (db && !document.querySelector("#modalRoot")) render();
          } catch (error) {
            console.error("Supabase hydrate:", error);
          }
        }

        if (event === "SIGNED_OUT") {
          mpCloudBusiness = null;
        }
      });
      mpCloudAuthSubscription = listener?.subscription || true;
    }

    return true;
  } catch (error) {
    console.error("Supabase init:", error);
    return false;
  }
}

async function cloudRegisterOwner(draft, businessType) {
  if (!initCloudClient()) throw new Error("No se pudo cargar Supabase.");
  if (!navigator.onLine) throw new Error("Necesitas Internet para crear la cuenta.");

  const { data, error } = await mpCloud.auth.signUp({
    email: draft.email,
    password: draft.password,
    options: {
      emailRedirectTo: MPCR_SITE_URL,
      data: {
        full_name: draft.ownerName,
        business_name: draft.businessName,
        business_type: businessType
      }
    }
  });
  if (error) throw error;

  if (data?.session?.user) {
    await cloudHydrateSession(data.session);
  }

  return data;
}

async function cloudLoginOwner(email, password) {
  if (!initCloudClient()) throw new Error("No se pudo cargar Supabase.");
  if (!navigator.onLine) throw new Error("Necesitas Internet para iniciar sesión en un dispositivo nuevo.");

  const { data, error } = await mpCloud.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data?.session) throw new Error("No se pudo iniciar la sesión.");

  await cloudHydrateSession(data.session);
  return data;
}

async function cloudLogoutOwner() {
  if (!mpCloud && !initCloudClient()) return;
  try {
    await mpCloud.auth.signOut();
  } catch (error) {
    console.error("Supabase signOut:", error);
  }
  mpCloudSession = null;
  mpCloudUser = null;
  mpCloudBusiness = null;
}

async function cloudResendSignup(email) {
  if (!initCloudClient()) throw new Error("No se pudo cargar Supabase.");
  if (!navigator.onLine) throw new Error("Necesitas Internet para reenviar el correo.");
  const { error } = await mpCloud.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: MPCR_SITE_URL }
  });
  if (error) throw error;
}

async function cloudRefreshConfirmedSession() {
  if (!initCloudClient()) return null;
  const { data, error } = await mpCloud.auth.getSession();
  if (error) throw error;
  if (!data?.session) return null;
  await cloudHydrateSession(data.session);
  return data.session;
}

async function cloudSaveBusinessSettings() {
  if (!state.settings.cloudLinked || !state.settings.cloudBusinessId || !mpCloud) return false;
  if (!navigator.onLine) return false;

  const payload = {
    name: state.settings.businessName || "Mi Punto CR",
    business_type: state.settings.businessType || "food",
    settings: cloudBusinessSettingsPayload(),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await mpCloud
    .from("businesses")
    .update(payload)
    .eq("id", state.settings.cloudBusinessId)
    .select("*")
    .single();
  if (error) throw error;
  mpCloudBusiness = data;
  return true;
}

async function cloudConnectLegacyBusiness(email, password) {
  const draft = {
    ownerName: state.settings.ownerName || "Propietario",
    businessName: state.settings.businessName || "Mi Punto CR",
    email,
    password
  };
  return cloudRegisterOwner(draft, state.settings.businessType || "food");
}
