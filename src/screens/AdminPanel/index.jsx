import React, { useState, useEffect, useRef } from "react";
import QrScanner from "qr-scanner";
import { db } from "../../firebase";
import {
  doc, getDoc, updateDoc, arrayUnion, collection, query, where,
  getDocs, onSnapshot, setDoc
} from "firebase/firestore";

const AdminPanel = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [password, setPassword] = useState("");
  const [userData, setUserData] = useState(null);
  const [friendData, setFriendData] = useState(null);
  const [friendPhone, setFriendPhone] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [pendingTransaction, setPendingTransaction] = useState(null);

  const [standardPricing, setStandardPricing] = useState(null);
  const [selectedMachine, setSelectedMachine] = useState("");
  const [lapTime, setLapTime] = useState("");
  const [receiptData, setReceiptData] = useState(null);
  const [activeSessions, setActiveSessions] = useState([]);
  const [sessionCountdowns, setSessionCountdowns] = useState({});
  const [occupiedCount, setOccupiedCount] = useState(0);

  // --- TRANSACTIONS PANEL ---
  const [transactions, setTransactions] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [txnFilter, setTxnFilter] = useState("today");
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [txnPanelOpen, setTxnPanelOpen] = useState(true);

  const MACHINES = ["Simulator", "PS5", "PC", "PS4 #1", "PS4 #2", "PS4 #3"];
  const TOTAL_CAPACITY = 6;
  const [searchPhone, setSearchPhone] = useState("");

  const videoRef = useRef(null);
  const scannerRef = useRef(null);
  const audioRef = useRef(new Audio("/success.mp3"));

  // --- CAMERA INITIALIZATION ---
  useEffect(() => {
    if (isAdmin && videoRef.current && !scannerRef.current) {
      scannerRef.current = new QrScanner(
        videoRef.current,
        (result) => {
          if (result) {
            try {
              const data = JSON.parse(result.data);
              if (data.uid) handleQrScan(data.uid);
            } catch (e) { console.error("Invalid QR Data"); }
          }
        },
        { highlightScanRegion: true, highlightCodeOutline: true }
      );
      scannerRef.current.start().catch((err) => console.error("Camera Start Error:", err));
    }
    return () => {
      if (scannerRef.current) {
        scannerRef.current.destroy();
        scannerRef.current = null;
      }
    };
  }, [isAdmin]);

  const handleQrScan = async (uid) => {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
      audioRef.current.play().catch(() => { });
      setUserData({ ...userDoc.data(), uid });
    }
  };

  // --- DATA LISTENERS ---
  useEffect(() => {
    // Pricing listener
    onSnapshot(doc(db, "settings", "pricing"), (docSnap) => {
      if (docSnap.exists()) setStandardPricing(docSnap.data());
    });

    // Transactions listener (Deduplicated)
    const unsubTxn = onSnapshot(collection(db, "users"), (snapshot) => {
      let allSessions = [];
      snapshot.forEach((d) => {
        const data = d.data();
        if (data.sessions && Array.isArray(data.sessions)) {
          data.sessions.forEach((s) => allSessions.push({ ...s, userName: data.fullName, userId: d.id }));
        }
      });
      const seen = new Set();
      const unique = allSessions.filter((s) => {
        const key = `${s.machine}_${s.startTime}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setTransactions(unique.sort((a, b) => new Date(b.startTime) - new Date(a.startTime)));
    });

    // Live Sessions listener
    const unsubLive = onSnapshot(collection(db, "users"), (snapshot) => {
      const now = new Date();
      const active = [];
      snapshot.forEach((userDoc) => {
        const data = userDoc.data();
        if (data.sessions) {
          data.sessions.forEach((s) => {
            const start = new Date(s.startTime);
            const durationHrs = parseFloat(s.duration) || 0;
            const end = new Date(start.getTime() + (durationHrs * 3600000));
            if (now >= start && now < end) {
              if (!active.find(a => a.machine === s.machine && a.startTime === s.startTime)) {
                active.push({ ...s, name: s.players || data.fullName, endTime: end });
              }
            }
          });
        }
      });
      setActiveSessions(active.sort((a, b) => a.endTime - b.endTime));
      setOccupiedCount(active.length);
    });

    return () => { unsubTxn(); unsubLive(); };
  }, []);

  // --- TRANSACTIONS FILTER LOGIC ---
  useEffect(() => {
    const now = new Date();
    const filtered = transactions.filter((t) => {
      const tDate = new Date(t.startTime);
      if (txnFilter === "today") return tDate.toDateString() === now.toDateString();
      if (txnFilter === "week") {
        const wAgo = new Date(); wAgo.setDate(now.getDate() - 7);
        return tDate >= wAgo;
      }
      if (txnFilter === "month") return tDate.getMonth() === now.getMonth() && tDate.getFullYear() === now.getFullYear();
      return true;
    });
    setFilteredData(filtered);
    setTotalRevenue(filtered.reduce((sum, t) => sum + (Number(t.amountPaid) || 0), 0));
  }, [transactions, txnFilter]);

  // --- COUNTDOWN TIMERS ---
  const alertedSessions = useRef(new Set());
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const updated = {};
      activeSessions.forEach((s) => {
        const key = `${s.machine}-${s.startTime}`;
        const secsLeft = Math.round((s.endTime.getTime() - now) / 1000);
        if (secsLeft <= 0) {
          if (!alertedSessions.current.has(key)) {
            alertedSessions.current.add(key);
            alert(`⏰ Time's up for ${s.machine}! (${s.name})`);
          }
          updated[key] = 0;
        } else {
          updated[key] = secsLeft;
        }
      });
      setSessionCountdowns(updated);
    }, 1000);
    return () => clearInterval(interval);
  }, [activeSessions]);

  const handlePhoneSearch = async (e, type = "primary") => {
    if (e) e.preventDefault();
    const phone = type === "primary" ? searchPhone : friendPhone;
    try {
      const q = query(collection(db, "users"), where("phone", "==", phone));
      const snap = await getDocs(q);
      if (!snap.empty) {
        const data = { ...snap.docs[0].data(), uid: snap.docs[0].id };
        if (type === "primary") { setUserData(data); setSearchPhone(""); }
        else { setFriendData(data); setFriendPhone(""); }
      } else { alert("User not found"); }
    } catch (err) { console.error(err); }
  };

  // --- PAYMENT CONFIRMATION ---
  const confirmPayment = async (method) => {
    if (!userData || !pendingTransaction || !selectedMachine) return alert("Missing Info!");
    if (activeSessions.some(s => s.machine === selectedMachine)) return alert("Machine Occupied!");

    setIsUpdating(true);

    const userBonusMins = (!userData.isGuest && userData.rewardClaimed === false) ? (userData.bonusMinutes || 0) : 0;
    const friendBonusMins = (friendData && friendData.rewardClaimed === false) ? (friendData.bonusMinutes || 0) : 0;

    // Duration gets the primary player's bonus
    const finalDuration = pendingTransaction.hours + (userBonusMins / 60);
    const finalAmount = Number(pendingTransaction.price);
    const playersNames = friendData ? `${userData.fullName} & ${friendData.fullName}` : userData.fullName;

    const sessionData = {
      startTime: new Date().toISOString(),
      duration: finalDuration,
      amountPaid: finalAmount,
      method,
      machine: selectedMachine,
      bestLap: lapTime || null,
      players: playersNames,
      bonusApplied: (userBonusMins + friendBonusMins) > 0
    };

    try {
      // 1. Update Primary Player (Record Session & Money)
      const userRef = doc(db, userData.isGuest ? "guests" : "users", userData.uid);
      if (userData.isGuest) {
        await setDoc(userRef, { ...userData, session: sessionData });
      } else {
        await updateDoc(userRef, { sessions: arrayUnion(sessionData), rewardClaimed: true });
      }

      // 2. Update Friend (Mark reward as used, DO NOT record session to avoid double revenue)
      if (friendData) {
        const friendRef = doc(db, "users", friendData.uid);
        await updateDoc(friendRef, { rewardClaimed: true });
      }

      setReceiptData({ ...sessionData, name: playersNames, total: finalAmount, bonus: (userBonusMins + friendBonusMins) });

      setTimeout(() => {
        window.print();
        setUserData(null); setFriendData(null); setPendingTransaction(null);
        setSelectedMachine(""); setIsUpdating(false); setLapTime("");
      }, 800);
    } catch (e) { alert("Save Error"); setIsUpdating(false); }
  };

  if (!isAdmin) return (
    <div className="section" style={{ background: "#050505", minHeight: "100vh" }}>
      <form className="box" style={{ maxWidth: "400px", margin: "100px auto", background: "#1a1a1a" }} onSubmit={(e) => {
        e.preventDefault(); if (password === import.meta.env.VITE_ADMIN_PASSWORD) setIsAdmin(true);
      }}>
        <h1 className="title has-text-white">Admin Login</h1>
        <input className="input is-dark mb-3" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="button is-primary is-fullwidth">Login</button>
      </form>
    </div>
  );

  return (
    <div className="section" style={{ background: "#050505", minHeight: "100vh" }}>
      {/* RECEIPT PRINTING AREA */}
      <div id="receipt-print" style={{ display: "none" }}>
        {receiptData && (
          <div style={{ width: "75mm", padding: "10px", color: "black", fontFamily: "monospace" }}>
            <center><h2>ADOX GAMING</h2><p>--- SESSION RECEIPT ---</p></center>
            <p><b>PLAYERS:</b> {receiptData.name}</p>
            <p><b>STATION:</b> {receiptData.machine}</p>
            <p><b>TIME:</b> {receiptData.duration} Hrs {receiptData.bonus > 0 && `(Incl. ${receiptData.bonus}m Bonus)`}</p>
            <p><b>METHOD:</b> {receiptData.method}</p>
            <h2 style={{ textAlign: "right" }}>Total: Rs. {receiptData.total}</h2>
          </div>
        )}
      </div>

      <div className="container">
        <div className="columns">
          <div className="column is-4">
            {/* LIVE STATUS */}
            <div className="box mb-4" style={{ background: "#1a1a1a", border: "1px solid #333" }}>
              <h3 className="subtitle is-6 has-text-white mb-2">Live Stations ({occupiedCount}/{TOTAL_CAPACITY})</h3>
              {activeSessions.map((s, i) => {
                const key = `${s.machine}-${s.startTime}`;
                const secsLeft = sessionCountdowns[key] ?? Math.round((s.endTime.getTime() - Date.now()) / 1000);
                const minsLeft = Math.floor(secsLeft / 60);
                const secs = secsLeft % 60;
                const isUrgent = secsLeft <= 300;
                return (
                  <div key={i} className="mb-2 p-2" style={{ background: "#222", borderLeft: isUrgent ? "4px solid #ff3860" : "4px solid #00d1b2" }}>
                    <p className="is-size-7 has-text-white"><b>{s.machine}</b>: {s.name}</p>
                    <p className={`is-size-7 ${isUrgent ? 'has-text-danger' : 'has-text-warning'}`}>
                      {minsLeft}:{String(secs).padStart(2, '0')} left
                    </p>
                  </div>
                );
              })}
            </div>

            {/* QR SCANNER */}
            <div className="box" style={{ background: "#000", padding: "10px" }}>
              <video ref={videoRef} style={{ width: "100%", borderRadius: "10px", border: "2px solid #333" }}></video>
              <p className="is-size-7 has-text-grey has-text-centered mt-2">Scan Player QR Code</p>
            </div>
          </div>

          <div className="column is-8">
            {/* SEARCH */}
            <div className="box mb-4" style={{ background: "#1a1a1a" }}>
              <form onSubmit={(e) => handlePhoneSearch(e, "primary")} className="field has-addons">
                <div className="control is-expanded">
                  <input className="input is-dark" placeholder="Search Player Phone..." value={searchPhone} onChange={(e) => setSearchPhone(e.target.value)} />
                </div>
                <div className="control"><button type="submit" className="button is-primary">Find Player</button></div>
              </form>
            </div>

            {/* CONFIGURATOR */}
            {userData && (
              <div className="box" style={{ background: "#111", border: "1px solid #00d1b2" }}>
                <div className="columns">
                  <div className="column"><h2 className="title is-5 has-text-white">Player: {userData.fullName}</h2></div>
                  <div className="column has-text-right">
                    <button className="delete" onClick={() => { setUserData(null); setFriendData(null); }}></button>
                  </div>
                </div>

                {/* Friend Search for Bonuses */}
                {!friendData && (
                  <form onSubmit={(e) => handlePhoneSearch(e, "friend")} className="field has-addons mt-2">
                    <div className="control is-expanded">
                      <input className="input is-small is-dark" placeholder="Add Friend' Phone" value={friendPhone} onChange={(e) => setFriendPhone(e.target.value)} />
                    </div>
                    <div className="control"><button type="submit" className="button is-small is-info">Add Friend</button></div>
                  </form>
                )}
                {friendData && <p className="is-size-7 has-text-info">Friend Added: {friendData.fullName}</p>}

                <div className="columns mt-4">
                  <div className="column">
                    <label className="label is-small has-text-grey">STATION</label>
                    {MACHINES.map(m => (
                      <button key={m} disabled={activeSessions.some(s => s.machine === m)} className={`button is-small is-fullwidth mb-2 ${selectedMachine === m ? "is-primary" : "is-dark"}`} onClick={() => setSelectedMachine(m)}>
                        {m}
                      </button>
                    ))}
                  </div>

                  <div className="column">
                    <label className="label is-small has-text-grey">TIME</label>
                    {[0.25, 0.5, 1, 2].map(h => (
                      <button key={h} className={`button is-small is-fullwidth mb-2 ${pendingTransaction?.hours === h ? "is-info" : "is-dark"}`}
                        onClick={() => setPendingTransaction({ hours: h, price: standardPricing?.[String(h)] })}>
                        {h === 0.25 ? "15m" : `${h}h`} - Rs.{standardPricing?.[String(h)] || "0"}
                      </button>
                    ))}

                    {((userData.rewardClaimed === false) || (friendData && friendData.rewardClaimed === false)) && (
                      <div className="notification is-success is-light p-2 mt-2 is-size-7">
                        🎁 Bonus Available: {((userData.bonusMinutes || 0) + (friendData?.bonusMinutes || 0))}m
                      </div>
                    )}
                  </div>
                </div>

                {pendingTransaction && (
                  <div className="notification mt-4 is-dark" style={{ border: "1px solid #00d1b2" }}>
                    <p className="title is-3 has-text-white">Rs. {pendingTransaction.price}</p>
                    <input className="input is-small is-dark mb-3" placeholder="Lap Time (Optional)" value={lapTime} onChange={(e) => setLapTime(e.target.value)} />
                    <div className="buttons">
                      <button disabled={!selectedMachine || isUpdating} className={`button is-success is-fullwidth ${isUpdating ? 'is-loading' : ''}`} onClick={() => confirmPayment("CASH")}>CASH</button>
                      <button disabled={!selectedMachine || isUpdating} className="button is-info is-fullwidth" onClick={() => confirmPayment("CARD")}>CARD</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── TRANSACTIONS HISTORY ── */}
        <div style={{ marginTop: "32px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", cursor: "pointer", marginBottom: "16px" }} onClick={() => setTxnPanelOpen(!txnPanelOpen)}>
            <h2 className="title is-5 has-text-white">💳 Transaction History</h2>
            <span style={{ color: "#666" }}>{txnPanelOpen ? "▲" : "▼"}</span>
          </div>

          {txnPanelOpen && (
            <div>
              <div className="buttons mb-4">
                {["today", "week", "month", "all"].map((f) => (
                  <button key={f} onClick={() => setTxnFilter(f)} className={`button is-small is-rounded ${txnFilter === f ? "is-primary" : "is-dark"}`}>{f}</button>
                ))}
              </div>

              <div style={{ background: "linear-gradient(135deg, #00d1b2 0%, #006b5a 100%)", borderRadius: "14px", padding: "18px 24px", marginBottom: "16px" }}>
                <p style={{ color: "white", fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase" }}>Total Revenue ({txnFilter})</p>
                <h2 style={{ color: "white", fontSize: "2rem", fontWeight: 800 }}>Rs. {totalRevenue.toLocaleString()}</h2>
              </div>

              <div className="box" style={{ background: "#1a1a1a", padding: "0", border: "1px solid #333", overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table className="table is-fullwidth is-dark" style={{ background: "transparent" }}>
                    <thead>
                      <tr>
                        <th>Date</th><th>Player</th><th>Station</th><th>Time</th><th>Method</th><th className="has-text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredData.map((t, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #222" }}>
                          <td className="is-size-7">{new Date(t.startTime).toLocaleDateString()}</td>
                          <td className="is-size-7 has-text-weight-bold">{t.players || t.userName}</td>
                          <td className="is-size-7">{t.machine}</td>
                          <td className="is-size-7">{t.duration}h</td>
                          <td className="is-size-7">{t.method}</td>
                          <td className="has-text-right has-text-weight-bold">Rs. {t.amountPaid}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <style>{`@media print { body * { visibility: hidden; } #receipt-print { display: block !important; visibility: visible; position: absolute; left: 0; top: 0; } #receipt-print * { visibility: visible; } }`}</style>
    </div>
  );
};

export default AdminPanel;