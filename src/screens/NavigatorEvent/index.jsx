import React, { useEffect, useState } from "react";
import { db } from "../../firebase";
import { collection, addDoc, deleteDoc, doc, onSnapshot } from "firebase/firestore";
import {
  NAVIGATOR_STATIONS,
  NAVIGATOR_SESSION_PRICE,
  NAVIGATOR_SESSION_HOURS,
} from "../../config/navigatorEvent";

const COLLECTION = "navigator_sessions";
const SESSION_MS = NAVIGATOR_SESSION_HOURS * 3600000;

const styles = `
  .nav-page { min-height: 100vh; background: #080808; padding: 20px 12px 40px; font-family: 'Inter', sans-serif; box-sizing: border-box; }
  .nav-title { color: #00d1b2; font-size: 1.6rem; font-weight: 900; text-align: center; letter-spacing: 2px; margin: 0; }
  .nav-subtitle { color: #999; text-align: center; font-size: 0.85rem; margin: 4px 0 18px; }
  .nav-tally { display: flex; justify-content: center; gap: 24px; max-width: 500px; margin: 0 auto 20px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 14px; }
  .nav-tally-label { color: #888; font-size: 0.62rem; text-transform: uppercase; letter-spacing: 1px; text-align: center; margin: 0; }
  .nav-tally-value { color: #fff; font-size: 1.4rem; font-weight: 800; text-align: center; margin: 0; }
  .nav-grid { display: grid; grid-template-columns: 1fr; gap: 14px; max-width: 700px; margin: 0 auto; }
  @media (min-width: 620px) { .nav-grid { grid-template-columns: 1fr 1fr; } }

  .nav-card { border-radius: 20px; padding: 16px; box-sizing: border-box; }
  .nav-card-single { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; min-height: 150px; border: none; width: 100%; cursor: pointer; }
  .nav-card-free { background: linear-gradient(145deg, #1a1a1a 0%, #0d0d0d 100%); border: 2px solid #00d1b2; }
  .nav-card-confirm { background: #111; border: 2px solid #ffdd57; }
  .nav-card-busy { background: #0d0d0d; border: 2px solid #ff3860; opacity: 0.92; }
  .nav-card-multi { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); }

  .nav-station-name { color: #fff; font-size: 1.1rem; font-weight: 800; margin: 0 0 8px; }
  .nav-free-label { color: #00d1b2; font-weight: 900; font-size: 1.05rem; margin: 0 0 6px; }
  .nav-price-tag { color: #aaa; font-size: 0.82rem; margin: 0; }
  .nav-confirm-text { color: #ffdd57; font-weight: 700; margin-bottom: 12px; font-size: 0.95rem; }
  .nav-confirm-btn { background: #23d160; color: #000; border: none; border-radius: 12px; padding: 16px; font-size: 1.05rem; font-weight: 900; width: 100%; margin-bottom: 8px; cursor: pointer; }
  .nav-cancel-btn { background: transparent; color: #888; border: none; font-size: 0.8rem; cursor: pointer; text-decoration: underline; padding: 6px; }
  .nav-busy-clock { color: #ff3860; font-size: 1.8rem; font-weight: 900; margin: 0 0 2px; animation: navPulse 1.5s infinite; }
  .nav-busy-label { color: #ff8fa3; font-size: 0.72rem; font-weight: 700; letter-spacing: 1px; margin: 0 0 12px; }
  .nav-undo-btn { background: transparent; color: #666; border: 1px solid #333; border-radius: 8px; padding: 8px 12px; font-size: 0.7rem; cursor: pointer; }
  @keyframes navPulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }

  .nav-slots { display: grid; grid-template-columns: 1fr; gap: 10px; margin-top: 10px; }
  @media (min-width: 460px) { .nav-slots { grid-template-columns: repeat(3, 1fr); } }
  .nav-slot { border-radius: 14px; padding: 14px 8px; text-align: center; }
`;

const formatClock = (ms) => {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
};

const NavigatorEvent = () => {
  const [sessions, setSessions] = useState([]);
  const [confirmingKey, setConfirmingKey] = useState(null); // `${stationId}-${slotIndex}`
  const [savingKey, setSavingKey] = useState(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, COLLECTION), (snapshot) => {
      const list = [];
      snapshot.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setSessions(list);
    });
    return () => unsub();
  }, []);

  const todayStr = new Date().toISOString().split("T")[0];
  const todaysSessions = sessions.filter((s) => s.startTime.startsWith(todayStr));
  const revenueToday = todaysSessions.length * NAVIGATOR_SESSION_PRICE;

  const activeSessionFor = (stationId, slotIndex) => {
    const active = sessions.find((s) => {
      if (s.stationId !== stationId || (s.slotIndex ?? 0) !== slotIndex) return false;
      const start = new Date(s.startTime).getTime();
      return now >= start && now < start + SESSION_MS;
    });
    return active || null;
  };

  const handleStart = async (station, slotIndex) => {
    const key = `${station.id}-${slotIndex}`;
    setSavingKey(key);
    try {
      await addDoc(collection(db, COLLECTION), {
        stationId: station.id,
        stationName: station.name,
        slotIndex,
        price: NAVIGATOR_SESSION_PRICE,
        duration: NAVIGATOR_SESSION_HOURS,
        startTime: new Date().toISOString(),
      });
      setConfirmingKey(null);
    } catch (err) {
      console.error(err);
      alert("Couldn't log session — check connection and try again.");
    } finally {
      setSavingKey(null);
    }
  };

  const handleUndo = async (sessionId) => {
    try {
      await deleteDoc(doc(db, COLLECTION, sessionId));
    } catch (err) {
      console.error(err);
      alert("Couldn't undo — try again.");
    }
  };

  const renderSlot = (station, slotIndex, label) => {
    const key = `${station.id}-${slotIndex}`;
    const active = activeSessionFor(station.id, slotIndex);
    const isConfirming = confirmingKey === key;

    if (active) {
      const remaining = new Date(active.startTime).getTime() + SESSION_MS - now;
      return (
        <div key={key} className="nav-slot nav-card-busy">
          <p className="nav-station-name" style={{ fontSize: "0.9rem" }}>{label}</p>
          <p className="nav-busy-clock" style={{ fontSize: "1.4rem" }}>{formatClock(remaining)}</p>
          <p className="nav-busy-label">IN USE</p>
          <button className="nav-undo-btn" onClick={() => handleUndo(active.id)}>Undo</button>
        </div>
      );
    }

    if (isConfirming) {
      return (
        <div key={key} className="nav-slot nav-card-confirm">
          <p className="nav-station-name" style={{ fontSize: "0.9rem" }}>{label}</p>
          <p className="nav-confirm-text" style={{ fontSize: "0.85rem" }}>Rs. {NAVIGATOR_SESSION_PRICE}?</p>
          <button
            className="nav-confirm-btn"
            disabled={savingKey === key}
            onClick={() => handleStart(station, slotIndex)}
          >
            {savingKey === key ? "..." : "✅ CONFIRM"}
          </button>
          <button className="nav-cancel-btn" onClick={() => setConfirmingKey(null)}>Cancel</button>
        </div>
      );
    }

    return (
      <button key={key} className="nav-slot nav-card-free" onClick={() => setConfirmingKey(key)}>
        <p className="nav-station-name" style={{ fontSize: "0.9rem" }}>{label}</p>
        <p className="nav-free-label" style={{ fontSize: "0.9rem" }}>START</p>
        <p className="nav-price-tag">Rs. {NAVIGATOR_SESSION_PRICE}</p>
      </button>
    );
  };

  return (
    <div className="nav-page">
      <style>{styles}</style>

      <h1 className="nav-title">NAVIGATOR</h1>
      <p className="nav-subtitle">Rs. {NAVIGATOR_SESSION_PRICE} per person · 15 min per session</p>

      <div className="nav-tally">
        <div>
          <p className="nav-tally-label">PLAYERS TODAY</p>
          <p className="nav-tally-value">{todaysSessions.length}</p>
        </div>
        <div>
          <p className="nav-tally-label">REVENUE TODAY</p>
          <p className="nav-tally-value">Rs. {revenueToday}</p>
        </div>
      </div>

      <div className="nav-grid">
        {NAVIGATOR_STATIONS.map((station) => {
          if (station.slots <= 1) {
            return (
              <React.Fragment key={station.id}>
                {(() => {
                  const key = `${station.id}-0`;
                  const active = activeSessionFor(station.id, 0);
                  const isConfirming = confirmingKey === key;

                  if (active) {
                    const remaining = new Date(active.startTime).getTime() + SESSION_MS - now;
                    return (
                      <div className="nav-card nav-card-single nav-card-busy">
                        <p className="nav-station-name">{station.name}</p>
                        <p className="nav-busy-clock">{formatClock(remaining)}</p>
                        <p className="nav-busy-label">IN USE</p>
                        <button className="nav-undo-btn" onClick={() => handleUndo(active.id)}>Undo (misclick)</button>
                      </div>
                    );
                  }

                  if (isConfirming) {
                    return (
                      <div className="nav-card nav-card-single nav-card-confirm">
                        <p className="nav-station-name">{station.name}</p>
                        <p className="nav-confirm-text">Start for Rs. {NAVIGATOR_SESSION_PRICE}?</p>
                        <button
                          className="nav-confirm-btn"
                          disabled={savingKey === key}
                          onClick={() => handleStart(station, 0)}
                        >
                          {savingKey === key ? "..." : "✅ CONFIRM"}
                        </button>
                        <button className="nav-cancel-btn" onClick={() => setConfirmingKey(null)}>Cancel</button>
                      </div>
                    );
                  }

                  return (
                    <button className="nav-card nav-card-single nav-card-free" onClick={() => setConfirmingKey(key)}>
                      <p className="nav-station-name">{station.name}</p>
                      <p className="nav-free-label">TAP TO START</p>
                      <p className="nav-price-tag">Rs. {NAVIGATOR_SESSION_PRICE} / 15 min</p>
                    </button>
                  );
                })()}
              </React.Fragment>
            );
          }

          return (
            <div key={station.id} className="nav-card nav-card-multi">
              <p className="nav-station-name">{station.name}</p>
              <p className="nav-price-tag" style={{ marginBottom: "4px" }}>Rs. {NAVIGATOR_SESSION_PRICE} per player</p>
              <div className="nav-slots">
                {Array.from({ length: station.slots }, (_, i) => renderSlot(station, i, `Player ${i + 1}`))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default NavigatorEvent;
