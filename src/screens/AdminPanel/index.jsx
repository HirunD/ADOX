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
} from "firebase/firestore";

const isCurrentlyPeakTime = () => {
  const now = new Date();
  const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
  const peakStart = 13 * 60 + 30; 
  const peakEnd = 15 * 60 + 0; 
  return currentTotalMinutes >= peakStart && currentTotalMinutes < peakEnd;
};

const AdminPanel = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [password, setPassword] = useState("");
  const [userData, setUserData] = useState(null);
  const [isLocked, setIsLocked] = useState(false); // Scan lock
  const [isUpdating, setIsUpdating] = useState(false);
  const [pendingTransaction, setPendingTransaction] = useState(null);

  const [pricingConfig, setPricingConfig] = useState(null);
  const [selectedMachine, setSelectedMachine] = useState("");
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState("");

  const [activeSessions, setActiveSessions] = useState([]);
  const [occupiedCount, setOccupiedCount] = useState(0);
  const [manualOverride, setManualOverride] = useState(false); // CAPACITY OVERRIDE
  
  const MACHINES = ["Sim", "PC1", "PC2"];
  const TOTAL_CAPACITY = MACHINES.length;

  const [searchPhone, setSearchPhone] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);

  const videoRef = useRef(null);
  const scannerRef = useRef(null);
  const audioRef = useRef(new Audio("/success.mp3"));

  // --- 1. DATA LISTENERS ---
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "pricing"), (docSnap) => {
      if (docSnap.exists()) {
        const rawData = docSnap.data();
        if (rawData.pricing && rawData.pricing.standard) {
          setPricingConfig(rawData.pricing);
        } else {
          setPricingConfig(rawData);
        }
      }
    });
    return () => unsub();
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
            const end = new Date(start.getTime() + parseFloat(s.duration) * 3600000 + 600000);
            if (now >= start && now < end) {
              active.push({ name: data.fullName, machine: s.machine, endTime: end, timeLeft: Math.round((end - now) / 60000) });
            }
          });
        }
      });
      setActiveSessions(active.sort((a, b) => a.endTime - b.endTime));
      setOccupiedCount(active.length);
    });
    return () => unsubscribe();
  }, []);

  // --- 2. CAMERA LOGIC ---
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
    } catch (e) { console.error("Scan Error:", e); }
  };

  useEffect(() => {
    if (isAdmin && videoRef.current) {
      scannerRef.current = new QrScanner(
        videoRef.current,
        (result) => handleScan(result),
        { highlightScanRegion: true, highlightCodeOutline: true }
      );
      scannerRef.current.start().catch((err) => console.error(err));
    }
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop();
        scannerRef.current.destroy();
      }
    };
  }, [isAdmin]);

  // --- 3. PRICING & HANDLERS ---
  const getRate = (h) => {
    if (!pricingConfig) return 0;
    const val = pricingConfig[h] || pricingConfig[String(h)];
    return val ? Number(val) : 0;
  };

  const calculateFinalTotal = () => {
    if (!pendingTransaction) return 0;
    const base = Number(pendingTransaction.price);
    if (appliedCoupon && appliedCoupon.discount) {
      const reduction = (base * Number(appliedCoupon.discount)) / 100;
      return base - reduction;
    }
    return base;
  };

  const applyCoupon = async () => {
    if (!couponCode) return;
    setCouponError("");
    try {
      const couponRef = doc(db, "coupons", couponCode.toUpperCase().trim());
      const couponSnap = await getDoc(couponRef);
      if (couponSnap.exists()) {
        const data = couponSnap.data();
        if (data.isActive) { setAppliedCoupon(data); } 
        else { setCouponError("Disabled"); setAppliedCoupon(null); }
      } else { setCouponError("Invalid"); setAppliedCoupon(null); }
    } catch (err) { setCouponError("Error"); }
  };

  const handlePhoneSearch = async (e) => {
    if (e) e.preventDefault();
    setSearchLoading(true);
    try {
      const q = query(collection(db, "users"), where("phone", "==", searchPhone));
      const snap = await getDocs(q);
      if (!snap.empty) {
        setUserData({ ...snap.docs[0].data(), uid: snap.docs[0].id });
        setSearchPhone("");
      } else { alert("User not found"); }
    } catch (err) { console.error(err); } finally { setSearchLoading(false); }
  };

  const confirmPayment = async (method) => {
    if (!userData || !pendingTransaction || !selectedMachine) return alert("Select Station & Time!");
    setIsUpdating(true);
    try {
      await updateDoc(doc(db, "users", userData.uid), {
        sessions: arrayUnion({
          startTime: new Date().toISOString(),
          duration: pendingTransaction.hours,
          amountPaid: calculateFinalTotal(),
          method: method,
          machine: selectedMachine,
        }),
      });
      setTimeout(() => window.print(), 500);
      setUserData(null);
      setPendingTransaction(null);
      setAppliedCoupon(null);
      setCouponCode("");
      setSelectedMachine("");
    } catch (e) { alert("Failed!"); } finally { setIsUpdating(false); }
  };

  if (!isAdmin) {
    return (
      <div className="section" style={{ background: "#050505", minHeight: "100vh" }}>
        <form className="box" style={{ maxWidth: "400px", margin: "100px auto", background: "#1a1a1a", border: "1px solid #333" }}
          onSubmit={(e) => {
            e.preventDefault();
            if (password === import.meta.env.VITE_ADMIN_PASSWORD) setIsAdmin(true);
          }}>
          <h1 className="title has-text-white">Admin Login</h1>
          <input className="input is-dark mb-3" type="password" placeholder="Access Key" onChange={(e) => setPassword(e.target.value)} />
          <button className="button is-primary is-fullwidth">Login</button>
        </form>
      </div>
    );
  }

  // --- Logic for Capacity Check ---
  const isFull = occupiedCount >= TOTAL_CAPACITY && !manualOverride;

  return (
    <div className="section" style={{ background: "#050505", minHeight: "100vh" }}>
      
      {/* THERMAL RECEIPT */}
      <div id="receipt-print" style={{ display: "none" }}>
        <div style={{ width: "80mm", padding: "5mm", fontFamily: "monospace", color: "black" }}>
          <center>
            <h2 style={{ margin: "0" }}>ADOX GAMING</h2>
            <hr style={{ border: "0.5px dashed black" }} />
          </center>
          <div style={{ fontSize: "14px" }}>
            <p>Date: {new Date().toLocaleDateString()}</p>
            <p>Player: {userData?.fullName}</p>
            <p>Station: {selectedMachine}</p>
            <p>Duration: {pendingTransaction?.hours}h</p>
            <hr style={{ border: "0.5px dashed black" }} />
            <h3 style={{ textAlign: "right" }}>Total: Rs. {calculateFinalTotal()}</h3>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="columns">
          {/* LEFT: MONITOR */}
          <div className="column is-4">
            <div className="box" style={{ background: "#1a1a1a", border: "1px solid #333" }}>
              <div className="is-flex is-justify-content-space-between mb-3">
                <h3 className="subtitle is-6 has-text-white mb-0">Active ({occupiedCount}/{TOTAL_CAPACITY})</h3>
                <button 
                  className={`button is-extremely-small ${manualOverride ? 'is-danger' : 'is-dark'}`}
                  onClick={() => setManualOverride(!manualOverride)}
                  style={{ fontSize: '0.6rem', padding: '0 5px' }}
                >
                  {manualOverride ? 'OVERRIDE ON' : 'MANUAL'}
                </button>
              </div>
              
              {activeSessions.length === 0 ? (
                <p className="has-text-grey is-size-7">No active players</p>
              ) : (
                activeSessions.map((s, i) => (
                  <div key={i} className="mb-2 p-2" style={{ background: "#222", borderLeft: "4px solid #00d1b2" }}>
                    <p className="is-size-7 has-text-white">{s.name} - <b>{s.machine}</b></p>
                    <p className="is-size-7 has-text-warning">{s.timeLeft}m left</p>
                  </div>
                ))
              )}
            </div>
            <div style={{ position: "relative", overflow: "hidden", borderRadius: "8px", border: "2px solid #333" }}>
              <video ref={videoRef} style={{ width: "100%", display: "block", background: "#000" }}></video>
            </div>
          </div>

          {/* RIGHT: BILLING */}
          <div className="column is-8">
            <div className="box mb-4" style={{ background: "#1a1a1a", border: "1px solid #333" }}>
              <form onSubmit={handlePhoneSearch} className="field has-addons">
                <div className="control is-expanded"><input className="input is-dark" type="text" placeholder="Phone Search..." value={searchPhone} onChange={(e) => setSearchPhone(e.target.value)} /></div>
                <div className="control"><button type="submit" className={`button is-primary ${searchLoading ? 'is-loading' : ''}`}>Search</button></div>
              </form>
            </div>

            {userData && (
              <div className="box" style={{ background: "#1a1a1a", color: "white", border: "1px solid #333" }}>
                <div className="columns">
                  <div className="column is-4">
                    <label className="label is-small has-text-primary">1. STATION</label>
                    <div className="buttons">
                      {MACHINES.map((m) => (
                        <button 
                          key={m} 
                          className={`button is-small is-fullwidth ${selectedMachine === m ? "is-primary" : "is-dark"}`} 
                          onClick={() => setSelectedMachine(m)}
                          disabled={activeSessions.some(s => s.machine === m) && !manualOverride}
                        >
                          {m} {activeSessions.some(s => s.machine === m) ? "(Busy)" : ""}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="column is-4">
                    <label className="label is-small has-text-info">2. TIME</label>
                    <div className="buttons">
                      {[0.5, 1, 2].map((h) => {
                        const rate = getRate(h);
                        return (
                          <button key={h} className={`button is-small is-fullwidth ${pendingTransaction?.hours === h ? 'is-info' : 'is-dark'}`} onClick={() => setPendingTransaction({ hours: h, price: rate })}>
                            {h === 0.5 ? "30m" : h + "h"} - Rs.{rate}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="column is-4">
                    <label className="label is-small has-text-danger">3. COUPON</label>
                    <div className="field has-addons">
                      <div className="control is-expanded"><input className="input is-small is-dark" type="text" value={couponCode} onChange={(e) => setCouponCode(e.target.value)} /></div>
                      <div className="control"><button className="button is-danger is-small" onClick={applyCoupon}>Apply</button></div>
                    </div>
                    {appliedCoupon && <p className="help is-success">{appliedCoupon.discount}% Off Applied!</p>}
                  </div>
                </div>

                {pendingTransaction && (
                  <div className="notification mt-4 is-dark" style={{ border: isFull ? "2px solid #ff3860" : "2px solid #00d1b2" }}>
                    {isFull ? (
                      <div className="has-text-centered">
                        <p className="has-text-danger mb-2"><b>STORE AT FULL CAPACITY</b></p>
                        <p className="is-size-7">Use 'Manual' toggle to override</p>
                      </div>
                    ) : (
                      <>
                        <p className="is-size-3"><strong>Final: Rs. {calculateFinalTotal()}</strong></p>
                        <div className="buttons mt-2">
                          <button className={`button is-success is-fullwidth ${isUpdating ? 'is-loading' : ''}`} onClick={() => confirmPayment("CASH")}>Pay Cash</button>
                          <button className={`button is-info is-fullwidth ${isUpdating ? 'is-loading' : ''}`} onClick={() => confirmPayment("CARD")}>Pay Card</button>
                        </div>
                      </>
                    )}
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
          #receipt-print, #receipt-print * { visibility: visible; display: block !important; }
          #receipt-print { position: absolute; left: 0; top: 0; width: 100%; }
        }
        .is-extremely-small {
          height: 20px;
          padding: 0 8px;
          font-size: 10px;
        }
      `}</style>
    </div>
  );
};

export default AdminPanel;