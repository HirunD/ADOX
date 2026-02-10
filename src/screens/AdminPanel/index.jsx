import React, { useState, useEffect, useRef } from "react";
import QrScanner from "qr-scanner";
import { db } from "../../firebase";
import {
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  setDoc,
  deleteDoc, // Added for clearing reservations
} from "firebase/firestore";

const AdminPanel = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [password, setPassword] = useState("");
  const [userData, setUserData] = useState(null);
  const [isLocked, setIsLocked] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [pendingTransaction, setPendingTransaction] = useState(null);

  const [standardPricing, setStandardPricing] = useState(null);
  const [peakPricing, setPeakPricing] = useState(null);
  const [selectedMachine, setSelectedMachine] = useState("");

  const [lapTime, setLapTime] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);

  const [receiptData, setReceiptData] = useState(null);
  const [activeSessions, setActiveSessions] = useState([]);
  const [reservations, setReservations] = useState([]); // New state for bookings
  const [occupiedCount, setOccupiedCount] = useState(0);
  const [manualOverride, setManualOverride] = useState(false);

  const MACHINES = ["Simulator", "PS5", "PC", "PS4 #1", "PS4 #2", "PS4 #3"]; // You mentioned 3 PS4s, which makes 6 units?
  const TOTAL_CAPACITY = 3;

  const [searchPhone, setSearchPhone] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);

  const videoRef = useRef(null);
  const scannerRef = useRef(null);
  const audioRef = useRef(new Audio("/success.mp3"));

  const checkIsPeak = () => {
    if (standardPricing?.isPeak === true) return true;
    const now = new Date();
    const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
    return currentTotalMinutes >= 780 && currentTotalMinutes <= 930;
  };

  // --- DATA LISTENERS ---
  useEffect(() => {
    const unsubStd = onSnapshot(doc(db, "settings", "pricing"), (docSnap) => {
      if (docSnap.exists()) setStandardPricing(docSnap.data());
    });
    const unsubPeak = onSnapshot(doc(db, "settings", "peak"), (docSnap) => {
      if (docSnap.exists()) setPeakPricing(docSnap.data());
    });

    // Listen for Today's Reservations
    const today = new Date().toISOString().split("T")[0];
    const qRes = query(
      collection(db, "reservations"),
      where("date", "==", today),
    );
    const unsubRes = onSnapshot(qRes, (snap) => {
      const resList = [];
      snap.forEach((d) => resList.push({ id: d.id, ...d.data() }));
      setReservations(
        resList.sort((a, b) => a.startTime.localeCompare(b.startTime)),
      );
    });

    return () => {
      unsubStd();
      unsubPeak();
      unsubRes();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
      const now = new Date();
      const active = [];
      snapshot.forEach((userDoc) => {
        const data = userDoc.data();
        if (data.sessions) {
          data.sessions.forEach((s) => {
            const start = new Date(s.startTime);
            const durationHrs = parseFloat(s.duration) || 0;
            const end = new Date(
              start.getTime() + durationHrs * 3600000 + 600000,
            );
            if (now >= start && now < end) {
              active.push({
                name: data.fullName,
                machine: s.machine,
                endTime: end,
                timeLeft: Math.round((end - now) / 60000),
              });
            }
          });
        }
      });
      setActiveSessions(active.sort((a, b) => a.endTime - b.endTime));
      setOccupiedCount(active.length);
    });
    return () => unsubscribe();
  }, [standardPricing]);

  // --- RESERVATION CHECK-IN LOGIC ---
  const handleCheckIn = (res) => {
    setUserData({
      fullName: res.customerName,
      phone: res.phone,
      uid: res.userId === "GUEST" ? "GUEST_" + Date.now() : res.userId,
      isGuest: res.userId === "GUEST" || !res.userId,
    });
    setSelectedMachine(res.machine);
    const isPeak = checkIsPeak();
    const priceSource = isPeak ? peakPricing : standardPricing;
    const price = priceSource ? priceSource[String(res.duration)] : 0;
    setPendingTransaction({ hours: parseFloat(res.duration), price: price });
    // Note: We delete the reservation only after successful confirmPayment
  };

  // --- CAMERA LOGIC ---
  const handleScan = async (result) => {
    if (isLocked || !result) return;
    try {
      const data = JSON.parse(result.data);
      if (data.uid) {
        setIsLocked(true);
        const userDoc = await getDoc(doc(db, "users", data.uid));
        if (userDoc.exists()) {
          audioRef.current.play().catch(() => {});
          setUserData({ ...userDoc.data(), uid: data.uid });
        }
        setTimeout(() => setIsLocked(false), 3000);
      }
    } catch (e) {
      console.error("Scan Error:", e);
    }
  };

  useEffect(() => {
    if (isAdmin && videoRef.current) {
      scannerRef.current = new QrScanner(
        videoRef.current,
        (res) => handleScan(res),
        {
          highlightScanRegion: true,
          highlightCodeOutline: true,
        },
      );
      scannerRef.current.start().catch((err) => console.error(err));
    }
    return () => scannerRef.current?.destroy();
  }, [isAdmin]);

  const startGuestBooking = () => {
    setUserData({
      fullName: "Guest Player",
      uid: "GUEST_" + Date.now(),
      phone: "N/A",
      isGuest: true,
    });
    setPendingTransaction(null);
    setAppliedCoupon(null);
    setLapTime("");
  };

  const applyCoupon = async () => {
    if (!couponCode) return;
    try {
      const couponRef = doc(db, "coupons", couponCode.toUpperCase().trim());
      const couponSnap = await getDoc(couponRef);
      if (couponSnap.exists() && couponSnap.data().isActive) {
        setAppliedCoupon(couponSnap.data());
      } else {
        alert("Invalid Coupon");
        setAppliedCoupon(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const calculateFinalTotal = () => {
    if (!pendingTransaction) return 0;
    const base = Number(pendingTransaction.price);
    if (appliedCoupon?.discount)
      return base - (base * Number(appliedCoupon.discount)) / 100;
    return base;
  };

  const handlePhoneSearch = async (e) => {
    e.preventDefault();
    setSearchLoading(true);
    try {
      const q = query(
        collection(db, "users"),
        where("phone", "==", searchPhone),
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        setUserData({ ...snap.docs[0].data(), uid: snap.docs[0].id });
        setSearchPhone("");
      } else {
        alert("User not found");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSearchLoading(false);
    }
  };

  const confirmPayment = async (method) => {
    if (!userData || !pendingTransaction || !selectedMachine)
      return alert("Missing Info!");
    setIsUpdating(true);
    const isPeakNow = checkIsPeak();
    const finalAmount = calculateFinalTotal();

    const dataForReceipt = {
      name: userData.fullName,
      machine: selectedMachine,
      hours: pendingTransaction.hours,
      discount: appliedCoupon ? `${appliedCoupon.discount}%` : null,
      lapTime: lapTime || "N/A",
      total: finalAmount,
      method: method,
      time: new Date().toLocaleTimeString(),
      isPeak: isPeakNow,
    };

    setReceiptData(dataForReceipt);

    try {
      const sessionData = {
        startTime: new Date().toISOString(),
        duration: pendingTransaction.hours,
        amountPaid: finalAmount,
        method: method,
        machine: selectedMachine,
        bestLap: lapTime || null,
        isPeak: isPeakNow,
      };

      if (userData.isGuest) {
        await setDoc(doc(db, "guests", userData.uid), {
          ...userData,
          session: sessionData,
          createdAt: new Date().toISOString(),
        });
      } else {
        await updateDoc(doc(db, "users", userData.uid), {
          sessions: arrayUnion(sessionData),
        });
      }

      // If this was a reservation, find it and delete it now that it's paid
      const resToClear = reservations.find(
        (r) => r.phone === userData.phone && r.machine === selectedMachine,
      );
      if (resToClear) await deleteDoc(doc(db, "reservations", resToClear.id));

      setTimeout(() => {
        window.print();
        setUserData(null);
        setPendingTransaction(null);
        setAppliedCoupon(null);
        setCouponCode("");
        setLapTime("");
        setSelectedMachine("");
        setReceiptData(null);
        setIsUpdating(false);
      }, 800);
    } catch (e) {
      alert("Error saving session");
      setIsUpdating(false);
    }
  };

  if (!isAdmin) {
    return (
      <div
        className="section"
        style={{ background: "#050505", minHeight: "100vh" }}
      >
        <form
          className="box"
          style={{
            maxWidth: "400px",
            margin: "100px auto",
            background: "#1a1a1a",
            border: "1px solid #333",
          }}
          onSubmit={(e) => {
            e.preventDefault();
            if (password === import.meta.env.VITE_ADMIN_PASSWORD)
              setIsAdmin(true);
          }}
        >
          <h1 className="title has-text-white">Admin Login</h1>
          <input
            className="input is-dark mb-3"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="Access Key"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="button is-primary is-fullwidth">Login</button>
        </form>
      </div>
    );
  }

  return (
    <div
      className="section"
      style={{ background: "#050505", minHeight: "100vh" }}
    >
      <div id="receipt-print" style={{ display: "none" }}>
        {receiptData && (
          <div
            style={{
              width: "75mm",
              padding: "10px",
              color: "black",
              fontFamily: "monospace",
            }}
          >
            <center>
              <h2 style={{ margin: "0" }}>ADOX GAMING</h2>
              <p>---------------------------</p>
            </center>
            <p>
              <b>PLAYER:</b> {receiptData.name}
            </p>
            <p>
              <b>STATION:</b> {receiptData.machine}
            </p>
            <p>
              <b>TIME:</b> {receiptData.hours} Hr{" "}
              {receiptData.isPeak && "(Peak)"}
            </p>
            <p>
              <b>BEST LAP:</b> {receiptData.lapTime}
            </p>
            {receiptData.discount && (
              <p>
                <b>OFF:</b> {receiptData.discount}
              </p>
            )}
            <p>
              <b>PAID VIA:</b> {receiptData.method}
            </p>
            <p>---------------------------</p>
            <h2 style={{ textAlign: "right" }}>
              Total: Rs. {receiptData.total}
            </h2>
            <center style={{ marginTop: "15px", fontSize: "10px" }}>
              <p>{receiptData.time}</p>
            </center>
          </div>
        )}
      </div>

      <div className="container">
        <div className="columns">
          <div className="column is-4">
            {/* ACTIVE SESSIONS */}
            <div
              className="box mb-4"
              style={{ background: "#1a1a1a", border: "1px solid #333" }}
            >
              <div className="is-flex is-justify-content-space-between is-align-items-center mb-2">
                <h3 className="subtitle is-6 has-text-white mb-0">
                  Active ({occupiedCount}/{TOTAL_CAPACITY})
                </h3>
                <button
                  className={`button is-small ${manualOverride ? "is-danger" : "is-dark"}`}
                  onClick={() => setManualOverride(!manualOverride)}
                  style={{ height: "24px", fontSize: "10px" }}
                >
                  {manualOverride ? "OVERRIDE ON" : "AUTO LOCK"}
                </button>
              </div>
              {activeSessions.map((s, i) => (
                <div
                  key={i}
                  className="mb-2 p-2"
                  style={{
                    background: "#222",
                    borderLeft: "4px solid #00d1b2",
                  }}
                >
                  <p className="is-size-7 has-text-white">
                    <b>{s.machine}</b>: {s.name}
                  </p>
                  <p className="is-size-7 has-text-warning">
                    {s.timeLeft}m left
                  </p>
                </div>
              ))}
            </div>

            {/* NEW: PENDING RESERVATIONS CHECK-IN */}
            <div
              className="box mb-4"
              style={{ background: "#1a1a1a", border: "1px solid #ffdd57" }}
            >
              <h3 className="subtitle is-6 has-text-warning mb-2">
                Today's Bookings
              </h3>
              {reservations.length > 0 ? (
                reservations.map((res, i) => (
                  <div
                    key={i}
                    className="mb-2 p-2"
                    style={{ background: "#222", borderRadius: "8px" }}
                  >
                    <div className="is-flex is-justify-content-between is-align-items-center">
                      <div>
                        <p className="is-size-7 has-text-white">
                          <b>{res.startTime}</b>: {res.customerName}
                        </p>
                        <p className="is-size-7 has-text-grey">{res.machine}</p>
                      </div>
                      <button
                        className="button is-warning is-small"
                        onClick={() => handleCheckIn(res)}
                        style={{
                          height: "28px",
                          fontSize: "10px",
                          fontWeight: "bold",
                        }}
                      >
                        CHECK-IN
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="is-size-7 has-text-grey">
                  No bookings for today.
                </p>
              )}
            </div>

            <div
              style={{
                position: "relative",
                borderRadius: "10px",
                overflow: "hidden",
                border: "2px solid #333",
              }}
            >
              <video
                ref={videoRef}
                style={{ width: "100%", display: "block", background: "#000" }}
              ></video>
            </div>
          </div>

          <div className="column is-8">
            <div
              className="box mb-4"
              style={{ background: "#1a1a1a", border: "1px solid #333" }}
            >
              <div className="columns is-vcentered is-mobile is-multiline">
                <div className="column is-12-mobile is-7-tablet">
                  <form
                    onSubmit={handlePhoneSearch}
                    className="field has-addons mb-0"
                  >
                    <div className="control is-expanded">
                      <input
                        className="input is-dark"
                        type="tel"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder="Phone..."
                        value={searchPhone}
                        onChange={(e) => setSearchPhone(e.target.value)}
                      />
                    </div>
                    <div className="control">
                      <button type="submit" className="button is-primary">
                        Find
                      </button>
                    </div>
                  </form>
                </div>
                <div className="column is-12-mobile is-5-tablet">
                  <div className="is-flex is-justify-content-end is-align-items-center">
                    <button
                      className="button is-warning is-small has-text-weight-bold mr-3"
                      onClick={startGuestBooking}
                      style={{ height: "32px" }}
                    >
                      👤 GUEST
                    </button>
                    <div>
                      {checkIsPeak() ? (
                        <span className="tag is-danger is-medium has-text-weight-bold">
                          PEAK ACTIVE
                        </span>
                      ) : (
                        <span className="tag is-success is-medium has-text-weight-bold">
                          NORMAL
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {userData && (
              <div
                className="box"
                style={{
                  background: "#1a1a1a",
                  color: "white",
                  border: "1px solid #00d1b2",
                }}
              >
                <div className="is-flex is-justify-content-space-between mb-4">
                  <h2 className="title is-5 has-text-white">
                    {userData.fullName}{" "}
                    {userData.isGuest && (
                      <span className="tag is-warning ml-2">GUEST</span>
                    )}
                  </h2>
                  <button
                    className="delete"
                    onClick={() => setUserData(null)}
                  ></button>
                </div>

                <div className="columns">
                  <div className="column">
                    <label className="label is-small has-text-grey">
                      STATION
                    </label>
                    {MACHINES.map((m) => (
                      <button
                        key={m}
                        className={`button is-small is-fullwidth mb-2 ${selectedMachine === m ? "is-primary" : "is-dark"}`}
                        onClick={() => setSelectedMachine(m)}
                        disabled={
                          activeSessions.some((s) => s.machine === m) &&
                          !manualOverride
                        }
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                  <div className="column">
                    <label className="label is-small has-text-grey">TIME</label>
                    {[0.5, 1, 2].map((h) => {
                      const isPeak = checkIsPeak();
                      const priceSource = isPeak
                        ? peakPricing
                        : standardPricing;
                      const price = priceSource ? priceSource[String(h)] : 0;
                      return (
                        <button
                          key={h}
                          className={`button is-small is-fullwidth mb-2 ${pendingTransaction?.hours === h ? "is-info" : "is-dark"}`}
                          onClick={() =>
                            setPendingTransaction({ hours: h, price: price })
                          }
                        >
                          {h}h - Rs.{price}
                        </button>
                      );
                    })}
                  </div>
                  <div className="column">
                    <label className="label is-small has-text-grey">
                      SESSION RECORD
                    </label>
                    <input
                      className="input is-small is-dark mb-2"
                      placeholder="Lap Time"
                      value={lapTime}
                      onChange={(e) => setLapTime(e.target.value)}
                    />
                    <label className="label is-small has-text-grey">
                      COUPON
                    </label>
                    <div className="field has-addons">
                      <div className="control is-expanded">
                        <input
                          className="input is-small is-dark"
                          value={couponCode}
                          onChange={(e) => setCouponCode(e.target.value)}
                        />
                      </div>
                      <div className="control">
                        <button
                          className="button is-danger is-small"
                          onClick={applyCoupon}
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {pendingTransaction && (
                  <div
                    className="notification mt-4 is-dark"
                    style={{ border: "1px solid #00d1b2" }}
                  >
                    <p className="title is-3 has-text-white">
                      Rs. {calculateFinalTotal()}
                    </p>
                    <div className="buttons">
                      <button
                        className={`button is-success is-fullwidth ${isUpdating ? "is-loading" : ""}`}
                        onClick={() => confirmPayment("CASH")}
                      >
                        CASH
                      </button>
                      <button
                        className={`button is-info is-fullwidth ${isUpdating ? "is-loading" : ""}`}
                        onClick={() => confirmPayment("CARD")}
                      >
                        CARD
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #receipt-print { display: block !important; visibility: visible; position: absolute; left: 0; top: 0; }
          #receipt-print * { visibility: visible; }
        }
      `}</style>
    </div>
  );
};

export default AdminPanel;
