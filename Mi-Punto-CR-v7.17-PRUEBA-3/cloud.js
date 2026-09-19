/* =========================
   NUBE / SUPABASE AUTH
   Mi Punto CR v7.11
========================= */
const MPCR_SUPABASE_URL = "https://uspycwpztzkenwsevvrp.supabase.co";
const MPCR_SUPABASE_KEY = "sb_publishable_gRxzhxgEe3WnqSfA-fn6_w_nOtQ7sDy";
const MPCR_SITE_URL = "https://mipuntocr.mieduar2215.workers.dev/";

let mpCloud = null;
let mpCloudSession = null;
let mpCloudUser = null;
let mpCloudBusiness = null;
let mpCloudMembership = null;
let mpCloudAuthSubscription = null;
let mpPasswordRecovery = false;
let mpEmployeeLoginInProgress = false;

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
  if (msg.includes("código de invitación inválido") || msg.includes("codigo de invitacion invalido")) return "Código de invitación inválido o ya utilizado.";
  if (msg.includes("invitación venció") || msg.includes("invitacion vencio")) return "La invitación venció. Pide al dueño una nueva.";
  if (msg.includes("otro correo")) return "Ese código fue creado para otro correo.";
  if (msg.includes("código de empleado incorrecto") || msg.includes("codigo de empleado incorrecto")) return "Código de empleado incorrecto.";
  if (msg.includes("anonymous") || msg.includes("anonymous sign-ins")) return "Activa el acceso anónimo en Supabase para usar códigos de empleado.";
  if (msg.includes("provider is not enabled") || msg.includes("unsupported provider")) return "Ese método de acceso todavía no está activado en Supabase.";
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
  await cloudFlushTrackingQueues(localProduct);
  return data;
}
async function cloudDeleteProduct(localProduct) {
  if (!cloudCatalogConnected() || !navigator.onLine || !localProduct) return false;
  const remoteId = localProduct.cloudId || (String(localProduct.id || "").match(/^[0-9a-f-]{36}$/i) ? localProduct.id : "");
  if (!remoteId) return true;
  const before = { name: localProduct.name, category: localProduct.category, price: Number(localProduct.price || 0), stock: Number(localProduct.stock || 0), active: true };
  const { error } = await mpCloud.from("products").update({ active: false, updated_at: new Date().toISOString() }).eq("id", remoteId).eq("business_id", mpCloudBusiness.id);
  if (error) throw error;
  localProduct.cloudId = remoteId;
  cloudQueueAuditEvent(localProduct, "delete", "product", before, { ...before, active: false });
  try { await cloudFlushAuditQueue(localProduct); } catch (auditError) { console.error("Auditoría producto eliminado:", auditError); }
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
  await cloudFlushTrackingQueues(localClient);
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

async function cloudPersistLocalIdentity(user, business, membership = null) {
  const meta = user?.user_metadata || {};
  const remoteSettings = business?.settings && typeof business.settings === "object" ? business.settings : {};
  const nextBusinessId = business?.id || "";
  const memberRole = membership?.role || (business?.owner_user_id === user?.id ? "owner" : "employee");
  const memberPermissions = membership?.permissions && typeof membership.permissions === "object" ? membership.permissions : {};

  // Cada cuenta/negocio usa su propio caché local.
  if (nextBusinessId && state.settings.localDataBusinessId !== nextBusinessId) {
    // Si venimos del modo sin cuenta, conservamos los datos locales para subirlos al nuevo negocio.
    if (!state.settings.guestMode) await resetLocalBusinessCache();
    state.settings.pinEnabled = false;
    state.settings.ownerPin = "";
    state.settings.cashierPin = "";
  }

  state.settings = {
    ...state.settings,
    ...remoteSettings,
    ownerName: memberRole === "owner" ? (meta.full_name || state.settings.ownerName || "") : (state.settings.ownerName || ""),
    memberDisplayName: membership?.display_name || meta.full_name || user?.email || "",
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
    cloudRole: ["owner","admin","employee"].includes(memberRole) ? memberRole : "employee",
    cloudPermissions: memberPermissions,
    employeeId: membership?.employee_id || (memberRole === "employee" ? state.settings.employeeId || "" : ""),
    employeeCode: membership?.employee_code || (memberRole === "employee" ? state.settings.employeeCode || "" : ""),
    lastCloudBusinessId: nextBusinessId || state.settings.lastCloudBusinessId || "",
    guestMode: false,
    needsBusinessJoin: false,
    pendingInviteCode: "",
    localDataBusinessId: nextBusinessId,
    sessionActive: true
  };
  role = state.settings.cloudRole;

  if (!state.settings.businessId || String(state.settings.businessId).startsWith("00000000-")) {
    const short = String(business?.id || "").replace(/-/g, "").slice(0, 10).toUpperCase();
    state.settings.businessId = short ? `MPCR-${short}` : state.settings.businessId;
  }

  await put("settings", state.settings);
}

async function cloudPersistNoBusiness(user) {
  if (state.settings.localDataBusinessId) await resetLocalBusinessCache();
  state.settings = {
    ...state.settings,
    email: user?.email || state.settings.email || "",
    memberDisplayName: user?.user_metadata?.full_name || user?.email || "",
    accountCreated: true,
    onboardingComplete: false,
    activated: !!user?.email_confirmed_at,
    activationUsed: !!user?.email_confirmed_at,
    pendingCloudConfirmation: false,
    cloudLinked: false,
    cloudUserId: user?.id || "",
    cloudBusinessId: "",
    cloudRole: "employee",
    cloudPermissions: {},
    needsBusinessJoin: true,
    localDataBusinessId: "",
    sessionActive: true
  };
  role = "employee";
  mpCloudBusiness = null;
  mpCloudMembership = null;
  await put("settings", state.settings);
}

async function cloudFindMembership(userId) {
  if (!mpCloud || !userId) return null;
  const { data, error } = await mpCloud
    .from("business_members")
    .select("business_id,user_id,role,permissions,display_name,email,active,created_at,employee_id,employee_code")
    .eq("user_id", userId)
    .eq("active", true)
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

async function cloudFetchBusiness(businessId) {
  if (!mpCloud || !businessId) return null;
  const { data, error } = await mpCloud.from("businesses").select("*").eq("id", businessId).maybeSingle();
  if (error) throw error;
  return data || null;
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

  let membership = await cloudFindMembership(user.id);

  // Los empleados usan una sesión anónima vinculada por código. Nunca debe crear un negocio nuevo.
  if (user?.is_anonymous) {
    if (membership) {
      const business = await cloudFetchBusiness(membership.business_id);
      if (business) {
        mpCloudBusiness = business;
        mpCloudMembership = membership;
        await cloudPersistLocalIdentity(user, business, membership);
        return business;
      }
    }
    state.settings.sessionActive = false;
    state.settings.employeeId = "";
    state.settings.employeeCode = "";
    state.settings.memberDisplayName = "";
    await put("settings", state.settings);
    return null;
  }
  if (membership) {
    const business = await cloudFetchBusiness(membership.business_id);
    if (business) {
      mpCloudBusiness = business;
      mpCloudMembership = membership;
      await cloudPersistLocalIdentity(user, business, membership);
      return business;
    }
  }

  let business = await cloudFindOwnedBusiness(user.id);
  if (business) {
    membership = await cloudFindMembership(user.id);
    mpCloudBusiness = business;
    mpCloudMembership = membership || { business_id: business.id, user_id: user.id, role: "owner", permissions: {}, display_name: user?.user_metadata?.full_name || "", email: user?.email || "", active: true };
    await cloudPersistLocalIdentity(user, business, mpCloudMembership);
    return business;
  }

  if (user?.user_metadata?.account_kind === "member") {
    await cloudPersistNoBusiness(user);
    return null;
  }

  const oauthIntent = localStorage.getItem("mpcrOAuthIntent") || "";
  if (oauthIntent === "login") {
    state.settings.oauthNoBusiness = true;
    state.settings.onboardingComplete = false;
    state.settings.sessionActive = true;
    state.settings.cloudUserId = user.id;
    await put("settings", state.settings);
    localStorage.removeItem("mpcrOAuthIntent");
    return null;
  }

  business = await cloudCreateBusinessForUser(user);
  localStorage.removeItem("mpcrOAuthIntent");
  membership = await cloudFindMembership(user.id);
  mpCloudBusiness = business;
  mpCloudMembership = membership || { business_id: business.id, user_id: user.id, role: "owner", permissions: {}, display_name: user?.user_metadata?.full_name || "", email: user?.email || "", active: true };
  await cloudPersistLocalIdentity(user, business, mpCloudMembership);
  return business;
}

async function cloudHydrateSession(session) {
  mpCloudSession = session || null;
  mpCloudUser = session?.user || null;
  if (!mpCloudUser) return null;

  if (state.settings.pendingInviteCode) {
    try {
      await cloudAcceptBusinessInvite(state.settings.pendingInviteCode);
      state.settings.pendingInviteCode = "";
      await put("settings", state.settings);
    } catch (error) {
      console.warn("Invitación pendiente:", error?.message || error);
    }
  }

  const business = await cloudEnsureBusiness(mpCloudUser);
  if (!business) return { user: mpCloudUser, business: null };
  try { await cloudLoadPlanStatus(); } catch (error) { console.error("Plan Pro:", error); }
  try { await cloudSyncCatalogClients({ silent: true }); } catch (error) { console.error("Catálogo inicial:", error); }
  try { await cloudSyncOperations({ silent: true }); } catch (error) { console.error("Operación inicial:", error); }
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

        if (event === "PASSWORD_RECOVERY" && session?.user) {
          mpPasswordRecovery = true;
          state.settings.email = session.user.email || state.settings.email || "";
          state.settings.sessionActive = true;
          try { await put("settings", state.settings); } catch (error) { console.warn("No se pudo guardar el estado de recuperación:", error); }
          if (db && !document.querySelector("#modalRoot")) render();
          return;
        }

        if (session?.user && ["SIGNED_IN", "TOKEN_REFRESHED", "USER_UPDATED", "INITIAL_SESSION"].includes(event)) {
          if (mpEmployeeLoginInProgress && session.user?.is_anonymous) return;
          try {
            await cloudHydrateSession(session);
            if (db && !document.querySelector("#modalRoot")) render();
          } catch (error) {
            console.error("Supabase hydrate:", error);
          }
        }

        if (event === "SIGNED_OUT") {
          mpCloudBusiness = null;
          mpPasswordRecovery = false;
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
        business_type: businessType,
        account_kind: "owner"
      }
    }
  });
  if (error) throw error;

  if (data?.session?.user) {
    await cloudHydrateSession(data.session);
  }

  return data;
}

async function cloudRegisterMember(draft) {
  if (!initCloudClient()) throw new Error("No se pudo cargar Supabase.");
  if (!navigator.onLine) throw new Error("Necesitas Internet para crear la cuenta.");
  const { data, error } = await mpCloud.auth.signUp({
    email: draft.email,
    password: draft.password,
    options: {
      emailRedirectTo: MPCR_SITE_URL,
      data: { full_name: draft.fullName || "", account_kind: "member" }
    }
  });
  if (error) throw error;
  if (data?.session?.user) {
    if (draft.inviteCode) await cloudAcceptBusinessInvite(draft.inviteCode);
    await cloudHydrateSession(data.session);
  }
  return data;
}

async function cloudAcceptBusinessInvite(code) {
  if (!initCloudClient()) throw new Error("No se pudo cargar Supabase.");
  const clean = String(code || "").trim().toUpperCase();
  if (!clean) throw new Error("Escribe el código de invitación.");
  const { data, error } = await mpCloud.rpc("accept_business_invite", { p_code: clean });
  if (error) throw error;
  return data;
}

async function cloudJoinExistingAccount(email, password, inviteCode) {
  if (!initCloudClient()) throw new Error("No se pudo cargar Supabase.");
  if (!navigator.onLine) throw new Error("Necesitas Internet para unirte al negocio.");
  const { data, error } = await mpCloud.auth.signInWithPassword({ email, password });
  if (error) throw error;
  if (!data?.session) throw new Error("No se pudo iniciar la sesión.");
  await cloudAcceptBusinessInvite(inviteCode);
  await cloudHydrateSession(data.session);
  return data;
}

function cloudInviteCode() {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (const b of bytes) out += chars[b % chars.length];
  return `MP-${out.slice(0,3)}-${out.slice(3)}`;
}

async function cloudLoadTeam() {
  if (!mpCloudBusiness?.id) return { members: [], invites: [] };
  const [membersResult, invitesResult] = await Promise.all([
    mpCloud.from("business_members").select("business_id,user_id,role,permissions,display_name,email,active,created_at,updated_at").eq("business_id", mpCloudBusiness.id).order("created_at", { ascending: true }),
    mpCloud.from("business_invites").select("*").eq("business_id", mpCloudBusiness.id).order("created_at", { ascending: false })
  ]);
  if (membersResult.error) throw membersResult.error;
  if (invitesResult.error) throw invitesResult.error;
  return { members: membersResult.data || [], invites: invitesResult.data || [] };
}

async function cloudCreateTeamInvite(email, memberRole, permissions) {
  if (role !== "owner") throw new Error("Solo el dueño puede invitar usuarios.");
  const cleanEmail = String(email || "").trim().toLowerCase();
  for (let attempt = 0; attempt < 4; attempt++) {
    const code = cloudInviteCode();
    const { data, error } = await mpCloud.from("business_invites").insert({
      business_id: mpCloudBusiness.id, email: cleanEmail, role: memberRole, permissions: permissions || {}, invite_code: code, invited_by: mpCloudUser.id
    }).select("*").single();
    if (!error) return data;
    if (!String(error.message || "").toLowerCase().includes("duplicate")) throw error;
  }
  throw new Error("No se pudo generar el código. Intenta de nuevo.");
}

async function cloudUpdateTeamMember(userId, changes) {
  if (role !== "owner") throw new Error("Solo el dueño puede administrar usuarios.");
  const { data, error } = await mpCloud.from("business_members")
    .update({ ...changes, updated_at: new Date().toISOString() })
    .eq("business_id", mpCloudBusiness.id).eq("user_id", userId).select("*").single();
  if (error) throw error;
  return data;
}

async function cloudCancelInvite(inviteId) {
  if (role !== "owner") throw new Error("Solo el dueño puede administrar invitaciones.");
  const { error } = await mpCloud.from("business_invites").update({ status: "cancelled" }).eq("business_id", mpCloudBusiness.id).eq("id", inviteId);
  if (error) throw error;
  return true;
}

async function cloudSendPasswordReset(email) {
  if (!initCloudClient()) throw new Error("No se pudo cargar Supabase.");
  if (!navigator.onLine) throw new Error("Necesitas Internet para recuperar la contraseña.");
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!cleanEmail) throw new Error("Escribe tu correo.");
  const { error } = await mpCloud.auth.resetPasswordForEmail(cleanEmail, {
    redirectTo: MPCR_SITE_URL
  });
  if (error) throw error;
  return true;
}

async function cloudUpdateRecoveredPassword(password) {
  if (!initCloudClient()) throw new Error("No se pudo cargar Supabase.");
  if (!navigator.onLine) throw new Error("Necesitas Internet para cambiar la contraseña.");
  if (String(password || "").length < 6) throw new Error("La contraseña debe tener al menos 6 caracteres.");
  const { data, error } = await mpCloud.auth.updateUser({ password });
  if (error) throw error;
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

async function cloudOAuthSignIn(provider, intent = "login") {
  if (!initCloudClient()) throw new Error("No se pudo cargar Supabase.");
  if (!navigator.onLine) throw new Error("Necesitas Internet para continuar.");
  localStorage.setItem("mpcrOAuthIntent", intent);
  const { data, error } = await mpCloud.auth.signInWithOAuth({
    provider,
    options: { redirectTo: MPCR_SITE_URL }
  });
  if (error) {
    localStorage.removeItem("mpcrOAuthIntent");
    throw error;
  }
  return data;
}

async function cloudLoadPlanStatus() {
  if (!mpCloudBusiness?.id || !mpCloud) return null;
  const { data, error } = await mpCloud.rpc("get_my_business_plan");
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (row) {
    state.settings.planTier = row.plan_tier || "free";
    state.settings.planSource = row.plan_source || "free";
    state.settings.planPeriod = row.plan_period || "";
    state.settings.planExpiresAt = row.expires_at || "";
    state.settings.ownerProCode = Number(row.owner_code || 1000);
    await put("settings", state.settings);
  }
  return row;
}

async function cloudRedeemPromoCode(code) {
  if (!mpCloudBusiness?.id) throw new Error("Primero conecta este negocio a una cuenta.");
  const clean = String(code || "").trim().toUpperCase();
  if (!clean) throw new Error("Escribe el código promocional.");
  const { data, error } = await mpCloud.rpc("redeem_pro_promo_code", { p_code: clean });
  if (error) throw error;
  await cloudLoadPlanStatus();
  return Array.isArray(data) ? data[0] : data;
}

async function cloudEmployeeCodeLogin(codeNumber) {
  if (!initCloudClient()) throw new Error("No se pudo cargar Supabase.");
  if (!navigator.onLine) throw new Error("Necesitas Internet para ingresar como empleado.");
  const businessId = state.settings.lastCloudBusinessId || state.settings.cloudBusinessId || (String(state.settings.localDataBusinessId || "").match(/^[0-9a-f-]{36}$/i) ? state.settings.localDataBusinessId : "");
  if (!businessId) throw new Error("Este dispositivo no está vinculado a un negocio.");
  mpEmployeeLoginInProgress = true;
  try {
    try { await mpCloud.auth.signOut(); } catch (_) {}
    const { data: anonData, error: anonError } = await mpCloud.auth.signInAnonymously();
    if (anonError) throw anonError;
    const session = anonData?.session;
    if (!session?.user) throw new Error("No se pudo crear la sesión de empleado.");
    const { data, error } = await mpCloud.rpc("employee_code_login", {
      p_business_id: businessId,
      p_code_number: Number(codeNumber)
    });
    if (error) throw error;
    await cloudHydrateSession(session);
    const row = Array.isArray(data) ? data[0] : data;
    if (row) {
      state.settings.employeeId = row.employee_id || state.settings.employeeId || "";
      state.settings.employeeCode = row.code_number || Number(codeNumber);
      state.settings.memberDisplayName = row.display_name || state.settings.memberDisplayName || "Empleado";
      state.settings.sessionActive = true;
      state.settings.guestMode = false;
      await put("settings", state.settings);
      role = "employee";
    }
    return row;
  } finally {
    mpEmployeeLoginInProgress = false;
  }
}

async function cloudLoadEmployees() {
  if (!mpCloudBusiness?.id) return [];
  const { data, error } = await mpCloud.from("business_employees")
    .select("id,business_id,code_number,display_name,permissions,created_at,updated_at")
    .eq("business_id", mpCloudBusiness.id)
    .order("code_number", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function cloudCreateEmployee(displayName, permissions) {
  if (role !== "owner") throw new Error("Solo el dueño puede crear empleados.");
  const { data, error } = await mpCloud.rpc("create_business_employee", {
    p_display_name: String(displayName || "").trim(),
    p_permissions: permissions || {}
  });
  if (error) throw error;
  return data;
}

async function cloudUpdateEmployee(employeeId, changes) {
  if (role !== "owner") throw new Error("Solo el dueño puede administrar empleados.");
  const payload = { updated_at: new Date().toISOString() };
  if (changes.display_name != null) payload.display_name = changes.display_name;
  if (changes.permissions != null) payload.permissions = changes.permissions;
  const { data, error } = await mpCloud.from("business_employees")
    .update(payload)
    .eq("business_id", mpCloudBusiness.id)
    .eq("id", employeeId)
    .select("*").single();
  if (error) throw error;
  return data;
}

async function cloudDeleteEmployee(employeeId) {
  if (role !== "owner") throw new Error("Solo el dueño puede eliminar empleados.");
  const { error } = await mpCloud.from("business_employees")
    .delete().eq("business_id", mpCloudBusiness.id).eq("id", employeeId);
  if (error) throw error;
  return true;
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
  mpCloudMembership = null;
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


/* =========================
   OPERACIÓN EN LA NUBE v7.11
   Caja · Ventas · Pagos · Crédito · Mesas · Pedidos
========================= */
function cloudOperationsConnected() {
  return !!(mpCloud && mpCloudUser && mpCloudBusiness?.id && state.settings.cloudLinked);
}
function cloudUuidLike(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}
function cloudEnsureId(obj) {
  if (!obj.cloudId) obj.cloudId = cloudUuidLike(obj.id) ? obj.id : cloudUuid();
  return obj.cloudId;
}
function cloudLocalByCloud(list, cloudId) {
  return list.find(item => item.cloudId === cloudId || (cloudUuidLike(item.id) && item.id === cloudId));
}
function cloudClientRemoteId(localId) {
  const item = state.clients.find(c => c.id === localId);
  return item?.cloudId || (cloudUuidLike(item?.id) ? item.id : null);
}
function cloudProductRemoteId(localId) {
  const item = state.products.find(p => p.id === localId);
  return item?.cloudId || (cloudUuidLike(item?.id) ? item.id : null);
}
function cloudShiftRemoteId(localId) {
  const item = state.cashSessions.find(x => x.id === localId);
  return item?.cloudId || (cloudUuidLike(item?.id) ? item.id : null);
}
function cloudTableAccountRemoteId(localId) {
  const item = state.tableAccounts.find(x => x.id === localId);
  return item?.cloudId || (cloudUuidLike(item?.id) ? item.id : null);
}
function cloudSaleRemoteId(localId) {
  const item = state.sales.find(x => x.id === localId);
  return item?.cloudId || (cloudUuidLike(item?.id) ? item.id : null);
}
function cloudMethodToRemote(method) {
  const m = String(method || "").toLowerCase();
  if (m.includes("efect")) return "cash";
  if (m.includes("sinpe")) return "sinpe";
  if (m.includes("tarjeta")) return "card";
  if (m.includes("crédito") || m.includes("credito")) return "credit";
  return "other";
}
function cloudMethodToLocal(method) {
  if (method === "cash") return "Efectivo";
  if (method === "sinpe") return "SINPE";
  if (method === "card") return "Tarjeta/Otro";
  if (method === "credit") return "Crédito";
  return "Tarjeta/Otro";
}
function cloudOrderStatusToRemote(status) {
  const s = String(status || "").toLowerCase();
  if (s.includes("prepar")) return "preparing";
  if (s.includes("listo")) return "ready";
  if (s.includes("entregado")) return "delivered";
  if (s.includes("cancel")) return "cancelled";
  return "taken";
}
function cloudOrderStatusToLocal(status) {
  if (status === "preparing") return "En preparación";
  if (status === "ready") return "Listo";
  if (status === "delivered") return "Entregado";
  if (status === "cancelled") return "Cancelado";
  return "Tomado";
}
function cloudSerializedItems(items = []) {
  return items.map(item => ({
    id: item.id,
    cloudProductId: cloudProductRemoteId(item.id) || item.cloudProductId || null,
    name: item.name,
    variant: item.variant || "",
    price: Number(item.price || 0),
    qty: Number(item.qty || 0)
  }));
}

// =========================================
// AUDITORÍA + INVENTARIO + NUMERACIÓN V7.12
// =========================================
function cloudSafeJson(value) {
  if (value == null) return null;
  try { return JSON.parse(JSON.stringify(value)); } catch (_) { return null; }
}
function cloudQueueAuditEvent(entity, action, entityType, oldData = null, newData = null) {
  if (!entity) return null;
  if (!Array.isArray(entity.cloudAuditQueue)) entity.cloudAuditQueue = [];
  const event = {
    id: cloudUuid(),
    action: String(action || 'update'),
    entityType: String(entityType || 'record'),
    oldData: cloudSafeJson(oldData),
    newData: cloudSafeJson(newData),
    createdAt: new Date().toISOString()
  };
  entity.cloudAuditQueue.push(event);
  return event.id;
}
function cloudQueueInventoryEvent(entity, detail = {}) {
  if (!entity) return null;
  if (!Array.isArray(entity.cloudInventoryQueue)) entity.cloudInventoryQueue = [];
  const event = {
    id: detail.id || cloudUuid(),
    productLocalId: detail.productLocalId || '',
    movementType: detail.movementType || 'adjustment',
    quantity: Number(detail.quantity || 0),
    previousStock: detail.previousStock == null ? null : Number(detail.previousStock),
    newStock: detail.newStock == null ? null : Number(detail.newStock),
    linkedSale: !!detail.linkedSale,
    notes: detail.notes || '',
    createdAt: detail.createdAt || new Date().toISOString()
  };
  entity.cloudInventoryQueue.push(event);
  return event.id;
}
async function cloudInsertIdempotent(table, payload) {
  const { error } = await mpCloud.from(table).insert(payload);
  if (error && error.code !== '23505') throw error;
  return true;
}
async function cloudFlushAuditQueue(entity) {
  if (!cloudOperationsConnected() || !navigator.onLine || !entity || !Array.isArray(entity.cloudAuditQueue) || !entity.cloudAuditQueue.length) return false;
  const entityId = entity.cloudId || (cloudUuidLike(entity.id) ? entity.id : null);
  const pending = [...entity.cloudAuditQueue];
  for (const event of pending) {
    await cloudInsertIdempotent('audit_log', {
      id: event.id,
      business_id: mpCloudBusiness.id,
      user_id: mpCloudUser.id,
      action: event.action,
      entity_type: event.entityType,
      entity_id: entityId,
      old_data: event.oldData,
      new_data: event.newData,
      created_at: event.createdAt || new Date().toISOString()
    });
    entity.cloudAuditQueue = entity.cloudAuditQueue.filter(x => x.id !== event.id);
  }
  return true;
}
async function cloudFlushInventoryQueue(entity) {
  if (!cloudOperationsConnected() || !navigator.onLine || !entity || !Array.isArray(entity.cloudInventoryQueue) || !entity.cloudInventoryQueue.length) return false;
  const pending = [...entity.cloudInventoryQueue];
  for (const event of pending) {
    const product = state.products.find(p => p.id === event.productLocalId || p.cloudId === event.productLocalId);
    const productId = product?.cloudId || (cloudUuidLike(product?.id) ? product.id : null);
    if (!productId) throw new Error('Producto pendiente de sincronizar antes del movimiento de inventario.');
    const saleId = event.linkedSale ? (entity.cloudId || (cloudUuidLike(entity.id) ? entity.id : null)) : null;
    await cloudInsertIdempotent('inventory_movements', {
      id: event.id,
      business_id: mpCloudBusiness.id,
      product_id: productId,
      movement_type: event.movementType,
      quantity: Number(event.quantity || 0),
      previous_stock: event.previousStock,
      new_stock: event.newStock,
      sale_id: saleId,
      notes: event.notes || null,
      created_by: mpCloudUser.id,
      created_at: event.createdAt || new Date().toISOString()
    });
    entity.cloudInventoryQueue = entity.cloudInventoryQueue.filter(x => x.id !== event.id);
  }
  return true;
}
async function cloudFlushTrackingQueues(entity) {
  await cloudFlushAuditQueue(entity);
  await cloudFlushInventoryQueue(entity);
}
async function cloudAssignOfficialReceiptNumber(sale) {
  if (!cloudOperationsConnected() || !navigator.onLine || !sale) return null;
  if (Number(sale.cloudReceiptNumber || 0) > 0) return Number(sale.cloudReceiptNumber);
  const { data, error } = await mpCloud.rpc('next_receipt_number', { p_business_id: mpCloudBusiness.id });
  if (error) throw error;
  const number = Number(data || 0);
  if (!number) throw new Error('No se pudo obtener el número de comprobante.');
  sale.cloudReceiptNumber = number;
  sale.number = number;
  if (Array.isArray(sale.cloudAuditQueue)) {
    for (const event of sale.cloudAuditQueue) {
      if (event.entityType === 'sale' && event.action === 'create' && event.newData) event.newData.number = number;
    }
  }
  await put('sales', sale);
  return number;
}

function cloudHydratedItems(items = []) {
  return items.map(item => {
    const product = item.cloudProductId ? cloudLocalByCloud(state.products, item.cloudProductId) : null;
    return {
      id: product?.id || item.id || item.cloudProductId || "",
      name: item.name || product?.name || "Producto",
      variant: item.variant || "",
      price: Number(item.price || 0),
      qty: Number(item.qty || 0)
    };
  });
}

async function cloudEnsureRestaurantTable(tableNumber) {
  if (!cloudOperationsConnected() || !tableNumber) return null;
  const number = Number(tableNumber);
  const { data: found, error: findError } = await mpCloud
    .from("restaurant_tables")
    .select("id,table_number")
    .eq("business_id", mpCloudBusiness.id)
    .eq("table_number", number)
    .limit(1);
  if (findError) throw findError;
  if (found?.[0]) return found[0];
  const { data, error } = await mpCloud
    .from("restaurant_tables")
    .insert({ business_id: mpCloudBusiness.id, table_number: number, name: `Mesa ${number}`, active: true })
    .select("id,table_number")
    .single();
  if (error) throw error;
  return data;
}

async function cloudSaveCashSession(session) {
  if (!cloudOperationsConnected() || !navigator.onLine || !session) return null;
  const id = cloudEnsureId(session);
  const payload = {
    id,
    business_id: mpCloudBusiness.id,
    opened_by: mpCloudUser.id,
    closed_by: session.status === "closed" ? mpCloudUser.id : null,
    opening_amount: Number(session.opening || 0),
    expected_cash: session.expected == null ? null : Number(session.expected),
    counted_cash: session.counted == null ? null : Number(session.counted),
    difference: session.difference == null ? null : Number(session.difference),
    opened_at: session.openedAt || new Date().toISOString(),
    closed_at: session.closedAt || null,
    status: session.status === "closed" ? "closed" : "open",
    report: session.report && typeof session.report === "object" ? session.report : {}
  };
  const { error } = await mpCloud.from("cash_shifts").upsert(payload, { onConflict: "id" });
  if (error) throw error;
  session.cloudPending = false;
  session.cloudSyncedAt = new Date().toISOString();
  await cloudFlushTrackingQueues(session);
  return id;
}

async function cloudSaveTableAccount(account, { skipPaidSale = false } = {}) {
  if (!cloudOperationsConnected() || !navigator.onLine || !account) return null;
  const id = cloudEnsureId(account);
  const clientRemoteId = cloudClientRemoteId(account.clientId);
  let paidSaleRemoteId = null;
  if (!skipPaidSale && account.paidSaleId) paidSaleRemoteId = cloudSaleRemoteId(account.paidSaleId);
  const remoteOrderIds = (account.orderIds || []).map(local => {
    const order = state.orders.find(o => o.id === local);
    return order?.cloudId || (cloudUuidLike(local) ? local : null);
  }).filter(Boolean);
  const payload = {
    id,
    business_id: mpCloudBusiness.id,
    table_number: Number(account.tableNumber || 0),
    client_id: clientRemoteId,
    status: account.status === "paid" ? "paid" : "open",
    items: cloudSerializedItems(account.items || []),
    order_ids: remoteOrderIds,
    notes: account.note || null,
    total: Number(account.total || tableItemsTotal(account.items || [])),
    paid_sale_id: paidSaleRemoteId,
    opened_at: account.openedAt || new Date().toISOString(),
    paid_at: account.paidAt || null,
    updated_at: account.updatedAt || new Date().toISOString()
  };
  const { error } = await mpCloud.from("table_accounts").upsert(payload, { onConflict: "id" });
  if (error) throw error;
  account.cloudPending = false;
  account.cloudSyncedAt = new Date().toISOString();
  return id;
}

async function cloudDeleteTableAccount(account) {
  if (!cloudOperationsConnected() || !navigator.onLine || !account) return false;
  const id = account.cloudId || (cloudUuidLike(account.id) ? account.id : null);
  if (!id) return true;
  const { error } = await mpCloud.from("table_accounts").delete().eq("id", id).eq("business_id", mpCloudBusiness.id);
  if (error) throw error;
  return true;
}

async function cloudSaveSale(sale) {
  if (!cloudOperationsConnected() || !navigator.onLine || !sale) return null;
  if (sale.shiftId) {
    const shift = state.cashSessions.find(x => x.id === sale.shiftId);
    if (shift) { await cloudSaveCashSession(shift); await put("cashSessions", shift); }
  }
  let account = sale.tableAccountId ? state.tableAccounts.find(x => x.id === sale.tableAccountId) : null;
  if (account) { await cloudSaveTableAccount(account, { skipPaidSale: true }); await put("tableAccounts", account); }

  const id = cloudEnsureId(sale);
  await cloudAssignOfficialReceiptNumber(sale);
  const payload = {
    id,
    business_id: mpCloudBusiness.id,
    receipt_number: Number(sale.cloudReceiptNumber || sale.number || 0) || undefined,
    client_id: cloudClientRemoteId(sale.clientId),
    cash_shift_id: cloudShiftRemoteId(sale.shiftId),
    table_id: null,
    business_type: sale.businessType || state.settings.businessType || "food",
    local_number: Number(sale.number || 0) || null,
    subtotal: Number(sale.subtotal || 0),
    tax: Number(sale.tax || 0),
    tax_mode: sale.taxMode || null,
    tax_rate: Number(sale.taxRate || 0),
    total: Number(sale.total || 0),
    payment_method: cloudMethodToRemote(sale.method),
    payment_reference: sale.reference || null,
    received: sale.received == null ? null : Number(sale.received),
    change_amount: Number(sale.change || 0),
    order_type: sale.orderType || "Mostrador",
    table_number: sale.table ? Number(sale.table) : null,
    table_account_id: cloudTableAccountRemoteId(sale.tableAccountId),
    sale_type: sale.businessType === "services" ? "service" : (sale.orderType === "Mesa" ? "table" : "counter"),
    status: sale.voided ? "voided" : "active",
    hidden_from_sales: !!sale.hiddenFromSales,
    hidden_at: sale.hiddenFromSalesAt || null,
    notes: sale.note || null,
    employee_id: sale.employeeId || null,
    employee_name: sale.employeeName || null,
    employee_code: sale.employeeCode ? Number(sale.employeeCode) : null,
    created_by: mpCloudUser.id,
    created_at: sale.createdAt || new Date().toISOString(),
    voided_by: sale.voided ? mpCloudUser.id : null,
    voided_at: sale.voidedAt || null,
    void_reason: sale.voidReason || null
  };
  const { data, error } = await mpCloud.from("sales").upsert(payload, { onConflict: "id" }).select("id,receipt_number").single();
  if (error) throw error;
  sale.cloudReceiptNumber = data?.receipt_number || sale.cloudReceiptNumber || null;

  for (const item of sale.items || []) {
    if (!item.cloudItemId) item.cloudItemId = cloudUuid();
    const itemPayload = {
      id: item.cloudItemId,
      business_id: mpCloudBusiness.id,
      sale_id: id,
      product_id: cloudProductRemoteId(item.id),
      product_name: item.name || "Producto",
      variant: item.variant || null,
      quantity: Number(item.qty || 0),
      unit_price: Number(item.price || 0),
      subtotal: Number(item.price || 0) * Number(item.qty || 0),
      created_at: sale.createdAt || new Date().toISOString()
    };
    const { error: itemError } = await mpCloud.from("sale_items").upsert(itemPayload, { onConflict: "id" });
    if (itemError) throw itemError;
  }

  if (!sale.cloudPaymentId) sale.cloudPaymentId = cloudUuid();
  const payPayload = {
    id: sale.cloudPaymentId,
    business_id: mpCloudBusiness.id,
    sale_id: id,
    client_id: cloudClientRemoteId(sale.clientId),
    cash_shift_id: cloudShiftRemoteId(sale.shiftId),
    method: cloudMethodToRemote(sale.method),
    amount: Number(sale.total || 0),
    created_by: mpCloudUser.id,
    created_at: sale.createdAt || new Date().toISOString()
  };
  const { error: paymentError } = await mpCloud.from("payments").upsert(payPayload, { onConflict: "id" });
  if (paymentError) throw paymentError;

  if (sale.method === "Crédito" && sale.clientId) {
    if (!sale.cloudCreditMoveId) sale.cloudCreditMoveId = cloudUuid();
    const creditPayload = {
      id: sale.cloudCreditMoveId,
      business_id: mpCloudBusiness.id,
      client_id: cloudClientRemoteId(sale.clientId),
      sale_id: id,
      payment_id: sale.cloudPaymentId,
      movement_type: "credit_sale",
      amount: Number(sale.total || 0),
      notes: sale.note || null,
      created_by: mpCloudUser.id,
      created_at: sale.createdAt || new Date().toISOString()
    };
    const { error: creditError } = await mpCloud.from("credit_movements").upsert(creditPayload, { onConflict: "id" });
    if (creditError) throw creditError;
    if (sale.voided) {
      if (!sale.cloudVoidCreditMoveId) sale.cloudVoidCreditMoveId = cloudUuid();
      const { error: voidError } = await mpCloud.from("credit_movements").upsert({
        id: sale.cloudVoidCreditMoveId,
        business_id: mpCloudBusiness.id,
        client_id: cloudClientRemoteId(sale.clientId),
        sale_id: id,
        payment_id: null,
        movement_type: "void",
        amount: Number(sale.total || 0),
        notes: sale.voidReason || "Comprobante anulado",
        created_by: mpCloudUser.id,
        created_at: sale.voidedAt || new Date().toISOString()
      }, { onConflict: "id" });
      if (voidError) throw voidError;
    }
  }

  sale.cloudPending = false;
  sale.cloudSyncedAt = new Date().toISOString();
  await cloudFlushTrackingQueues(sale);
  await put("sales", sale);

  if (account) {
    await cloudSaveTableAccount(account);
    await put("tableAccounts", account);
  }
  return id;
}

async function cloudSaveCashMove(move) {
  if (!cloudOperationsConnected() || !navigator.onLine || !move) return null;
  const id = cloudEnsureId(move);
  const movementType = move.type === "creditPayment" ? "credit_payment" : (move.type === "out" ? "out" : "in");
  const payload = {
    id,
    business_id: mpCloudBusiness.id,
    cash_shift_id: cloudShiftRemoteId(move.shiftId),
    client_id: cloudClientRemoteId(move.clientId),
    movement_type: movementType,
    payment_method: move.method ? cloudMethodToRemote(move.method) : null,
    amount: Number(move.amount || 0),
    notes: move.note || null,
    created_by: mpCloudUser.id,
    created_at: move.createdAt || new Date().toISOString()
  };
  const { error } = await mpCloud.from("cash_movements").upsert(payload, { onConflict: "id" });
  if (error) throw error;
  move.cloudPending = false;
  move.cloudSyncedAt = new Date().toISOString();
  await cloudFlushTrackingQueues(move);
  return id;
}

async function cloudSaveCreditMove(move) {
  if (!cloudOperationsConnected() || !navigator.onLine || !move || move.type !== "payment") return null;
  const clientRemoteId = cloudClientRemoteId(move.clientId);
  if (!clientRemoteId) throw new Error("El cliente todavía no está sincronizado.");
  if (move.shiftId) {
    const shift = state.cashSessions.find(x => x.id === move.shiftId);
    if (shift) { await cloudSaveCashSession(shift); await put("cashSessions", shift); }
  }
  if (!move.cloudPaymentId) move.cloudPaymentId = cloudUuid();
  const { error: paymentError } = await mpCloud.from("payments").upsert({
    id: move.cloudPaymentId,
    business_id: mpCloudBusiness.id,
    sale_id: null,
    client_id: clientRemoteId,
    cash_shift_id: cloudShiftRemoteId(move.shiftId),
    method: cloudMethodToRemote(move.method),
    amount: Number(move.amount || 0),
    created_by: mpCloudUser.id,
    created_at: move.createdAt || new Date().toISOString()
  }, { onConflict: "id" });
  if (paymentError) throw paymentError;

  const id = cloudEnsureId(move);
  const { error } = await mpCloud.from("credit_movements").upsert({
    id,
    business_id: mpCloudBusiness.id,
    client_id: clientRemoteId,
    sale_id: null,
    payment_id: move.cloudPaymentId,
    movement_type: "payment",
    amount: Number(move.amount || 0),
    notes: move.note || null,
    created_by: mpCloudUser.id,
    created_at: move.createdAt || new Date().toISOString()
  }, { onConflict: "id" });
  if (error) throw error;
  move.cloudPending = false;
  move.cloudSyncedAt = new Date().toISOString();
  await cloudFlushTrackingQueues(move);
  return id;
}

async function cloudSaveOrder(order) {
  if (!cloudOperationsConnected() || !navigator.onLine || !order) return null;
  const table = await cloudEnsureRestaurantTable(order.tableNumber);
  let account = order.tableAccountId ? state.tableAccounts.find(x => x.id === order.tableAccountId) : null;
  if (account) { await cloudSaveTableAccount(account, { skipPaidSale: true }); await put("tableAccounts", account); }
  const id = cloudEnsureId(order);
  const payload = {
    id,
    business_id: mpCloudBusiness.id,
    table_id: table.id,
    table_account_id: cloudTableAccountRemoteId(order.tableAccountId),
    local_number: Number(order.number || 0) || null,
    status: cloudOrderStatusToRemote(order.status),
    status_history: Array.isArray(order.statusHistory) ? order.statusHistory : [],
    notes: order.notes || null,
    preparing_at: order.preparingAt || null,
    ready_at: order.readyAt || null,
    delivered_at: order.deliveredAt || null,
    created_by: mpCloudUser.id,
    created_at: order.createdAt || new Date().toISOString(),
    updated_at: order.updatedAt || order.createdAt || new Date().toISOString()
  };
  const { error } = await mpCloud.from("orders").upsert(payload, { onConflict: "id" });
  if (error) throw error;
  for (const item of order.items || []) {
    if (!item.cloudItemId) item.cloudItemId = cloudUuid();
    const { error: itemError } = await mpCloud.from("order_items").upsert({
      id: item.cloudItemId,
      business_id: mpCloudBusiness.id,
      order_id: id,
      product_id: cloudProductRemoteId(item.id),
      product_name: item.name || "Producto",
      quantity: Number(item.qty || 0),
      unit_price: Number(item.price || 0),
      notes: item.variant || null,
      created_at: order.createdAt || new Date().toISOString()
    }, { onConflict: "id" });
    if (itemError) throw itemError;
  }
  order.cloudPending = false;
  order.cloudSyncedAt = new Date().toISOString();
  await put("orders", order);
  if (account) {
    if (!account.orderIds) account.orderIds = [];
    if (!account.orderIds.includes(order.id)) account.orderIds.push(order.id);
    await cloudSaveTableAccount(account, { skipPaidSale: true });
    await put("tableAccounts", account);
  }
  return id;
}

async function cloudLoadOperationsRemote() {
  if (!cloudOperationsConnected() || !navigator.onLine) return null;
  const b = mpCloudBusiness.id;
  const [shifts, accounts, sales, saleItems, payments, creditMoves, cashMoves, tables, orders, orderItems] = await Promise.all([
    mpCloud.from("cash_shifts").select("*").eq("business_id", b).order("opened_at", { ascending: true }),
    mpCloud.from("table_accounts").select("*").eq("business_id", b).order("opened_at", { ascending: true }),
    mpCloud.from("sales").select("*").eq("business_id", b).order("created_at", { ascending: true }),
    mpCloud.from("sale_items").select("*").eq("business_id", b).order("created_at", { ascending: true }),
    mpCloud.from("payments").select("*").eq("business_id", b).order("created_at", { ascending: true }),
    mpCloud.from("credit_movements").select("*").eq("business_id", b).order("created_at", { ascending: true }),
    mpCloud.from("cash_movements").select("*").eq("business_id", b).order("created_at", { ascending: true }),
    mpCloud.from("restaurant_tables").select("id,table_number").eq("business_id", b),
    mpCloud.from("orders").select("*").eq("business_id", b).order("created_at", { ascending: true }),
    mpCloud.from("order_items").select("*").eq("business_id", b).order("created_at", { ascending: true })
  ]);
  for (const result of [shifts, accounts, sales, saleItems, payments, creditMoves, cashMoves, tables, orders, orderItems]) {
    if (result.error) throw result.error;
  }
  return {
    shifts: shifts.data || [], accounts: accounts.data || [], sales: sales.data || [], saleItems: saleItems.data || [],
    payments: payments.data || [], creditMoves: creditMoves.data || [], cashMoves: cashMoves.data || [], tables: tables.data || [],
    orders: orders.data || [], orderItems: orderItems.data || []
  };
}

async function cloudMergeOperationsRemote(remote) {
  if (!remote) return;
  const clientLocalId = remoteId => cloudLocalByCloud(state.clients, remoteId)?.id || remoteId || "";
  const productLocalId = remoteId => cloudLocalByCloud(state.products, remoteId)?.id || remoteId || "";

  const oldShifts = state.cashSessions.slice();
  const shifts = remote.shifts.map(row => {
    const existing = cloudLocalByCloud(oldShifts, row.id);
    return {
      ...(existing || {}), id: existing?.id || row.id, cloudId: row.id, cloudPending: false,
      opening: Number(row.opening_amount || 0), expected: row.expected_cash == null ? undefined : Number(row.expected_cash),
      counted: row.counted_cash == null ? undefined : Number(row.counted_cash), difference: row.difference == null ? undefined : Number(row.difference),
      openedAt: row.opened_at, closedAt: row.closed_at || "", status: row.status === "closed" ? "closed" : "open", report: row.report || {},
      cloudSyncedAt: row.closed_at || row.opened_at
    };
  });
  const shiftLocalId = remoteId => cloudLocalByCloud(shifts, remoteId)?.id || "";

  const oldAccounts = state.tableAccounts.slice();
  const accounts = remote.accounts.map(row => {
    const existing = cloudLocalByCloud(oldAccounts, row.id);
    return {
      ...(existing || {}), id: existing?.id || row.id, cloudId: row.id, cloudPending: false,
      tableNumber: Number(row.table_number || 0), clientId: clientLocalId(row.client_id), status: row.status === "paid" ? "paid" : "open",
      items: cloudHydratedItems(Array.isArray(row.items) ? row.items : []), note: row.notes || "", total: Number(row.total || 0),
      openedAt: row.opened_at, paidAt: row.paid_at || "", updatedAt: row.updated_at || row.opened_at,
      paidSaleCloudId: row.paid_sale_id || "", remoteOrderIds: Array.isArray(row.order_ids) ? row.order_ids : []
    };
  });
  const accountLocalId = remoteId => cloudLocalByCloud(accounts, remoteId)?.id || "";

  const itemsBySale = new Map();
  for (const item of remote.saleItems) {
    if (!itemsBySale.has(item.sale_id)) itemsBySale.set(item.sale_id, []);
    itemsBySale.get(item.sale_id).push(item);
  }
  const oldSales = state.sales.slice();
  const sales = remote.sales.map(row => {
    const existing = cloudLocalByCloud(oldSales, row.id);
    return {
      ...(existing || {}), id: existing?.id || row.id, cloudId: row.id, cloudPending: false,
      number: Number(row.local_number || row.receipt_number || 0), cloudReceiptNumber: row.receipt_number || null,
      createdAt: row.created_at, shiftId: shiftLocalId(row.cash_shift_id), businessType: row.business_type || state.settings.businessType || "food",
      items: (itemsBySale.get(row.id) || []).map(item => ({
        id: productLocalId(item.product_id), cloudItemId: item.id, name: item.product_name, variant: item.variant || "",
        price: Number(item.unit_price || 0), qty: Number(item.quantity || 0)
      })),
      subtotal: Number(row.subtotal || 0), tax: Number(row.tax || 0), taxMode: row.tax_mode || "added", taxRate: Number(row.tax_rate || 0), total: Number(row.total || 0),
      method: cloudMethodToLocal(row.payment_method), reference: row.payment_reference || "", clientId: clientLocalId(row.client_id),
      received: row.received == null ? null : Number(row.received), change: Number(row.change_amount || 0), orderType: row.order_type || "Mostrador",
      table: row.table_number ? String(row.table_number) : "", tableAccountId: accountLocalId(row.table_account_id), note: row.notes || "",
      employeeId: row.employee_id || "", employeeName: row.employee_name || "", employeeCode: row.employee_code || "",
      voided: row.status === "voided", voidedAt: row.voided_at || "", voidReason: row.void_reason || "",
      hiddenFromSales: !!row.hidden_from_sales, hiddenFromSalesAt: row.hidden_at || "", cloudSyncedAt: row.voided_at || row.created_at
    };
  });
  const saleLocalId = remoteId => cloudLocalByCloud(sales, remoteId)?.id || "";
  for (const acc of accounts) {
    if (acc.paidSaleCloudId) acc.paidSaleId = saleLocalId(acc.paidSaleCloudId);
  }

  const paymentMap = new Map(remote.payments.map(row => [row.id, row]));
  const oldCredits = state.creditMoves.slice();
  const credits = remote.creditMoves.filter(row => row.movement_type === "payment").map(row => {
    const existing = cloudLocalByCloud(oldCredits, row.id);
    const payment = paymentMap.get(row.payment_id);
    return {
      ...(existing || {}), id: existing?.id || row.id, cloudId: row.id, cloudPaymentId: row.payment_id || "", cloudPending: false,
      type: "payment", clientId: clientLocalId(row.client_id), amount: Number(row.amount || 0), method: cloudMethodToLocal(payment?.method),
      note: row.notes || "", createdAt: row.created_at, shiftId: shiftLocalId(payment?.cash_shift_id), businessType: state.settings.businessType || "food",
      cloudSyncedAt: row.created_at
    };
  });

  const oldCashMoves = state.cashMoves.slice();
  const cashMoves = remote.cashMoves.map(row => {
    const existing = cloudLocalByCloud(oldCashMoves, row.id);
    return {
      ...(existing || {}), id: existing?.id || row.id, cloudId: row.id, cloudPending: false,
      type: row.movement_type === "credit_payment" ? "creditPayment" : row.movement_type,
      clientId: clientLocalId(row.client_id), amount: Number(row.amount || 0), method: row.payment_method ? cloudMethodToLocal(row.payment_method) : "Efectivo",
      note: row.notes || "", createdAt: row.created_at, shiftId: shiftLocalId(row.cash_shift_id), cloudSyncedAt: row.created_at
    };
  });

  const tableNumberMap = new Map(remote.tables.map(row => [row.id, Number(row.table_number || 0)]));
  const itemsByOrder = new Map();
  for (const item of remote.orderItems) {
    if (!itemsByOrder.has(item.order_id)) itemsByOrder.set(item.order_id, []);
    itemsByOrder.get(item.order_id).push(item);
  }
  const oldOrders = state.orders.slice();
  const orders = remote.orders.map(row => {
    const existing = cloudLocalByCloud(oldOrders, row.id);
    return {
      ...(existing || {}), id: existing?.id || row.id, cloudId: row.id, cloudPending: false,
      number: Number(row.local_number || 0), tableNumber: tableNumberMap.get(row.table_id) || existing?.tableNumber || 0,
      tableAccountId: accountLocalId(row.table_account_id), customer: "",
      items: (itemsByOrder.get(row.id) || []).map(item => ({
        id: productLocalId(item.product_id), cloudItemId: item.id, name: item.product_name, variant: item.notes || "",
        price: Number(item.unit_price || 0), qty: Number(item.quantity || 0)
      })),
      notes: row.notes || "", status: cloudOrderStatusToLocal(row.status), createdAt: row.created_at, updatedAt: row.updated_at || row.created_at,
      statusHistory: Array.isArray(row.status_history) ? row.status_history : [], preparingAt: row.preparing_at || "", readyAt: row.ready_at || "", deliveredAt: row.delivered_at || "",
      cloudSyncedAt: row.updated_at || row.created_at
    };
  });
  const orderLocalId = remoteId => cloudLocalByCloud(orders, remoteId)?.id || "";
  for (const acc of accounts) acc.orderIds = (acc.remoteOrderIds || []).map(orderLocalId).filter(Boolean);

  for (const [storeName, values] of [["cashSessions", shifts], ["tableAccounts", accounts], ["sales", sales], ["creditMoves", credits], ["cashMoves", cashMoves], ["orders", orders]]) {
    await clearStore(storeName);
    for (const value of values) await put(storeName, value);
    state[storeName] = values;
  }
}

async function cloudSyncOperations({ silent = false } = {}) {
  if (!cloudOperationsConnected() || !navigator.onLine) return false;
  try {
    // Primero subimos cualquier operación local pendiente para no perder trabajo offline.
    for (const shift of state.cashSessions) {
      if (!shift.cloudId || shift.cloudPending) { await cloudSaveCashSession(shift); await put("cashSessions", shift); }
    }
    for (const account of state.tableAccounts) {
      if (!account.cloudId || account.cloudPending) { await cloudSaveTableAccount(account, { skipPaidSale: true }); await put("tableAccounts", account); }
    }
    for (const sale of state.sales) {
      if (!sale.cloudId || sale.cloudPending) await cloudSaveSale(sale);
    }
    for (const move of state.creditMoves) {
      if (move.type === "payment" && (!move.cloudId || move.cloudPending)) { await cloudSaveCreditMove(move); await put("creditMoves", move); }
    }
    for (const move of state.cashMoves) {
      if (!move.cloudId || move.cloudPending) { await cloudSaveCashMove(move); await put("cashMoves", move); }
    }
    for (const order of state.orders) {
      if (!order.cloudId || order.cloudPending) await cloudSaveOrder(order);
    }
    // Segunda pasada de cuentas para enlazar venta pagada / pedidos remotos.
    for (const account of state.tableAccounts) { await cloudSaveTableAccount(account); await put("tableAccounts", account); }

    const remote = await cloudLoadOperationsRemote();
    await cloudMergeOperationsRemote(remote);
    state.settings.operationsCloudV711Ready = true;
    state.settings.operationsLastCloudSyncAt = new Date().toISOString();
    await put("settings", state.settings);
    if (!silent) toast("Operación sincronizada con la nube.");
    return true;
  } catch (error) {
    console.error("Supabase operación:", error);
    if (!silent) toast("No se pudo sincronizar toda la operación. Los cambios quedan pendientes.");
    return false;
  }
}

async function cloudSaveSaleFromApp(sale) {
  if (!state.settings.cloudLinked) return false;
  if (!navigator.onLine) { sale.cloudPending = true; return false; }
  await cloudSaveSale(sale); return true;
}
async function cloudSaveCashSessionFromApp(session) {
  if (!state.settings.cloudLinked) return false;
  if (!navigator.onLine) { session.cloudPending = true; return false; }
  await cloudSaveCashSession(session); return true;
}
async function cloudSaveCashMoveFromApp(move) {
  if (!state.settings.cloudLinked) return false;
  if (!navigator.onLine) { move.cloudPending = true; return false; }
  await cloudSaveCashMove(move); return true;
}
async function cloudSaveCreditMoveFromApp(move) {
  if (!state.settings.cloudLinked) return false;
  if (!navigator.onLine) { move.cloudPending = true; return false; }
  await cloudSaveCreditMove(move); return true;
}
async function cloudSaveTableAccountFromApp(account) {
  if (!state.settings.cloudLinked) return false;
  if (!navigator.onLine) { account.cloudPending = true; return false; }
  await cloudSaveTableAccount(account); return true;
}
async function cloudDeleteTableAccountFromApp(account) {
  if (!state.settings.cloudLinked) return false;
  if (!navigator.onLine) { account.cloudPendingDelete = true; return false; }
  await cloudDeleteTableAccount(account); return true;
}
async function cloudSaveOrderFromApp(order) {
  if (!state.settings.cloudLinked) return false;
  if (!navigator.onLine) { order.cloudPending = true; return false; }
  await cloudSaveOrder(order); return true;
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
