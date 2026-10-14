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
} from "firebase/firestore";
import {
  MACHINE_NAMES,
  TOTAL_STATIONS,
  getStationRate,
  getStationPrice,
  getStationCapacity,
} from "../../config/stations";
import useRates from "../../hooks/useRates";
import { DEFAULT_PASSWORD } from "../../config/defaultPassword";
import { authEmailFor, isPhone, normalizePhone } from "../../utils/authEmail";
import useNavigatorSales from "../../hooks/useNavigatorSales";
import { PERIOD_LABELS, getPeriodRange, isInRange } from "../../config/periods";
import "./index.css";

const AdminPanel = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const rates = useRates();
  const navigatorSales = useNavigatorSales();
  const QUICK_CASH_PRICES = [rates.quickCash1, rates.quickCash2];
  const [password, setPassword] = useState("");
  const [userData, setUserData] = useState(null);
  const [friendData, setFriendData] = useState(null);
  const [friendPhone, setFriendPhone] = useState("");
  const [partySize, setPartySize] = useState(1);
  const [isUpdating, setIsUpdating] = useState(false);
  const [pendingTransaction, setPendingTransaction] = useState(null);

  const [globalDiscount, setGlobalDiscount] = useState({ bool: false, percentage: 0 });
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

  const MACHINES = MACHINE_NAMES;
  const TOTAL_CAPACITY = TOTAL_STATIONS;
  const [searchPhone, setSearchPhone] = useState("");

  const videoRef = useRef(null);
  const scannerRef = useRef(null);
  const audioRef = useRef(new Audio("/success.mp3"));
  const lastScanRef = useRef({ uid: null, at: 0 });

  // "starting" | "on" | "error"
  const [cameraState, setCameraState] = useState("starting");
  const [cameraError, setCameraError] = useState("");
  const [cameraAttempt, setCameraAttempt] = useState(0);
  const [scanNote, setScanNote] = useState("");

  // --- CAMERA INITIALIZATION ---
  // The camera used to fail silently: start() rejections were only logged,
  // and React StrictMode's mount → unmount → mount would destroy the first
  // scanner while the second grabbed the camera, which some devices reject
  // as "in use". Now each start is retried a few times, failures are shown
  // on screen with a Retry button, and a dropped stream is detected.
  useEffect(() => {
    if (!isAdmin || !videoRef.current) return;

    let cancelled = false;
    let retryTimer = null;
    let endedTrack = null;
    const onTrackEnded = () => {
      if (cancelled) return;
      setCameraError("Camera disconnected.");
      setCameraState("error");
    };

    const scanner = new QrScanner(
      videoRef.current,
      (result) => {
        let uid;
        try {
          uid = JSON.parse(result.data).uid;
        } catch {
          return; // not one of our player QR codes
        }
        if (!uid) return;
        // The callback fires on every frame the code is visible — only
        // handle the same player once every few seconds.
        const now = Date.now();
        if (lastScanRef.current.uid === uid && now - lastScanRef.current.at < 4000) return;
        lastScanRef.current = { uid, at: now };
        handleQrScan(uid);
      },
      {
        preferredCamera: "environment",
        maxScansPerSecond: 5,
        highlightScanRegion: true,
        highlightCodeOutline: true,
        returnDetailedScanResult: true,
      },
    );
    scannerRef.current = scanner;
    setCameraState("starting");
    setCameraError("");

    const start = async (retriesLeft) => {
      if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setCameraError("Camera needs HTTPS (or localhost) to work.");
        setCameraState("error");
        return;
      }
      try {
        await scanner.start();
        if (cancelled) return;
        endedTrack = videoRef.current?.srcObject?.getVideoTracks?.()[0] || null;
        endedTrack?.addEventListener("ended", onTrackEnded);
        setCameraState("on");
      } catch (err) {
        if (cancelled) return;
        const name = err?.name || "";
        // Permission / missing-device errors won't fix themselves by retrying.
        const permanent = name === "NotAllowedError" || name === "SecurityError" || name === "NotFoundError" || String(err).includes("not found");
        if (!permanent && retriesLeft > 0) {
          retryTimer = setTimeout(() => start(retriesLeft - 1), 1200);
          return;
        }
        console.error("Camera Start Error:", err);
        setCameraError(
          name === "NotAllowedError" || name === "SecurityError"
            ? "Camera permission is blocked. Allow it in the browser's site settings, then Retry."
            : name === "NotFoundError" || String(err).includes("not found")
              ? "No camera found on this device."
              : name === "NotReadableError"
                ? "Camera is busy (another tab or app may be using it)."
                : "Couldn't start the camera.",
        );
        setCameraState("error");
      }
    };
    start(3);

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      endedTrack?.removeEventListener("ended", onTrackEnded);
      scanner.destroy();
      if (scannerRef.current === scanner) scannerRef.current = null;
    };
  }, [isAdmin, cameraAttempt]);

  const handleQrScan = async (uid) => {
    try {
      const userDoc = await getDoc(doc(db, "users", uid));
      if (userDoc.exists()) {
        audioRef.current.play().catch(() => { });
        setUserData({ ...userDoc.data(), uid });
        setScanNote("");
      } else {
        setScanNote("QR scanned, but no matching player was found.");
      }
    } catch (err) {
      console.error(err);
      setScanNote("Scan failed — check the connection.");
    }
  };

  // --- DATA LISTENERS ---
  useEffect(() => {
    // BACKEND GLOBAL DISCOUNT CONFIGURATION LISTENER
    const unsubDiscount = onSnapshot(doc(db, "settings", "discount"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setGlobalDiscount({
          bool: data.bool || false,
          percentage: Number(data.percentage) || 0
        });
      }
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
      unsubDiscount();
      unsubTxn();
      unsubLive();
    };
  }, []);

  useEffect(() => {
    const range = getPeriodRange(txnFilter);

    // 1. Filter Sessions (Usage Revenue) + Navigator event-stall sales
    const filteredSessions = [...transactions, ...navigatorSales].filter((t) =>
      isInRange(t.startTime, range),
    );

    // 2. Fetch & Filter Membership Invoices
    const syncInvoices = async () => {
      const invRef = collection(db, "invoices");
      const q = query(invRef);
      const snap = await getDocs(q);

      const now = new Date();
      let invTotal = 0;
      let periodInvoices = [];

      snap.forEach(doc => {
        const data = doc.data();
        const iDate = data.timestamp?.toDate() || new Date(data.timestamp);

        if (isInRange(iDate, range)) {
          const isMembershipExpired = data.membershipExpiry ? new Date(data.membershipExpiry) < now : false;

          invTotal += (Number(data.amountPaid) || 0);
          periodInvoices.push({
            ...data,
            isInvoice: true,
            startTime: iDate.toISOString(), 
            players: data.userName,
            machine: "Membership",
            isMember: !isMembershipExpired && data.isMember 
          });
        }
      });

      // 3. Combine both for display and total
      const sessionRev = filteredSessions.reduce((sum, t) => sum + (Number(t.amountPaid) || 0), 0);
      setTotalRevenue(sessionRev + invTotal);

      const combined = [...filteredSessions, ...periodInvoices].sort(
        (a, b) => new Date(b.startTime) - new Date(a.startTime)
      );
      setFilteredData(combined);
    };

    syncInvoices();
  }, [transactions, navigatorSales, txnFilter]);

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

  // Changing party size can push it past the selected station's slot
  // capacity (e.g. Simulator only has 1 slot) — drop the now-invalid pick.
  useEffect(() => {
    if (selectedMachine && partySize > getStationCapacity(selectedMachine)) {
      setSelectedMachine("");
    }
  }, [partySize, selectedMachine]);

  // The solo/double rate is baked into whatever price was already picked —
  // toggling party size invalidates that price, so force a fresh pick.
  useEffect(() => {
    setPendingTransaction(null);
  }, [partySize]);

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
          setPartySize(2);
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
    if (!regForm.name || !regForm.phone)
      return alert("Fill required fields!");
    if (!isPhone(regForm.phone))
      return alert("Phone must be 10 digits (e.g. 0771234567).");
    setIsRegistering(true);
    try {
      // No email given -> the account uses <phone>@adoxgaming.com
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        authEmailFor(regForm),
        DEFAULT_PASSWORD,
      );
      const uid = userCredential.user.uid;
      const newUserData = {
        fullName: regForm.name,
        phone: normalizePhone(regForm.phone),
        email: regForm.email.trim() || null,
        age: regForm.age,
        sessions: [],
        bonusMinutes: 0,
        rewardClaimed: false,
        mustChangePassword: true,
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, "users", uid), newUserData);

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
      machine: "Quick Cash", 
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

    if (partySize > getStationCapacity(selectedMachine)) {
      return alert(`${selectedMachine} only allows ${getStationCapacity(selectedMachine)} ${getStationCapacity(selectedMachine) === 1 ? "person" : "people"}.`);
    }

    setIsUpdating(true);

    const userBonusMins =
      !userData.isGuest && userData.rewardClaimed === false
        ? userData.bonusMinutes || 0
        : 0;
    const friendBonusMins =
      friendData && friendData.rewardClaimed === false
        ? friendData.bonusMinutes || 0
        : 0;

    const finalDuration = pendingTransaction.hours + (userBonusMins + friendBonusMins) / 60;
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
      numberOfPeople: partySize,
      bonusApplied: userBonusMins + friendBonusMins > 0,
      isSingleRace: pendingTransaction.isSingleRace || false,
      isMemberSession: userData.isMember || false, 
      originalPrice: pendingTransaction.originalPrice || finalAmount 
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
        setPartySize(1);
        setPendingTransaction(null);
        setSelectedMachine("");
        setIsUpdating(false);
        setLapTime("");
      }, 800);
    } catch {
      alert("Save Error");
      setIsUpdating(false);
    }
  };

  const FEE = 1000;
  const VALID_DAYS = 30;
  const MEMBER_DISCOUNT = 0.50; 

  if (!isAdmin)
    return (
      <div className="ap-login">
        <form
          className="ap-login-card"
          onSubmit={(e) => {
            e.preventDefault();
            if (password === import.meta.env.VITE_ADMIN_PASSWORD)
              setIsAdmin(true);
            else alert("Incorrect password");
          }}
        >
          <div className="ap-login-icon">
            <i className="fas fa-terminal"></i>
          </div>
          <h1>Admin Login</h1>
          <p>Front desk console</p>
          <input
            className="input"
            type="password"
            placeholder="Password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button className="button is-primary is-fullwidth has-text-weight-bold">Login</button>
        </form>
      </div>
    );

  const promoRate =
    globalDiscount.bool && globalDiscount.percentage > 0
      ? globalDiscount.percentage > 1 ? globalDiscount.percentage / 100 : globalDiscount.percentage
      : 0;

  const formatLeft = (secsLeft) => {
    const s = Math.max(0, secsLeft);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = String(s % 60).padStart(2, "0");
    return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
  };

  return (
    <div className="ap-page">
      {/* RECEIPT PRINTING AREA */}
      <div id="receipt-print">
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

      <div className="ap-wrap">
        {/* ADMIN NAVIGATION HEADER */}
        <header className="ap-header">
          <nav className="ap-nav">
            <a className="is-active">
              <i className="fas fa-terminal"></i>
              <span>Console</span>
            </a>
            <a href="/admin/analytics">
              <i className="fas fa-chart-line"></i>
              <span>Analytics</span>
            </a>
            <a href="/members">
              <i className="fas fa-id-card"></i>
              <span>Members Sign up</span>
            </a>
            <a href="/users">
              <i className="fas fa-users"></i>
              <span>Player DB</span>
            </a>
          </nav>
          <div className="ap-sub">
            <span className="ap-chip is-accent">
              <span className="ap-dot is-live"></span>
              {occupiedCount}/{TOTAL_CAPACITY} stations in use
            </span>
            {promoRate > 0 && (
              <span className="ap-chip is-danger">
                <i className="fas fa-tag"></i>
                {Math.round(promoRate * 100)}% promo active
              </span>
            )}
          </div>
        </header>

        <div className="ap-grid">
          {/* SIDEBAR: LIVE STATUS & QUICK WALK-IN */}
          <aside className="ap-side">
            {/* QUICK REGISTER */}
            <div className="ap-card is-accent">
              <div className="ap-card-head">
                <h3 className="ap-card-title">
                  <i className="fas fa-user-plus" style={{ color: "var(--ap-accent)" }}></i>
                  Quick Register Player
                </h3>
              </div>
              <form onSubmit={handleQuickRegister}>
                <div className="ap-form-grid">
                  <input
                    className="input is-small ap-input is-full"
                    placeholder="Name"
                    value={regForm.name}
                    onChange={(e) =>
                      setRegForm({ ...regForm, name: e.target.value })
                    }
                    required
                  />
                  <input
                    className="input is-small ap-input"
                    placeholder="Phone"
                    type="tel"
                    value={regForm.phone}
                    onChange={(e) =>
                      setRegForm({ ...regForm, phone: e.target.value })
                    }
                    required
                  />
                  <input
                    className="input is-small ap-input"
                    placeholder="Age"
                    type="number"
                    value={regForm.age}
                    onChange={(e) =>
                      setRegForm({ ...regForm, age: e.target.value })
                    }
                  />
                  <input
                    className="input is-small ap-input is-full"
                    placeholder="Email (optional)"
                    type="email"
                    value={regForm.email}
                    onChange={(e) =>
                      setRegForm({ ...regForm, email: e.target.value })
                    }
                  />
                  <button
                    type="submit"
                    className={`button is-small is-primary is-fullwidth is-full has-text-weight-bold ${isRegistering ? "is-loading" : ""}`}
                  >
                    Create Account
                  </button>
                </div>
              </form>
            </div>

            {/* QUICK WALK-IN */}
            <div className="ap-card" style={{ borderColor: "rgba(255, 221, 87, 0.4)" }}>
              <div className="ap-card-head">
                <h3 className="ap-card-title">
                  <i className="fas fa-bolt" style={{ color: "var(--ap-warn)" }}></i>
                  Quick Walk-In (15 mins)
                </h3>
                <span className="ap-hint">Instant Cash + Receipt</span>
              </div>
              <div className="ap-quick">
                {QUICK_CASH_PRICES.map((price, i) => (
                  <button
                    key={i}
                    disabled={isUpdating}
                    onClick={() => handleQuickSession(price)}
                    className={`button is-warning ${i === 0 ? "is-light" : ""} ${isUpdating ? "is-loading" : ""}`}
                  >
                    Rs. {price}
                  </button>
                ))}
              </div>
            </div>

            {/* LIVE STATUS */}
            <div className="ap-card">
              <div className="ap-card-head">
                <h3 className="ap-card-title">
                  <i className="fas fa-gamepad"></i>
                  Live Stations
                </h3>
                <span className={`ap-chip ${occupiedCount > 0 ? "is-accent" : ""}`}>
                  {occupiedCount}/{TOTAL_CAPACITY}
                </span>
              </div>
              {activeSessions.length === 0 ? (
                <div className="ap-empty">All stations are free</div>
              ) : (
                <div className="ap-live-list">
                  {activeSessions.map((s, i) => {
                    const key = `${s.machine}-${s.startTime}`;
                    const secsLeft =
                      sessionCountdowns[key] ??
                      Math.round((s.endTime.getTime() - Date.now()) / 1000);
                    const totalSecs = (parseFloat(s.duration) || 0) * 3600;
                    const pct = totalSecs > 0 ? Math.min(100, Math.max(0, (secsLeft / totalSecs) * 100)) : 0;
                    const isUrgent = secsLeft <= 300;
                    return (
                      <div key={i} className={`ap-live ${isUrgent ? "is-urgent" : ""}`}>
                        <div className="ap-live-top">
                          <p className="ap-live-name">
                            <b>{s.machine}</b> <span>· {s.name}</span>
                          </p>
                          <span className="ap-live-time">{formatLeft(secsLeft)}</span>
                        </div>
                        <div className="ap-bar">
                          <div style={{ width: `${pct}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* QR SCANNER */}
            <div className="ap-card">
              <div className="ap-card-head">
                <h3 className="ap-card-title">
                  <i className="fas fa-qrcode"></i>
                  Scan Player QR Code
                </h3>
                {cameraState === "on" && (
                  <span className="ap-chip is-accent">
                    <span className="ap-dot is-live"></span>Live
                  </span>
                )}
              </div>
              <div className="qr-frame">
                <video ref={videoRef} muted playsInline></video>
                {cameraState !== "on" && (
                  <div className="qr-overlay">
                    {cameraState === "starting" ? (
                      <p className="is-size-7 has-text-grey-light">
                        <i className="fas fa-circle-notch fa-spin mr-2"></i>Starting camera…
                      </p>
                    ) : (
                      <>
                        <p className="is-size-7 has-text-danger mb-2">{cameraError}</p>
                        <button
                          className="button is-small is-primary"
                          onClick={() => setCameraAttempt((n) => n + 1)}
                        >
                          Retry Camera
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
              {scanNote && (
                <p className="is-size-7 has-text-warning has-text-centered mt-2">{scanNote}</p>
              )}
            </div>
          </aside>

          {/* MAIN PANEL: SEARCH & CONFIGURATOR */}
          <main className="ap-main">
            {/* SEARCH */}
            <div className="ap-card">
              <form
                onSubmit={(e) => handlePhoneSearch(e, "primary")}
                className="ap-inline-form"
              >
                <input
                  className="input ap-input"
                  type="tel"
                  placeholder="Search Player Phone..."
                  value={searchPhone}
                  onChange={(e) => setSearchPhone(e.target.value)}
                />
                <button type="submit" className="button is-primary has-text-weight-bold">
                  <span className="icon is-small"><i className="fas fa-magnifying-glass"></i></span>
                  <span>Find</span>
                </button>
              </form>
            </div>

            {/* CONFIGURATOR */}
            {userData && (() => {
              const isMembershipActive = userData?.isMember && userData?.membershipExpiry && new Date(userData.membershipExpiry) > new Date();

              // RESOLVE CURRENT DYNAMIC DISCOUNT SCHEME
              let activeDiscountMultiplier = 1;
              let discountLabel = "";

              if (isMembershipActive) {
                activeDiscountMultiplier = 0.50; // 50% member rate
                discountLabel = "50% MEMBER OFF";
              } else if (promoRate > 0) {
                activeDiscountMultiplier = 1 - promoRate;
                discountLabel = `${Math.round(promoRate * 100)}% PROMO OFF`;
              }

              const hasDiscountApplied = activeDiscountMultiplier < 1;
              const bonusMins =
                (!userData.isGuest && userData.rewardClaimed === false ? userData.bonusMinutes || 0 : 0) +
                (friendData && friendData.rewardClaimed === false ? friendData.bonusMinutes || 0 : 0);

              return (
                <div className="ap-card is-accent">
                  <div className="ap-player">
                    <div className="ap-avatar">
                      {(userData.fullName || "?").trim().charAt(0).toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <h2 className="ap-player-name">Player: {userData.fullName}</h2>
                      <div className="ap-player-meta">
                        {userData.membershipExpiry && (
                          <span className={`ap-chip ${isMembershipActive ? "is-warn" : "is-danger"}`}>
                            {isMembershipActive ? "👑 Active Member Until: " : "❌ Membership Expired: "}
                            {new Date(userData.membershipExpiry).toLocaleDateString()}
                          </span>
                        )}
                        {userData.phone && <span className="ap-chip">{userData.phone}</span>}
                        {bonusMins > 0 && (
                          <span className="ap-chip is-accent">+{bonusMins}m bonus</span>
                        )}
                      </div>
                    </div>
                    <button
                      className="ap-close"
                      aria-label="Close player"
                      onClick={() => {
                        setUserData(null);
                        setFriendData(null);
                        setPartySize(1);
                      }}
                    >
                      <i className="fas fa-xmark"></i>
                    </button>
                  </div>

                  {!friendData && (
                    <form
                      onSubmit={(e) => handlePhoneSearch(e, "friend")}
                      className="ap-inline-form mt-4"
                    >
                      <input
                        className="input is-small ap-input"
                        placeholder="Add Friend Phone"
                        value={friendPhone}
                        onChange={(e) => setFriendPhone(e.target.value)}
                      />
                      <button type="submit" className="button is-small is-info">
                        <span className="icon is-small"><i className="fas fa-user-group"></i></span>
                        <span>Add</span>
                      </button>
                    </form>
                  )}
                  {friendData && (
                    <p className="mt-3">
                      <span className="ap-chip is-info">
                        <i className="fas fa-user-group"></i>
                        Linked: {friendData.fullName}
                      </span>
                    </p>
                  )}

                  <div className="columns is-multiline mt-2">
                    <div className="column is-12-mobile is-6-tablet">
                      <div className="ap-step">
                        <div className="ap-step-label">Station</div>
                        <div className="ap-tiles is-2">
                          {MACHINES.map((m) => {
                            const capacity = getStationCapacity(m);
                            const isOccupied = activeSessions.some((s) => s.machine === m);
                            const tooFewSlots = partySize > capacity;
                            return (
                              <button
                                key={m}
                                disabled={isOccupied || tooFewSlots}
                                title={tooFewSlots ? `${m} only allows ${capacity} ${capacity === 1 ? "person" : "people"}` : ""}
                                className={`ap-tile ${selectedMachine === m ? "is-selected" : ""} ${isOccupied ? "is-busy" : ""}`}
                                onClick={() => setSelectedMachine(m)}
                              >
                                <span className="ap-tile-main">{m}</span>
                                <span className="ap-tile-sub">
                                  {isOccupied ? "In use" : `${capacity} slot${capacity > 1 ? "s" : ""}`}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="ap-step">
                        <div className="ap-step-label">Party Size</div>
                        <div className="ap-tiles is-2">
                          <button
                            className={`ap-tile ${partySize === 1 ? "is-selected" : ""}`}
                            onClick={() => setPartySize(1)}
                          >
                            <span className="ap-tile-main">SOLO</span>
                            <span className="ap-tile-sub">Rs. {getStationRate(1, rates)}/hr</span>
                          </button>
                          <button
                            disabled={!selectedMachine ? false : getStationCapacity(selectedMachine) < 2}
                            title={selectedMachine && getStationCapacity(selectedMachine) < 2 ? `${selectedMachine} only allows 1 person` : ""}
                            className={`ap-tile ${partySize === 2 ? "is-selected" : ""}`}
                            onClick={() => setPartySize(2)}
                          >
                            <span className="ap-tile-main">DOUBLE</span>
                            <span className="ap-tile-sub">Rs. {getStationRate(2, rates)}/hr</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="column is-12-mobile is-6-tablet">
                      <div className="ap-step">
                        <div className="ap-step-label">
                          Time / Race
                          {hasDiscountApplied && <span className="ap-chip is-danger">{discountLabel}</span>}
                        </div>
                        {!selectedMachine ? (
                          <div className="ap-empty">Pick a station first.</div>
                        ) : (
                          <div className="ap-tiles is-2">
                            {/* Standard Pricing Buttons (30m is a flat tier, 1h/2h scale off the hourly rate) */}
                            {[0.5, 1, 2].map((h) => {
                              const basePrice = getStationPrice(partySize, h, rates);
                              const discountedPrice = Math.round(basePrice * activeDiscountMultiplier);

                              return (
                                <button
                                  key={h}
                                  className={`ap-tile ${pendingTransaction?.hours === h && !pendingTransaction.isCustom && !pendingTransaction.isSingleRace ? "is-selected" : ""}`}
                                  onClick={() =>
                                    setPendingTransaction({
                                      hours: h,
                                      price: discountedPrice,
                                      isSingleRace: false,
                                      isCustom: false,
                                      originalPrice: basePrice
                                    })
                                  }
                                >
                                  <span className="ap-tile-sub">{h === 0.5 ? "30m" : `${h}h`}</span>
                                  <span className="ap-tile-price">
                                    Rs. {discountedPrice}
                                    {hasDiscountApplied && <s>{basePrice}</s>}
                                  </span>
                                </button>
                              );
                            })}

                            {/* Custom Hourly Billing Button */}
                            <button
                              className={`ap-tile is-dashed ${pendingTransaction?.isCustom ? "is-selected" : ""}`}
                              onClick={() => {
                                const h = parseFloat(prompt("Enter total hours:", "5"));
                                if (!h || isNaN(h)) return;

                                const basePrice = getStationRate(partySize, rates) * h;
                                const finalPrice = Math.round(basePrice * activeDiscountMultiplier);

                                setPendingTransaction({
                                  hours: h,
                                  price: finalPrice,
                                  isSingleRace: false,
                                  isCustom: true,
                                  originalPrice: basePrice
                                });
                              }}
                            >
                              <span className="ap-tile-sub">➕ Custom Duration</span>
                              <span className="ap-tile-price" style={{ fontSize: "0.8rem" }}>
                                {pendingTransaction?.isCustom
                                  ? `${pendingTransaction.hours}h - Rs. ${pendingTransaction.price}`
                                  : `Rs.${getStationRate(partySize, rates)}/hr`}
                              </span>
                            </button>

                            {/* Single Race Button */}
                            <button
                              className={`ap-tile is-warn ${pendingTransaction?.isSingleRace ? "is-selected" : ""}`}
                              style={{ gridColumn: "1 / -1" }}
                              onClick={() => {
                                const basePrice = rates.singleRace;
                                const finalPrice = Math.round(basePrice * activeDiscountMultiplier);
                                setPendingTransaction({
                                  hours: 0.1,
                                  price: finalPrice,
                                  isSingleRace: true,
                                  isCustom: false,
                                  originalPrice: basePrice
                                });
                              }}
                            >
                              <span className="ap-tile-sub">🏎️ SINGLE RACE</span>
                              <span className="ap-tile-price">
                                Rs. {Math.round(rates.singleRace * activeDiscountMultiplier)}
                                {hasDiscountApplied && <s>{rates.singleRace}</s>}
                              </span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {pendingTransaction && (
                    <div className={`ap-summary ${hasDiscountApplied ? "is-discount" : ""}`}>
                      <div className="ap-summary-top">
                        <div>
                          <p className="ap-total-label">
                            Total Amount {hasDiscountApplied && `(${discountLabel})`}
                          </p>
                          <p className="ap-total">Rs. {pendingTransaction.price}</p>
                          {hasDiscountApplied && (
                            <p className="ap-total-was">
                              <s>Rs. {pendingTransaction.originalPrice}</s> ({discountLabel} Applied)
                            </p>
                          )}
                        </div>
                        <div className="ap-summary-meta">
                          <span className="ap-chip is-accent">{selectedMachine}</span>
                          <span className="ap-chip">
                            {pendingTransaction.isSingleRace
                              ? "Single race"
                              : pendingTransaction.hours === 0.5 ? "30m" : `${pendingTransaction.hours}h`}
                          </span>
                          <span className="ap-chip">{partySize === 2 ? "Double" : "Solo"}</span>
                        </div>
                      </div>

                      <label className="ap-step-label" style={{ marginBottom: "0.35rem" }}>
                        Lap Time / Notes (optional)
                      </label>
                      <input
                        className="input is-small ap-input"
                        placeholder="e.g. 1:24.432"
                        value={lapTime}
                        onChange={(e) => setLapTime(e.target.value)}
                      />

                      <div className="ap-pay">
                        <button
                          disabled={!selectedMachine || isUpdating}
                          className={`button is-success ${isUpdating ? "is-loading" : ""}`}
                          onClick={() => confirmPayment("CASH")}
                        >
                          <span className="icon is-small"><i className="fas fa-money-bill-wave"></i></span>
                          <span>CASH</span>
                        </button>
                        <button
                          disabled={!selectedMachine || isUpdating}
                          className={`button is-info ${isUpdating ? "is-loading" : ""}`}
                          onClick={() => confirmPayment("CARD")}
                        >
                          <span className="icon is-small"><i className="fas fa-credit-card"></i></span>
                          <span>CARD</span>
                        </button>
                      </div>

                      {isMembershipActive && (
                        <p className="ap-hint has-text-centered mt-3">
                          Member discount is linked to: <b className="has-text-white">{userData.fullName}</b>
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── TRANSACTIONS HISTORY ── */}
            <div className="ap-card">
              <div
                className="ap-card-head"
                style={{ cursor: "pointer", marginBottom: txnPanelOpen ? undefined : 0 }}
                onClick={() => setTxnPanelOpen(!txnPanelOpen)}
              >
                <h2 className="ap-card-title">
                  <i className="fas fa-receipt"></i>
                  Revenue History
                </h2>
                <i className={`fas fa-chevron-${txnPanelOpen ? "up" : "down"}`} style={{ color: "var(--ap-muted)" }}></i>
              </div>

              {txnPanelOpen && (
                <>
                  <div className="ap-seg">
                    {["today", "week", "month", "last30", "all"].map((f) => (
                      <button
                        key={f}
                        onClick={() => setTxnFilter(f)}
                        className={txnFilter === f ? "is-active" : ""}
                      >
                        {PERIOD_LABELS[f]}
                      </button>
                    ))}
                  </div>

                  <div className="ap-stat is-hero" style={{ margin: "0.85rem 0" }}>
                    <p className="ap-stat-label">
                      Total Revenue ({PERIOD_LABELS[txnFilter]})
                    </p>
                    <p className="ap-stat-value">Rs. {totalRevenue.toLocaleString()}</p>
                  </div>

                  <div className="ap-table-wrap">
                    <table className="ap-table">
                      <thead>
                        <tr>
                          <th>Player</th>
                          <th>Station</th>
                          <th>Time</th>
                          <th>Method</th>
                          <th className="is-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredData.length === 0 && (
                          <tr>
                            <td colSpan={5} className="has-text-centered ap-hint" style={{ padding: "1.5rem" }}>
                              No transactions for this period.
                            </td>
                          </tr>
                        )}
                        {filteredData.map((t, i) => (
                          <tr key={i}>
                            <td>
                              <span className="has-text-weight-bold has-text-white">
                                {t.players || t.userName}
                              </span>
                              <br />
                              <span className="ap-when">
                                {new Date(t.startTime).toLocaleDateString()} ·{" "}
                                {new Date(t.startTime).toLocaleTimeString(
                                  [],
                                  { hour: "2-digit", minute: "2-digit" },
                                )}
                              </span>
                            </td>
                            <td>{t.machine}</td>
                            <td>{t.isSingleRace ? "Race" : t.duration != null ? `${t.duration}h` : "—"}</td>
                            <td>
                              {t.method && (
                                <span className={`ap-chip ${t.method === "CASH" ? "is-accent" : t.method === "CARD" ? "is-info" : ""}`}>
                                  {t.method}
                                </span>
                              )}
                            </td>
                            <td className="is-right ap-amount">Rs. {t.amountPaid}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
