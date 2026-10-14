import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { DEFAULT_RATES } from "../config/stations";

export const RATES_DOC = ["settings", "venueRates"];

// Live venue rates from Firestore, merged over DEFAULT_RATES so a missing or
// not-yet-loaded field never prices anything at 0.
const useRates = () => {
  const [rates, setRates] = useState(DEFAULT_RATES);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, ...RATES_DOC), (snap) => {
      const data = snap.exists() ? snap.data() : {};
      const merged = { ...DEFAULT_RATES };
      Object.keys(DEFAULT_RATES).forEach((k) => {
        const v = Number(data[k]);
        if (Number.isFinite(v) && v > 0) merged[k] = v;
      });
      setRates(merged);
    });
    return () => unsub();
  }, []);

  return rates;
};

export default useRates;
