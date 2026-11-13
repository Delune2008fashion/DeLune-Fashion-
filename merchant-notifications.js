/* DeLune Merchant: real-time order alerts (requires the Merchant Panel to be open). */
(() => {
  const db = window.DeLuneStore?.client;
  const enableButton = document.getElementById("enableOrderNotifications");
  const toast = document.getElementById("orderNotificationToast");
  const status = document.getElementById("orderNotificationStatus");
  if (!db || !enableButton || !toast) return;

  let channel = null;
  let audioContext = null;
  let toastTimer = null;
  const seenOrders = new Set();

  function setPermissionLabel() {
    if (!("Notification" in window)) {
      enableButton.textContent = "Browser alerts unavailable";
      enableButton.disabled = true;
      return;
    }
    enableButton.textContent = Notification.permission === "granted"
      ? "Browser alerts enabled"
      : Notification.permission === "denied"
        ? "Browser alerts blocked"
        : "Enable browser alerts";
    enableButton.disabled = Notification.permission === "granted" || Notification.permission === "denied";
  }

  function showToast(orderCode, items) {
    toast.replaceChildren();
    const heading = document.createElement("strong");
    heading.textContent = "New order received";
    const code = document.createElement("span");
    code.textContent = orderCode || "New DeLune order";
    const detail = document.createElement("span");
    detail.textContent = items.length
      ? items.map(item => item.product_name + " × " + item.quantity).join(" · ")
      : "Open the Orders list to view the order details.";
    toast.append(heading, code, detail);
    toast.classList.add("is-visible");
    toast.setAttribute("aria-hidden", "false");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.classList.remove("is-visible");
      toast.setAttribute("aria-hidden", "true");
    }, 8500);
  }

  function playAlertTone() {
    if (!audioContext || audioContext.state !== "running") return;
    try {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(660, audioContext.currentTime + 0.12);
      gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, audioContext.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.28);
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      console.debug("[DeLune notifications] Alert tone unavailable", error);
    }
  }

  async function handleNewOrder(payload) {
    const order = payload?.new;
    if (!order?.id || seenOrders.has(order.id)) return;
    seenOrders.add(order.id);

    let items = [];
    try {
      const { data, error } = await db
        .from("order_items")
        .select("product_name,quantity")
        .eq("order_id", order.id);
      if (error) throw error;
      items = data || [];
    } catch (error) {
      console.warn("[DeLune notifications] Could not load new order items", error);
    }

    const orderCode = order.order_code || "New order";
    const itemSummary = items.length
      ? items.map(item => item.product_name + " × " + item.quantity).join(" · ")
      : "Open Merchant Panel to view details.";
    showToast(orderCode, items);
    playAlertTone();

    if ("Notification" in window && Notification.permission === "granted") {
      try {
        const notification = new Notification("New DeLune order", {
          body: orderCode + " — " + itemSummary,
          icon: "/DeLune-Fashion-/logo.png",
          tag: "delune-order-" + order.id,
          renotify: false
        });
        notification.onclick = () => {
          window.focus();
          notification.close();
          document.getElementById("orders")?.scrollIntoView({ behavior: "smooth", block: "start" });
        };
      } catch (error) {
        console.warn("[DeLune notifications] System notification unavailable", error);
      }
    }
  }

  async function connectForUser(session) {
    const user = session?.user;
    if (!user?.id) return;
    if (channel) {
      await db.removeChannel(channel);
      channel = null;
    }

    try {
      const { data: roleRow, error: roleError } = await db
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();
      if (roleError) throw roleError;

      const role = roleRow?.role || "";
      if (role !== "merchant" && role !== "site_creator") return;

      if (role === "merchant") {
        const { data: merchant, error: merchantError } = await db
          .from("merchants")
          .select("is_active")
          .eq("user_id", user.id)
          .maybeSingle();
        if (merchantError) throw merchantError;
        if (merchant?.is_active !== true) return;
      }

      channel = db
        .channel("delune-merchant-order-alerts-" + user.id)
        .on("postgres_changes", {
          event: "INSERT",
          schema: "public",
          table: "orders"
        }, handleNewOrder)
        .subscribe(subscriptionState => {
          if (subscriptionState === "SUBSCRIBED") {
            status.textContent = "Live order alerts connected.";
          } else if (subscriptionState === "CHANNEL_ERROR" || subscriptionState === "TIMED_OUT") {
            status.textContent = "Live alerts disconnected. Refresh the Merchant Panel to reconnect.";
          }
        });
    } catch (error) {
      console.error("[DeLune notifications] Could not start real-time alerts", error);
      status.textContent = "Live alerts could not start. Check Realtime publication and access.";
    }
  }

  enableButton.addEventListener("click", async () => {
    if (!("Notification" in window)) {
      status.textContent = "This browser does not support system notifications.";
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          audioContext = audioContext || new AudioContextClass();
          await audioContext.resume();
        }
        status.textContent = "Browser notifications enabled. Keep the Merchant Panel open for live order alerts.";
      } else {
        status.textContent = permission === "denied"
          ? "Browser notifications are blocked in site settings. In-panel alerts will still appear."
          : "Notification permission was not granted. In-panel alerts will still appear.";
      }
    } catch (error) {
      status.textContent = "Could not enable browser notifications: " + (error.message || "Unknown error");
    }
    setPermissionLabel();
  });

  db.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      if (channel) db.removeChannel(channel);
      channel = null;
      seenOrders.clear();
      return;
    }
    if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") {
      // Run after the auth callback returns to avoid blocking Supabase's auth lock.
      Promise.resolve().then(() => connectForUser(session));
    }
  });

  setPermissionLabel();
})();
