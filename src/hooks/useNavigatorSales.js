import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

// The Navigator event stall was a one-off; its page is gone but the sales it
// logged in `navigator_sessions` still count as revenue. They're returned in
// the same shape as a user session so revenue screens can merge them in.
// The stall never recorded a payment method.
export const NAVIGATOR_MACHINE = "Navigator Event";

const useNavigatorSales = (enabled = true) => {
  const [sales, setSales] = useState([]);

  useEffect(() => {
    if (!enabled) return;
    const unsub = onSnapshot(collection(db, "navigator_sessions"), (snapshot) => {
      const list = [];
      snapshot.forEach((d) => {
        const data = d.data();
        list.push({
          startTime: data.startTime,
          duration: Number(data.duration) || 0,
          amountPaid: Number(data.price) || 0,
          method: "N/A",
          machine: NAVIGATOR_MACHINE,
          players: `Navigator stall (${data.stationName || "station"})`,
          isNavigator: true,
        });
      });
      setSales(list);
    });
    return () => unsub();
  }, [enabled]);

  return sales;
};

export default useNavigatorSales;
