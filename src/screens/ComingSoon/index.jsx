import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";

const ComingSoon = () => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const targetDate = new Date("March 4, 2026 09:00:00").getTime();

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const distance = targetDate - now;
      
      if (distance < 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        clearInterval(timer);
      } else {
        setTimeLeft({
          days: Math.floor(distance / (1000 * 60 * 60 * 24)),
          hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((distance % (1000 * 60)) / 1000),
        });
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  return (
    <div style={{ 
      background: "#000", 
      minHeight: "100vh", 
      color: "#fff", 
      fontFamily: "'Inter', sans-serif",
      padding: "20px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center"
    }}>
      {/* LOGO HEADER - NORMALIZED */}
      <div style={{ marginBottom: "20px", textAlign: "center", width: "100%", height: "80px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <img 
          src="/logo.png" 
          alt="Logo" 
          style={{ 
            maxHeight: "100%", 
            width: "auto", 
            objectFit: "contain",
            imageOrientation: "none" // Forces browser to ignore messy metadata
          }} 
        />
      </div>

      {/* 🟢 PRE-SIGN UP CARD */}
      <div style={{
        width: "100%",
        maxWidth: "450px",
        background: "linear-gradient(145deg, #00d1b2 0%, #006b5a 100%)",
        borderRadius: "28px",
        padding: "35px 20px",
        textAlign: "center",
        marginBottom: "40px",
        boxShadow: "0 20px 40px rgba(0, 209, 178, 0.25)",
        border: "1px solid rgba(255,255,255,0.2)"
      }}>
        <h2 style={{ fontSize: "26px", fontWeight: "900", margin: "0 0 12px 0", letterSpacing: "-0.5px" }}>PRE-SIGN UP NOW</h2>
        <p style={{ fontSize: "15px", marginBottom: "25px", color: "rgba(255,255,255,0.95)", lineHeight: "1.4" }}>
            Get <span style={{ background: "#fff", color: "#006b5a", padding: "3px 10px", borderRadius: "6px", fontWeight: "800", fontSize: "14px" }}>15 MINS FREE</span> gameplay 
            when you register before launch!
        </p>
        <Link to="/signup" className="pulse-btn" style={{ 
            display: "inline-block",
            background: "#fff",
            color: "#006b5a",
            padding: "16px 35px",
            borderRadius: "50px",
            textDecoration: "none",
            fontWeight: "900",
            fontSize: "16px",
            textTransform: "uppercase"
        }}>
          CLAIM MY REWARD
        </Link>
      </div>

      {/* COUNTDOWN LABEL */}
      <p style={{ fontSize: "11px", color: "#555", letterSpacing: "4px", marginBottom: "20px", fontWeight: "700" }}>LAUNCHING IN</p>
      
      {/* COUNTDOWN GRID */}
      <div style={{ 
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: "12px", 
        marginBottom: "50px",
        width: "100%",
        maxWidth: "450px"
      }}>
        {[
          { label: "DAYS", value: timeLeft.days },
          { label: "HOURS", value: timeLeft.hours },
          { label: "MINS", value: timeLeft.minutes },
          { label: "SECS", value: timeLeft.seconds },
        ].map((item, idx) => (
          <div key={idx} style={{ 
            background: "#111", 
            padding: "15px 5px", 
            borderRadius: "16px", 
            textAlign: "center",
            border: "1px solid #222"
          }}>
            <div style={{ fontSize: "22px", fontWeight: "800", color: "#fff" }}>{item.value ?? "0"}</div>
            <div style={{ fontSize: "9px", color: "#00d1b2", marginTop: "4px", fontWeight: "700" }}>{item.label}</div>
          </div>
        ))}
      </div>

      <div className="content-cards" style={{ display: "flex", flexDirection: "column", gap: "15px", width: "100%", maxWidth: "450px" }}>
        {/* RATES CARD */}
        <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: "24px", padding: "25px" }}>
          <p style={{ fontSize: "11px", color: "#555", letterSpacing: "2px", marginBottom: "20px", textAlign: "center", fontWeight: "700" }}>LAUNCH RATES</p>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
            <span style={{ color: "#888", fontSize: "14px" }}>0.5 Hour</span>
            <span style={{ fontWeight: "800", fontSize: "14px" }}>Rs. 500</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
            <span style={{ color: "#888", fontSize: "14px" }}>1.0 Hour</span>
            <span style={{ fontWeight: "800", fontSize: "14px" }}>Rs. 800</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#888", fontSize: "14px" }}>2.0 Hours</span>
            <span style={{ fontWeight: "800", fontSize: "14px" }}>Rs. 1500</span>
          </div>
        </div>

        {/* LOCATION CARD */}
        <div style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: "24px", padding: "25px", textAlign: "center" }}>
          <p style={{ fontSize: "11px", color: "#555", letterSpacing: "2px", marginBottom: "15px", fontWeight: "700" }}>LOCATION</p>
          <h3 style={{ fontSize: "24px", fontWeight: "900", margin: "0 0 8px 0", color: "#fff" }}>GALLE</h3>
          <p style={{ color: "#888", marginBottom: "5px", fontSize: "13px" }}>Infront of Richmond College</p>
          <p style={{ color: "#00d1b2", fontSize: "10px", marginBottom: "20px", opacity: 0.6 }}>6.0538° N, 80.2136° E</p>
          <a href="https://maps.google.com" target="_blank" rel="noopener noreferrer" style={{ display: "block", padding: "14px", border: "1.5px solid #00d1b2", color: "#00d1b2", textDecoration: "none", borderRadius: "12px", fontWeight: "800", fontSize: "13px" }}>
            📍 VIEW ON MAPS
          </a>
        </div>
      </div>

      <style>{`
        .pulse-btn { animation: pulse 2s infinite; }
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.4); transform: scale(1); }
          70% { box-shadow: 0 0 0 15px rgba(255, 255, 255, 0); transform: scale(1.02); }
          100% { box-shadow: 0 0 0 0 rgba(255, 255, 255, 0); transform: scale(1); }
        }
        @media (min-width: 769px) {
          .content-cards { flex-direction: row !important; max-width: 800px !important; }
          .content-cards > div { flex: 1; }
        }
      `}</style>
    </div>
  );
};

export default ComingSoon;