import React, { useState, useEffect, useRef } from "react";
import QrScanner from "qr-scanner";
import { auth, db } from "../../firebase"; // Ensure 'auth' is exported from your firebase.js
import { createUserWithEmailAndPassword } from "firebase/auth";
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
  addDoc,
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

  // --- QUICK REGISTER STATE ---
  const [regForm, setRegForm] = useState({
    name: "",
    phone: "",
    email: "",
    age: "",
  });
  const [isRegistering, setIsRegistering] = useState(false);

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

  // --- QUICK WALK-IN STATE ---
  const [quickMachine, setQuickMachine] = useState("");

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
            } catch (e) {
              console.error("Invalid QR Data");
            }
          }
        },
        { highlightScanRegion: true, highlightCodeOutline: true },
      );
      scannerRef.current
        .start()
        .catch((err) => console.error("Camera Start Error:", err));
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
      audioRef.current.play().catch(() => {});
      setUserData({ ...userDoc.data(), uid });
    }
  };

  // --- DATA LISTENERS ---
  useEffect(() => {
    onSnapshot(doc(db, "settings", "pricing"), (docSnap) => {
      if (docSnap.exists()) setStandardPricing(docSnap.data());
    });

    const unsubTxn = onSnapshot(collection(db, "users"), (snapshot) => {
      let allSessions = [];
      snapshot.forEach((d) => {
        const data = d.data();
        if (data.sessions && Array.isArray(data.sessions)) {
          data.sessions.forEach((s) =>
            allSessions.push({ ...s, userName: data.fullName, userId: d.id }),
          );
        }
      });
      const seen = new Set();
      const unique = allSessions.filter((s) => {
        const key = `${s.machine}_${s.startTime}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setTransactions(
        unique.sort((a, b) => new Date(b.startTime) - new Date(a.startTime)),
      );
    });

    const unsubLive = onSnapshot(collection(db, "users"), (snapshot) => {
      const now = new Date();
      const active = [];
      snapshot.forEach((userDoc) => {
        const data = userDoc.data();
        if (data.sessions) {
          data.sessions.forEach((s) => {
            const start = new Date(s.startTime);
            const durationHrs = parseFloat(s.duration) || 0;
            const end = new Date(start.getTime() + durationHrs * 3600000);
            if (now >= start && now < end) {
              if (
                !active.find(
                  (a) => a.machine === s.machine && a.startTime === s.startTime,
                )
              ) {
                active.push({
                  ...s,
                  name: s.players || data.fullName,
                  endTime: end,
                });
              }
            }
          });
        }
      });
      setActiveSessions(active.sort((a, b) => a.endTime - b.endTime));
      setOccupiedCount(active.length);
    });

    return () => {
      unsubTxn();
      unsubLive();
    };
  }, []);

  useEffect(() => {
    const now = new Date();
    const filtered = transactions.filter((t) => {
      const tDate = new Date(t.startTime);
      if (txnFilter === "today")
        return tDate.toDateString() === now.toDateString();
      if (txnFilter === "week") {
        const wAgo = new Date();
        wAgo.setDate(now.getDate() - 7);
        return tDate >= wAgo;
      }
      if (txnFilter === "month")
        return (
          tDate.getMonth() === now.getMonth() &&
          tDate.getFullYear() === now.getFullYear()
        );
      return true;
    });
    setFilteredData(filtered);
    setTotalRevenue(
      filtered.reduce((sum, t) => sum + (Number(t.amountPaid) || 0), 0),
    );
  }, [transactions, txnFilter]);

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
        if (type === "primary") {
          setUserData(data);
          setSearchPhone("");
        } else {
          setFriendData(data);
          setFriendPhone("");
        }
      } else {
        alert("User not found");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // --- QUICK REGISTER FUNCTION ---
  const handleQuickRegister = async (e) => {
    e.preventDefault();
    if (!regForm.name || !regForm.phone || !regForm.email)
      return alert("Fill required fields!");
    setIsRegistering(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        regForm.email,
        "adoxgg",
      );
      const uid = userCredential.user.uid;
      const newUserData = {
        fullName: regForm.name,
        phone: regForm.phone,
        email: regForm.email,
        age: regForm.age,
        sessions: [],
        bonusMinutes: 0,
        rewardClaimed: false,
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, "users", uid), newUserData);

      // AUTO-FILL FOR BILLING
      setUserData({ ...newUserData, uid });

      setRegForm({ name: "", phone: "", email: "", age: "" });
      alert("Account Created & Loaded for Billing!");
    } catch (error) {
      alert("Error creating account: " + error.message);
    } finally {
      setIsRegistering(false);
    }
  };

  // --- QUICK CASH FUNCTION ---
  const handleQuickSession = async (price) => {
    setIsUpdating(true);
    const sessionData = {
      startTime: new Date().toISOString(),
      duration: 0.25, // 15 mins
      amountPaid: price,
      method: "CASH",
      machine: "Quick Cash", // Hardcoded since station info is deleted
      players: "Guest Walk-in",
      isQuickSession: true,
    };

    try {
      const guestRef = doc(db, "users", "guest_walkin");
      await setDoc(
        guestRef,
        {
          sessions: arrayUnion(sessionData),
        },
        { merge: true },
      );

      setReceiptData({ ...sessionData, name: "Guest", total: price, bonus: 0 });
      setIsUpdating(false);

      // Slight delay to ensure receiptData is set before printing
      setTimeout(() => {
        window.print();
      }, 500);
    } catch (e) {
      console.error(e);
      alert("Error saving quick session");
      setIsUpdating(false);
    }
  };
  const confirmPayment = async (method) => {
    if (!userData || !pendingTransaction || !selectedMachine)
      return alert("Missing Info!");
    setIsUpdating(true);
    const userBonusMins =
      !userData.isGuest && userData.rewardClaimed === false
        ? userData.bonusMinutes || 0
        : 0;
    const friendBonusMins =
      friendData && friendData.rewardClaimed === false
        ? friendData.bonusMinutes || 0
        : 0;
    const finalDuration = pendingTransaction.hours + userBonusMins / 60;
    const finalAmount = Number(pendingTransaction.price);
    const playersNames = friendData
      ? `${userData.fullName} & ${friendData.fullName}`
      : userData.fullName;

    const sessionData = {
      startTime: new Date().toISOString(),
      duration: finalDuration,
      amountPaid: finalAmount,
      method,
      machine: selectedMachine,
      bestLap: lapTime || null,
      players: playersNames,
      bonusApplied: userBonusMins + friendBonusMins > 0,
      isSingleRace: pendingTransaction.isSingleRace || false,
    };

    try {
      const userRef = doc(
        db,
        userData.isGuest ? "guests" : "users",
        userData.uid,
      );
      if (userData.isGuest) {
        await setDoc(userRef, { ...userData, session: sessionData });
      } else {
        await updateDoc(userRef, {
          sessions: arrayUnion(sessionData),
          rewardClaimed: true,
        });
      }
      if (friendData) {
        const friendRef = doc(db, "users", friendData.uid);
        await updateDoc(friendRef, { rewardClaimed: true });
      }
      setReceiptData({
        ...sessionData,
        name: playersNames,
        total: finalAmount,
        bonus: userBonusMins + friendBonusMins,
      });
      setTimeout(() => {
        window.print();
        setUserData(null);
        setFriendData(null);
        setPendingTransaction(null);
        setSelectedMachine("");
        setIsUpdating(false);
        setLapTime("");
      }, 800);
    } catch (e) {
      alert("Save Error");
      setIsUpdating(false);
    }
  };

  if (!isAdmin)
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
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="button is-primary is-fullwidth">Login</button>
        </form>
      </div>
    );

  return (
    <div
      className="section"
      style={{
        background: "#050505",
        minHeight: "100vh",
        padding: "1.5rem 0.75rem",
      }}
    >
      {/* ADMIN NAVIGATION HEADER */}
<div className="tabs is-boxed mb-5">
  <ul style={{ borderBottomColor: '#333' }}>
    <li className="is-active">
      <a style={{ background: '#1a1a1a', color: '#00d1b2', borderColor: '#333' }}>
        <span className="icon is-small"><i className="fas fa-terminal"></i></span>
        <span>Console</span>
      </a>
    </li>
    <li>
      <a href="/admin/analytics" style={{ color: '#fff' }}>
        <span className="icon is-small"><i className="fas fa-chart-line"></i></span>
        <span>Analytics</span>
      </a>
    </li>
    <li>
      <a href="/users" style={{ color: '#fff' }}>
        <span className="icon is-small"><i className="fas fa-users"></i></span>
        <span>Player DB</span>
      </a>
    </li>
  </ul>
</div>
      {/* RECEIPT PRINTING AREA */}
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
              <h2>ADOX GAMING</h2>
              <p>--- SESSION RECEIPT ---</p>
            </center>
            <p>
              <b>PLAYERS:</b> {receiptData.name}
            </p>
            <p>
              <b>STATION:</b> {receiptData.machine}
            </p>
            <p>
              <b>TIME:</b>{" "}
              {receiptData.isSingleRace
                ? "Single Race"
                : `${receiptData.duration} Hrs`}{" "}
              {receiptData.bonus > 0 && `(Incl. ${receiptData.bonus}m Bonus)`}
            </p>
            <p>
              <b>METHOD:</b> {receiptData.method}
            </p>
            <h2 style={{ textAlign: "right" }}>
              Total: Rs. {receiptData.total}
            </h2>
          </div>
        )}
      </div>

      <div className="container is-fluid">
        <div className="columns is-multiline">
          {/* SIDEBAR: LIVE STATUS & QUICK WALK-IN */}
          <div className="column is-12-tablet is-4-desktop">
            <div style={{ position: "sticky", top: "1rem" }}>
              {/* QUICK REGISTER (NEW) */}
              <div
                className="box mb-4"
                style={{ background: "#1a1a1a", border: "1px solid #00d1b2" }}
              >
                <h3 className="subtitle is-6 has-text-primary mb-3">
                  🆕 Quick Register Player
                </h3>
                <form onSubmit={handleQuickRegister}>
                  <div className="field">
                    <input
                      className="input is-small is-dark mb-2"
                      placeholder="Name"
                      value={regForm.name}
                      onChange={(e) =>
                        setRegForm({ ...regForm, name: e.target.value })
                      }
                      required
                    />
                    <input
                      className="input is-small is-dark mb-2"
                      placeholder="Phone"
                      value={regForm.phone}
                      onChange={(e) =>
                        setRegForm({ ...regForm, phone: e.target.value })
                      }
                      required
                    />
                    <input
                      className="input is-small is-dark mb-2"
                      placeholder="Email"
                      type="email"
                      value={regForm.email}
                      onChange={(e) =>
                        setRegForm({ ...regForm, email: e.target.value })
                      }
                      required
                    />
                    <input
                      className="input is-small is-dark mb-3"
                      placeholder="Age"
                      type="number"
                      value={regForm.age}
                      onChange={(e) =>
                        setRegForm({ ...regForm, age: e.target.value })
                      }
                    />
                    <button
                      type="submit"
                      className={`button is-small is-primary is-fullwidth ${isRegistering ? "is-loading" : ""}`}
                    >
                      Create Account
                    </button>
                  </div>
                </form>
              </div>
              {/* QUICK WALK-IN */}
              <div
                className="box mb-4"
                style={{ background: "#1a1a1a", border: "1px solid #ffdd57" }}
              >
                <h3 className="subtitle is-6 has-text-warning mb-3">
                  ⚡ Quick Walk-In (15 mins)
                </h3>
                <div className="columns is-mobile">
                  <div className="column">
                    <button
                      disabled={isUpdating}
                      onClick={() => handleQuickSession(150)}
                      className={`button is-small is-warning is-light is-fullwidth ${isUpdating ? "is-loading" : ""}`}
                    >
                      Rs. 150
                    </button>
                  </div>
                  <div className="column">
                    <button
                      disabled={isUpdating}
                      onClick={() => handleQuickSession(300)}
                      className={`button is-small is-warning is-fullwidth ${isUpdating ? "is-loading" : ""}`}
                    >
                      Rs. 300
                    </button>
                  </div>
                </div>
                <p className="is-size-7 has-text-grey-light has-text-centered">
                  Instant Cash + Receipt
                </p>
              </div>
              {/* LIVE STATUS */}
              <div
                className="box mb-4"
                style={{ background: "#1a1a1a", border: "1px solid #333" }}
              >
                <h3 className="subtitle is-6 has-text-white mb-3">
                  Live Stations ({occupiedCount}/{TOTAL_CAPACITY})
                </h3>
                <div className="columns is-mobile is-multiline">
                  {activeSessions.map((s, i) => {
                    const key = `${s.machine}-${s.startTime}`;
                    const secsLeft =
                      sessionCountdowns[key] ??
                      Math.round((s.endTime.getTime() - Date.now()) / 1000);
                    const minsLeft = Math.floor(secsLeft / 60);
                    const secs = secsLeft % 60;
                    const isUrgent = secsLeft <= 300;
                    return (
                      <div key={i} className="column is-12-tablet is-12-mobile">
                        <div
                          className="p-2"
                          style={{
                            background: "#222",
                            borderLeft: isUrgent
                              ? "4px solid #ff3860"
                              : "4px solid #00d1b2",
                            borderRadius: "4px",
                          }}
                        >
                          <p className="is-size-7 has-text-white is-truncated">
                            <b>{s.machine}</b>: {s.name}
                          </p>
                          <p
                            className={`is-size-7 ${isUrgent ? "has-text-danger" : "has-text-warning"}`}
                          >
                            {minsLeft}:{String(secs).padStart(2, "0")} left
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* QR SCANNER */}
              <div
                className="box is-hidden-mobile"
                style={{
                  background: "#000",
                  padding: "10px",
                  border: "1px solid #333",
                }}
              >
                <video
                  ref={videoRef}
                  style={{
                    width: "100%",
                    borderRadius: "10px",
                    objectFit: "cover",
                  }}
                ></video>
                <p className="is-size-7 has-text-grey has-text-centered mt-2">
                  Scan Player QR Code
                </p>
              </div>
            </div>
          </div>

          {/* MAIN PANEL: SEARCH & CONFIGURATOR */}
          <div className="column is-12-tablet is-8-desktop">
            {/* SEARCH */}
            <div className="box mb-4" style={{ background: "#1a1a1a" }}>
              <form
                onSubmit={(e) => handlePhoneSearch(e, "primary")}
                className="field has-addons"
              >
                <div className="control is-expanded">
                  <input
                    className="input is-dark"
                    type="tel"
                    placeholder="Search Player Phone..."
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

            {/* CONFIGURATOR */}
            {userData && (
              <div
                className="box"
                style={{ background: "#111", border: "1px solid #00d1b2" }}
              >
                <div className="level is-mobile">
                  <div className="level-left">
                    <h2 className="title is-5 has-text-white">
                      Player: {userData.fullName}
                    </h2>
                  </div>
                  <div className="level-right">
                    <button
                      className="delete"
                      onClick={() => {
                        setUserData(null);
                        setFriendData(null);
                      }}
                    ></button>
                  </div>
                </div>

                {!friendData && (
                  <form
                    onSubmit={(e) => handlePhoneSearch(e, "friend")}
                    className="field has-addons mt-2"
                  >
                    <div className="control is-expanded">
                      <input
                        className="input is-small is-dark"
                        placeholder="Add Friend Phone"
                        value={friendPhone}
                        onChange={(e) => setFriendPhone(e.target.value)}
                      />
                    </div>
                    <div className="control">
                      <button type="submit" className="button is-small is-info">
                        Add
                      </button>
                    </div>
                  </form>
                )}
                {friendData && (
                  <p className="is-size-7 has-text-info mb-3">
                    Linked: {friendData.fullName}
                  </p>
                )}

                <div className="columns is-multiline mt-2">
                  <div className="column is-12-mobile is-6-tablet">
                    <label className="label is-small has-text-grey">
                      STATION
                    </label>
                    <div className="columns is-mobile is-multiline">
                      {MACHINES.map((m) => (
                        <div key={m} className="column is-6">
                          <button
                            disabled={activeSessions.some(
                              (s) => s.machine === m,
                            )}
                            className={`button is-small is-fullwidth ${selectedMachine === m ? "is-primary" : "is-dark"}`}
                            onClick={() => setSelectedMachine(m)}
                          >
                            {m}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="column is-12-mobile is-6-tablet">
  <label className="label is-small has-text-grey">TIME / RACE</label>
  <div className="columns is-mobile is-multiline">
    {/* Standard Pricing Buttons */}
    {[0.25, 0.5, 1, 2].map((h) => (
      <div key={h} className="column is-6">
        <button
          className={`button is-small is-fullwidth ${pendingTransaction?.hours === h && !pendingTransaction.isCustom ? "is-info" : "is-dark"}`}
          onClick={() =>
            setPendingTransaction({
              hours: h,
              price: standardPricing?.[String(h)],
              isSingleRace: false,
              isCustom: false
            })
          }
        >
          {h === 0.25 ? "15m" : `${h}h`} - {standardPricing?.[String(h)] || "0"}
        </button>
      </div>
    ))}

    {/* Custom Hourly Billing Button */}
    <div className="column is-12">
      <button
        className={`button is-small is-fullwidth is-dashed ${pendingTransaction?.isCustom ? "is-primary" : "is-dark"}`}
        style={{ border: "1px dashed #00d1b2" }}
        onClick={() => {
          const h = parseFloat(prompt("Enter total hours:", "5"));
          if (!h || isNaN(h)) return;

          // Calculation Logic: 1500 for first 2h, 750 per hour after
          let calculatedPrice = 0;
          if (h <= 2) {
            calculatedPrice = (1500 / 2) * h; // Pro-rated if under 2h
          } else {
            calculatedPrice = 1500 + (h - 2) * 750;
          }

          setPendingTransaction({
            hours: h,
            price: calculatedPrice,
            isSingleRace: false,
            isCustom: true
          });
        }}
      >
        ➕ Custom Duration (750/hr after 2h)
      </button>
    </div>

    {/* Single Race Button */}
    <div className="column is-12">
      <button
        className={`button is-small is-fullwidth ${pendingTransaction?.isSingleRace ? "is-warning" : "is-dark"}`}
        onClick={() =>
          setPendingTransaction({
            hours: 0.1,
            price: 150,
            isSingleRace: true,
            isCustom: false
          })
        }
      >
        🏎️ SINGLE RACE - Rs. 150
      </button>
    </div>
  </div>
</div>
                </div>

                {pendingTransaction && (
                  <div
                    className="notification mt-4 is-dark"
                    style={{
                      border: "1px solid #00d1b2",
                      background: "#161616",
                    }}
                  >
                    <div className="level is-mobile mb-3">
                      <div className="level-left">
                        <p className="title is-4 has-text-white">
                          Rs. {pendingTransaction.price}
                        </p>
                      </div>
                      <div className="level-right">
                        <span className="tag is-primary is-light">
                          {selectedMachine}
                        </span>
                      </div>
                    </div>
                    <input
                      className="input is-small is-dark mb-3"
                      placeholder="Lap Time (Optional)"
                      value={lapTime}
                      onChange={(e) => setLapTime(e.target.value)}
                    />
                    <div className="buttons">
                      <button
                        disabled={!selectedMachine || isUpdating}
                        className={`button is-success is-fullwidth ${isUpdating ? "is-loading" : ""}`}
                        onClick={() => confirmPayment("CASH")}
                      >
                        CASH
                      </button>
                      <button
                        disabled={!selectedMachine || isUpdating}
                        className="button is-info is-fullwidth"
                        onClick={() => confirmPayment("CARD")}
                      >
                        CARD
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── TRANSACTIONS HISTORY ── */}
            <div style={{ marginTop: "2rem" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  cursor: "pointer",
                  marginBottom: "1rem",
                }}
                onClick={() => setTxnPanelOpen(!txnPanelOpen)}
              >
                <h2 className="title is-5 has-text-white">
                  💳 Revenue History
                </h2>
                <span style={{ color: "#666" }}>
                  {txnPanelOpen ? "▲" : "▼"}
                </span>
              </div>

              {txnPanelOpen && (
                <>
                  <div className="buttons mb-4">
                    {["today", "week", "month", "all"].map((f) => (
                      <button
                        key={f}
                        onClick={() => setTxnFilter(f)}
                        className={`button is-small is-rounded ${txnFilter === f ? "is-primary" : "is-dark"}`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>

                  <div
                    style={{
                      background:
                        "linear-gradient(135deg, #00d1b2 0%, #006b5a 100%)",
                      borderRadius: "12px",
                      padding: "1.25rem",
                      marginBottom: "1rem",
                    }}
                  >
                    <p
                      style={{
                        color: "white",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "1px",
                      }}
                    >
                      Total Revenue ({txnFilter})
                    </p>
                    <h2
                      style={{
                        color: "white",
                        fontSize: "1.75rem",
                        fontWeight: 800,
                      }}
                    >
                      Rs. {totalRevenue.toLocaleString()}
                    </h2>
                  </div>

                  <div
                    className="box"
                    style={{
                      background: "#1a1a1a",
                      padding: "0",
                      border: "1px solid #333",
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ overflowX: "auto" }}>
                      <table
                        className="table is-fullwidth is-dark"
                        style={{ background: "transparent", minWidth: "500px" }}
                      >
                        <thead>
                          <tr>
                            <th>Player</th>
                            <th>Station</th>
                            <th>Time</th>
                            <th>Method</th>
                            <th className="has-text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredData.map((t, i) => (
                            <tr
                              key={i}
                              style={{ borderBottom: "1px solid #222" }}
                            >
                              <td className="is-size-7">
                                <span className="has-text-weight-bold">
                                  {t.players || t.userName}
                                </span>
                                <br />
                                <span
                                  className="has-text-grey"
                                  style={{ fontSize: "0.65rem" }}
                                >
                                  {new Date(t.startTime).toLocaleDateString()} |{" "}
                                  {new Date(t.startTime).toLocaleTimeString(
                                    [],
                                    { hour: "2-digit", minute: "2-digit" },
                                  )}
                                </span>
                              </td>
                              <td className="is-size-7">{t.machine}</td>
                              <td className="is-size-7">
                                {t.isSingleRace ? "Race" : `${t.duration}h`}
                              </td>
                              <td className="is-size-7">{t.method}</td>
                              <td className="has-text-right has-text-weight-bold">
                                Rs. {t.amountPaid}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <style>{`
        .is-truncated { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        @media print { body * { visibility: hidden; } #receipt-print { display: block !important; visibility: visible; position: absolute; left: 0; top: 0; } #receipt-print * { visibility: visible; } }
      `}</style>
    </div>
  );
};

export default AdminPanel;
