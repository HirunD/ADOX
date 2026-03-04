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
  const [peakPricing, setPeakPricing] = useState(null);
  const [selectedMachine, setSelectedMachine] = useState("");
  const [lapTime, setLapTime] = useState("");
  const [receiptData, setReceiptData] = useState(null);
  const [activeSessions, setActiveSessions] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [occupiedCount, setOccupiedCount] = useState(0);

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

      scannerRef.current.start().catch((err) => {
        console.error("Camera Start Error:", err);
      });
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

  const checkIsPeak = () => {
    if (standardPricing?.isPeak === true) return true;
    const now = new Date();
    const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
    return currentTotalMinutes >= 780 && currentTotalMinutes <= 930;
  };

  // --- DATA LISTENERS ---
  useEffect(() => {
    onSnapshot(doc(db, "settings", "pricing"), (docSnap) => { if (docSnap.exists()) setStandardPricing(docSnap.data()); });
    onSnapshot(doc(db, "settings", "peak"), (docSnap) => { if (docSnap.exists()) setPeakPricing(docSnap.data()); });

    const today = new Date().toISOString().split("T")[0];
    const qRes = query(collection(db, "reservations"), where("date", "==", today));
    onSnapshot(qRes, (snap) => {
      const resList = [];
      snap.forEach((d) => resList.push({ id: d.id, ...d.data() }));
      setReservations(resList.sort((a, b) => a.startTime.localeCompare(b.startTime)));
    });
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
            const end = new Date(start.getTime() + (durationHrs * 3600000));
            if (now >= start && now < end) {
              if (!active.find(a => a.machine === s.machine && a.startTime === s.startTime)) {
                active.push({ ...s, name: s.players || data.fullName, endTime: end, timeLeft: Math.round((end - now) / 60000) });
              }
            }
          });
        }
      });
      setActiveSessions(active.sort((a, b) => a.endTime - b.endTime));
      setOccupiedCount(active.length);
    });
    return () => unsubscribe();
  }, []);

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

  // --- UPDATED PAYMENT LOGIC (Accommodates 15/30m bonus) ---
  const confirmPayment = async (method) => {
    if (!userData || !pendingTransaction || !selectedMachine) return alert("Missing Info!");
    if (activeSessions.some(s => s.machine === selectedMachine)) return alert("Machine Occupied!");

    setIsUpdating(true);

    // Calculate Bonus Time
    const userBonusMins = (!userData.isGuest && userData.rewardClaimed === false) ? (userData.bonusMinutes || 0) : 0;
    const friendBonusMins = (friendData && friendData.rewardClaimed === false) ? (friendData.bonusMinutes || 0) : 0;
    const totalBonusHours = (userBonusMins) / 60;

    const finalDuration = pendingTransaction.hours + totalBonusHours;
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
      // Update Primary
      const userRef = doc(db, userData.isGuest ? "guests" : "users", userData.uid);
      if (userData.isGuest) await setDoc(userRef, { ...userData, session: sessionData });
      else await updateDoc(userRef, { sessions: arrayUnion(sessionData), rewardClaimed: true });

      // Update Friend
      if (friendData) {
        const friendRef = doc(db, "users", friendData.uid);
        await updateDoc(friendRef, { sessions: arrayUnion(sessionData), rewardClaimed: true });
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
      {/* RECEIPT DESIGN */}
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
            {/* LIVE STATUS BOX */}
            <div className="box mb-4" style={{ background: "#1a1a1a", border: "1px solid #333" }}>
              <h3 className="subtitle is-6 has-text-white mb-2">Live Stations ({occupiedCount}/{TOTAL_CAPACITY})</h3>
              {activeSessions.map((s, i) => (
                <div key={i} className="mb-2 p-2" style={{ background: "#222", borderLeft: s.timeLeft <= 5 ? "4px solid #ff3860" : "4px solid #00d1b2" }}>
                  <p className="is-size-7 has-text-white"><b>{s.machine}</b>: {s.name}</p>
                  <p className={`is-size-7 ${s.timeLeft <= 5 ? 'has-text-danger' : 'has-text-warning'}`}>{s.timeLeft}m left</p>
                </div>
              ))}
            </div>

            {/* SCANNER */}
            <div className="box" style={{ background: "#000", padding: "10px" }}>
              <video ref={videoRef} style={{ width: "100%", borderRadius: "10px", border: "2px solid #333" }}></video>
              <p className="is-size-7 has-text-grey has-text-centered mt-2">Scan Player QR Code</p>
            </div>
          </div>

          <div className="column is-8">
            {/* SEARCH BOX */}
            <div className="box mb-4" style={{ background: "#1a1a1a" }}>
              <form onSubmit={(e) => handlePhoneSearch(e, "primary")} className="field has-addons">
                <div className="control is-expanded"><input className="input is-dark" placeholder="Search Primary Player Phone..." value={searchPhone} onChange={(e) => setSearchPhone(e.target.value)} /></div>
                <div className="control"><button type="submit" className="button is-primary">Find Player</button></div>
              </form>
            </div>

            {/* SESSION CONFIGURATOR */}
            {userData && (
              <div className="box" style={{ background: "#111", border: "1px solid #00d1b2" }}>
                <div className="columns">
                  <div className="column">
                    <h2 className="title is-5 has-text-white mb-1">Player: {userData.fullName}</h2>
                    <div className="field has-addons mt-4">
                      <div className="control is-expanded"><input className="input is-small is-dark" placeholder="Add Friend Phone..." value={friendPhone} onChange={(e) => setFriendPhone(e.target.value)} /></div>
                      <div className="control"><button className="button is-small is-info" onClick={() => handlePhoneSearch(null, "friend")}>Add Friend</button></div>
                    </div>
                    {friendData && (
                      <div className="tag is-info is-light mt-2" style={{ width: "100%", justifyContent: "space-between" }}>
                        <span>Friend: {friendData.fullName}</span>
                        <button className="delete is-small" onClick={() => setFriendData(null)}></button>
                      </div>
                    )}
                  </div>
                  <div className="column has-text-right"><button className="delete" onClick={() => { setUserData(null); setFriendData(null); }}></button></div>
                </div>

                <div className="columns mt-4">
                  <div className="column">
                    <label className="label is-small has-text-grey">SELECT STATION</label>
                    {MACHINES.map(m => (
                      <button key={m} disabled={activeSessions.some(s => s.machine === m)} className={`button is-small is-fullwidth mb-2 ${selectedMachine === m ? "is-primary" : "is-dark"}`} onClick={() => setSelectedMachine(m)}>
                        {m}
                      </button>
                    ))}
                  </div>

                  <div className="column">
                    <label className="label is-small has-text-grey">SESSION TIME</label>
                    {[0.5, 1, 2].map(h => (
                      <button key={h} className={`button is-small is-fullwidth mb-2 ${pendingTransaction?.hours === h ? "is-info" : "is-dark"}`} onClick={() => setPendingTransaction({ hours: h, price: (checkIsPeak() ? peakPricing : standardPricing)[String(h)] })}>
                        {h}h - Rs.{(checkIsPeak() ? peakPricing : standardPricing)[String(h)]}
                      </button>
                    ))}

                    {/* REWARD DETECTOR */}
                    {((userData.rewardClaimed === false) || (friendData && friendData.rewardClaimed === false)) && (
                      <div className="notification is-success is-light p-2 mt-2 is-size-7">
                        🎁 <b>BONUS DETECTED:</b> {((userData.bonusMinutes || 0) + (friendData?.bonusMinutes || 0))}m free time will be added.
                      </div>
                    )}
                  </div>
                </div>

                {pendingTransaction && (
                  <div className="notification mt-4 is-dark" style={{ border: "1px solid #00d1b2" }}>
                    <p className="title is-3 has-text-white">Rs. {pendingTransaction.price}</p>
                    <input className="input is-small is-dark mb-3" placeholder="Record Lap Time (Optional)" value={lapTime} onChange={(e) => setLapTime(e.target.value)} />
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
      </div>
      <style>{`@media print { body * { visibility: hidden; } #receipt-print { display: block !important; visibility: visible; position: absolute; left: 0; top: 0; } #receipt-print * { visibility: visible; } }`}</style>
    </div>
  );
};

export default AdminPanel;