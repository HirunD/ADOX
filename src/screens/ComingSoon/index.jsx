import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom"; // Assuming you use React Router

const ComingSoon = () => {
  const [timeLeft, setTimeLeft] = useState({});
  const targetDate = new Date("March 4, 2026 09:00:00").getTime();

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const distance = targetDate - now;
      setTimeLeft({
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000),
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  return (
    <div style={{ 
      background: "#050505", 
      minHeight: "100vh", 
      color: "#fff", 
      fontFamily: "sans-serif",
      padding: "40px 20px",
      display: "flex",
      flexDirection: "column",
      alignItems: "center"
    }}>
      {/* LOGO */}
      <img src="/logo.png" alt="Logo" style={{ width: "160px", marginBottom: "30px" }} />

      {/* 🟢 NEW: PROMINENT PRE-SIGN UP CARD */}
      <div style={{
        width: "100%",
        maxWidth: "500px",
        background: "linear-gradient(145deg, #00d1b2 0%, #006b5a 100%)",
        borderRadius: "24px",
        padding: "30px 20px",
        textAlign: "center",
        marginBottom: "40px",
        boxShadow: "0 10px 30px rgba(0, 209, 178, 0.3)",
        border: "1px solid rgba(255,255,255,0.2)"
      }}>
        <h2 style={{ fontSize: "28px", fontWeight: "900", margin: "0 0 10px 0", color: "#fff" }}>PRE-SIGN UP NOW</h2>
        <p style={{ fontSize: "16px", marginBottom: "20px", color: "rgba(255,255,255,0.9)", fontWeight: "500" }}>
            Get <span style={{ background: "#fff", color: "#006b5a", padding: "2px 8px", borderRadius: "5px", fontWeight: "bold" }}>15 MINS FREE</span> gameplay 
            when you register before launch!
        </p>
        <Link to="/signup" style={{ 
            display: "inline-block",
            background: "#fff",
            color: "#006b5a",
            padding: "15px 40px",
            borderRadius: "50px",
            textDecoration: "none",
            fontWeight: "900",
            fontSize: "18px",
            boxShadow: "0 4px 15px rgba(0,0,0,0.2)",
            animation: "pulse 2s infinite"
        }}>
          CLAIM MY REWARD
        </Link>
      </div>

      {/* COUNTDOWN LABEL */}
      <p style={{ fontSize: "12px", color: "#888", letterSpacing: "3px", marginBottom: "15px" }}>LAUNCHING IN</p>

      {/* COUNTDOWN GRID */}
      <div style={{ 
        display: "flex", 
        flexWrap: "wrap", 
        justifyContent: "center", 
        gap: "10px", 
        marginBottom: "50px",
        width: "100%",
        maxWidth: "500px"
      }}>
        {[
          { label: "DAYS", value: timeLeft.days },
          { label: "HOURS", value: timeLeft.hours },
          { label: "MINS", value: timeLeft.minutes },
          { label: "SECS", value: timeLeft.seconds },
        ].map((item, idx) => (
          <div key={idx} style={{ 
            background: "rgba(255,255,255,0.05)", 
            padding: "15px", 
            borderRadius: "12px", 
            flex: "1 1 70px", 
            textAlign: "center",
            border: "1px solid rgba(255,255,255,0.1)"
          }}>
            <div style={{ fontSize: "24px", fontWeight: "bold" }}>{item.value ?? "0"}</div>
            <div style={{ fontSize: "10px", color: "#00d1b2", marginTop: "5px" }}>{item.label}</div>
          </div>
        ))}
      </div>

      <div className="content-cards" style={{ display: "flex", flexDirection: "column", gap: "20px", width: "100%", maxWidth: "400px" }}>
        {/* RATES CARD */}
        <div style={{ background: "rgba(20,20,20,0.8)", border: "1px solid rgba(0, 209, 178, 0.3)", borderRadius: "20px", padding: "25px" }}>
          <p style={{ fontSize: "12px", color: "#888", letterSpacing: "2px", marginBottom: "20px", textAlign: "center" }}>LAUNCH RATES</p>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}><span style={{ color: "#aaa" }}>0.5 Hour</span><span style={{ fontWeight: "bold" }}>Rs. 500</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}><span style={{ color: "#aaa" }}>1.0 Hour</span><span style={{ fontWeight: "bold" }}>Rs. 800</span></div>
          <div style={{ display: "flex", justifyContent: "space-between" }}><span style={{ color: "#aaa" }}>2.0 Hours</span><span style={{ fontWeight: "bold" }}>Rs. 1500</span></div>
        </div>

        {/* LOCATION CARD */}
        <div style={{ background: "rgba(20,20,20,0.8)", border: "1px solid rgba(0, 209, 178, 0.3)", borderRadius: "20px", padding: "25px", textAlign: "center" }}>
          <p style={{ fontSize: "12px", color: "#888", letterSpacing: "2px", marginBottom: "15px" }}>LOCATION</p>
          <h3 style={{ fontSize: "28px", margin: "0 0 10px 0" }}>GALLE</h3>
          <p style={{ color: "#888", marginBottom: "5px", fontSize: "14px" }}>Infront of Richmond College</p>
          <p style={{ color: "#00d1b2", fontSize: "11px", marginBottom: "25px", opacity: 0.7 }}>6.0538° N, 80.2136° E</p>
          <a href="https://maps.google.com" target="_blank" rel="noopener noreferrer" style={{ display: "block", padding: "12px", border: "1px solid #00d1b2", color: "#00d1b2", textDecoration: "none", borderRadius: "10px", fontWeight: "bold", fontSize: "14px" }}>📍 VIEW ON MAPS</a>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); box-shadow: 0 4px 15px rgba(0,0,0,0.2); }
          50% { transform: scale(1.05); box-shadow: 0 4px 25px rgba(0,209,178,0.4); }
          100% { transform: scale(1); box-shadow: 0 4px 15px rgba(0,0,0,0.2); }
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