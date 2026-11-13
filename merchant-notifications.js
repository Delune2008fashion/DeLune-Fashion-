/* DeLune Merchant: real-time order alerts and manual notification controls. */
(() => {
  const db = window.DeLuneStore?.client;
  const enableButton = document.getElementById("enableOrderNotifications");
  const testButton = document.getElementById("testOrderNotification");
  const toast = document.getElementById("orderNotificationToast");
  const status = document.getElementById("orderNotificationStatus");
  if (!db || !enableButton || !testButton || !toast) return;

  let channel = null;
  let audioContext = null;
  let toastTimer = null;
  const seenOrders = new Set();

  function setPermissionLabel() {
    if (!("Notification" in window)) {
      enableButton.textContent = "Notifications unavailable";
      enableButton.disabled = true;
      return;
    }
    enableButton.disabled = false;
    enableButton.textContent = Notification.permission === "granted"
      ? "Notifications allowed"
      : Notification.permission === "denied"
        ? "Permission blocked — how to allow"
        : "Allow notifications";
  }

  function showToast(orderCode, items, title = "New order received") {
    toast.replaceChildren();
    const heading = document.createElement("strong");
    heading.textContent = title;
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

  function sendSystemNotification(title, body, tag) {
    if (!("Notification" in window) || Notification.permission !== "granted") return false;
    try {
      const notification = new Notification(title, {
        body,
        icon: "/DeLune-Fashion-/logo.png",
        tag,
        renotify: false
      });
      notification.onclick = () => {
        window.focus();
        notification.close();
        document.getElementById("orders")?.scrollIntoView({ behavior: "smooth", block: "start" });
      };
      return true;
    } catch (error) {
      console.warn("[DeLune notifications] System notification unavailable", error);
      return false;
    }
  }

  async function handleNewOrder(payload) {
    const order = payload?.new;
    if (!order?.id || seenOrders.has(order.id)) return;
    seenOrders.add(order.id);

    let items = [];
    try {
      const { data, error } = await db.from("order_items")
        .select("product_name,quantity").eq("order_id", order.id);
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
    sendSystemNotification("New DeLune order", orderCode + " — " + itemSummary, "delune-order-" + order.id);
  }

  async function connectForUser(session) {
    const user = session?.user;
    if (!user?.id) return;
    if (channel) {
      await db.removeChannel(channel);
      channel = null;
    }
    try {
      const { data: roleRow, error: roleError } = await db.from("user_roles")
        .select("role").eq("user_id", user.id).maybeSingle();
      if (roleError) throw roleError;
      const role = roleRow?.role || "";
      if (role !== "merchant" && role !== "site_creator") return;
      if (role === "merchant") {
        const { data: merchant, error: merchantError } = await db.from("merchants")
          .select("is_active").eq("user_id", user.id).maybeSingle();
        if (merchantError) throw merchantError;
        if (merchant?.is_active !== true) return;
      }
      channel = db.channel("delune-merchant-order-alerts-" + user.id)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, handleNewOrder)
        .subscribe(subscriptionState => {
          if (subscriptionState === "SUBSCRIBED") status.textContent = "Live order alerts connected.";
          else if (subscriptionState === "CHANNEL_ERROR" || subscriptionState === "TIMED_OUT")
            status.textContent = "Live alerts disconnected. Refresh the Merchant Panel to reconnect.";
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
    if (Notification.permission === "denied") {
      status.textContent = "Permission is blocked by the browser. Open your browser's site settings for delune2008fashion.github.io → Notifications → Allow, then reload this page.";
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
        status.textContent = "Notifications allowed. Use Test notification to check them. Keep Merchant Panel open for live order alerts.";
      } else {
        status.textContent = "Permission was not granted. You can try again with Allow notifications; in-panel alerts still work.";
      }
    } catch (error) {
      status.textContent = "Could not request notification permission: " + (error.message || "Unknown error");
    }
    setPermissionLabel();
  });

  testButton.addEventListener("click", async () => {
    showToast("TEST-DELUNE-001", [{ product_name: "Sample product", quantity: 1 }], "Test notification");
    playAlertTone();
    if (!("Notification" in window)) {
      status.textContent = "Test shown inside Merchant Panel. This browser does not support system notifications.";
      return;
    }
    if (Notification.permission === "granted") {
      const sent = sendSystemNotification("DeLune test notification", "Your Merchant Panel notifications are working.", "delune-test-notification");
      status.textContent = sent
        ? "Test sent — check your browser/device notification area."
        : "In-panel test shown, but the system notification could not be displayed.";
    } else {
      status.textContent = "In-panel test shown. Tap Allow notifications first to test system notifications.";
    }
  });

  db.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") {
      if (channel) db.removeChannel(channel);
      channel = null;
      seenOrders.clear();
      return;
    }
    if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED")
      Promise.resolve().then(() => connectForUser(session));
  });

  setPermissionLabel();
})();
