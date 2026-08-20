// =========================================================================
// API CLIENT - POSTGRESQL LIVE & CLEAN ARCHITECTURE
// =========================================================================

const API_BASE_URL = typeof window !== 'undefined'
  ? `http://${window.location.hostname}:5000/api`
  : 'http://localhost:5000/api';

// Check Server Connection Health
export async function checkServerHealth() {
  try {
    const res = await fetch(`${API_BASE_URL}/health`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // server is offline
  }
  return null;
}

// Get Snapshot Metadata Status
export async function getSnapshotStatus() {
  try {
    const res = await fetch(`${API_BASE_URL}/snapshot/status`, { signal: AbortSignal.timeout(3000) });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // ignore
  }
  return { hasData: false, lastSyncedAt: null, rowCounts: {} };
}

// Trigger Manual Snapshot Sync
export async function triggerSnapshotSync() {
  const res = await fetch(`${API_BASE_URL}/snapshot/sync`, { 
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(180000) 
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'การซิงค์ข้อมูลล้มเหลว');
  }
  return await res.json();
}

// 1. Stagnant Data Fetcher (สินค้าค้าง 1 ปี)
export async function fetchStagnantData() {
  try {
    const res = await fetch(`${API_BASE_URL}/stagnant`, { signal: AbortSignal.timeout(60000) });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        console.log(`✅ [Live DB] Loaded ${data.length} Stagnant rows`);
        return { data, isLive: true };
      }
    }
  } catch (err) {
    console.warn(`⚠️ /api/stagnant connection notice:`, err.message);
  }
  return { data: [], isLive: false };
}

// 2. Expiry Data Fetcher (สินค้าหมดอายุ)
export async function fetchExpiryData() {
  try {
    const res = await fetch(`${API_BASE_URL}/expiry`, { signal: AbortSignal.timeout(60000) });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        console.log(`✅ [Live DB] Loaded ${data.length} Expiry rows`);
        return { data, isLive: true };
      }
    }
  } catch (err) {
    console.warn(`⚠️ /api/expiry connection notice:`, err.message);
  }
  return { data: [], isLive: false };
}

// 3. Dispatch Data Fetcher (ประวัติการจ่ายสินค้า)
export async function fetchDispatchData() {
  try {
    const res = await fetch(`${API_BASE_URL}/dispatch`, { signal: AbortSignal.timeout(60000) });
    if (res.ok) {
      const data = await res.json();
      if (data && data.transactions && data.transactions.length > 0) {
        console.log(`✅ [Live DB] Loaded ${data.transactions.length} Dispatch transactions`);
        return { data, isLive: true };
      }
    }
  } catch (err) {
    console.warn(`⚠️ /api/dispatch connection notice:`, err.message);
  }
  return {
    data: {
      products: [],
      destinations: [],
      departments: [],
      transactions: []
    },
    isLive: false
  };
}

// 4. Inventory Data Fetcher (ยอดสินค้าคงคลัง)
export async function fetchInventoryData() {
  try {
    const res = await fetch(`${API_BASE_URL}/inventory`, { signal: AbortSignal.timeout(60000) });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        console.log(`✅ [Live DB] Loaded ${data.length} Inventory items`);
        return { data, isLive: true };
      }
    }
  } catch (err) {
    console.warn(`⚠️ /api/inventory connection notice:`, err.message);
  }
  return { data: [], isLive: false };
}

// 5. Turnover Data Fetcher (อัตราหมุนเวียนสินค้า)
export async function fetchTurnoverData() {
  try {
    const res = await fetch(`${API_BASE_URL}/turnover`, { signal: AbortSignal.timeout(120000) });
    if (res.ok) {
      const data = await res.json();
      if (data && data.aggregated && data.aggregated.length > 0) {
        console.log(`✅ [Live DB] Loaded Turnover transactions from PostgreSQL`);
        return { data, isLive: true };
      }
    }
  } catch (err) {
    console.warn(`⚠️ /api/turnover connection notice:`, err.message);
  }

  return {
    data: {
      products: [],
      warehouses: [],
      months: [],
      aggregated: [],
      details: [],
      dowAggregated: []
    },
    isLive: false
  };
}
