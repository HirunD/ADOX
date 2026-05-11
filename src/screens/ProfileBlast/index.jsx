import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { doc, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "../../firebase";
import { Link } from "react-router-dom";

const ProfileBlast = () => {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [glitch, setGlitch] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        const unsubData = onSnapshot(doc(db, "users", user.uid), (snap) => {
          if (snap.exists()) setUserData(snap.data());
          setLoading(false);
        });
        return () => unsubData();
      } else {
        setLoading(false);
      }
    });

    // Random glitch trigger
    const interval = setInterval(() => {
      setGlitch(true);
      setTimeout(() => setGlitch(false), 200);
    }, 4000);

    return () => { unsubscribeAuth(); clearInterval(interval); };
  }, []);

  if (loading) return <div style={{ background: "#000", height: "100vh" }} />;

  return (
    <div className={`blast-viewport ${glitch ? 'glitch-active' : ''}`}>
      <style>{`
        .blast-viewport { 
          background: #000; height: 100vh; width: 100vw; overflow: hidden; 
          display: flex; align-items: center; justify-content: center; 
          position: relative; perspective: 1200px; font-family: 'Inter', sans-serif;
        }

        /* The Cyber Grid */
        .cyber-grid {
          position: absolute; width: 300%; height: 300%;
          background-image: 
            linear-gradient(rgba(0, 209, 178, 0.1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0, 209, 178, 0.1) 1px, transparent 1px);
          background-size: 60px 60px;
          transform: rotateX(60deg) translateY(-20%);
          animation: gridMove 20s linear infinite;
          z-index: 1;
        }

        @keyframes gridMove {
          from { background-position: 0 0; }
          to { background-position: 0 1000px; }
        }

        /* Floating Binary Data */
        .data-stream {
          position: absolute; left: 5%; top: 0; bottom: 0; width: 20px;
          color: #00d1b2; font-size: 10px; opacity: 0.2; writing-mode: vertical-rl;
          letter-spacing: 5px; overflow: hidden;
        }

        /* Glitch Effect Styles */
        .glitch-active { filter: url(#glitch-filter); }
        
        .chromatic {
          text-shadow: 3px 0 #ff00ff, -3px 0 #00ffff;
          animation: jitter 0.2s infinite alternate;
        }

        @keyframes jitter {
          0% { transform: translate(0); }
          100% { transform: translate(2px, -1px); }
        }

        .shimmer {
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
          background-size: 200% 100%;
          animation: shimmerEffect 3s infinite;
        }

        @keyframes shimmerEffect {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>

      {/* SVG Glitch Filter */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <filter id="glitch-filter">
          <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0" />
          <feOffset dx="3" dy="0" result="offsetred" />
          <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0" />
          <feOffset dx="-3" dy="0" result="offsetgreen" />
          <feBlend in="offsetred" in2="offsetgreen" mode="screen" />
        </filter>
      </svg>

      <div className="cyber-grid" />
      <div className="data-stream">101001010101110001010101101010101111010</div>
      <div className="data-stream" style={{ left: 'auto', right: '5%' }}>011101010101100101010111101010100101011</div>

      <AnimatePresence>
        <motion.div 
          initial={{ scale: 2, opacity: 0, rotateY: -90 }}
          animate={{ scale: 1, opacity: 1, rotateY: 0 }}
          transition={{ duration: 0.8, type: "spring", bounce: 0.4 }}
          style={{ zIndex: 10, width: '90%', maxWidth: '420px' }}
        >
          <motion.div
            style={{
              background: "rgba(10, 10, 10, 0.85)",
              border: userData?.isMember ? "4px solid #d4af37" : "2px solid #00d1b2",
              borderRadius: "45px",
              padding: "60px 25px 40px",
              textAlign: "center",
              position: "relative",
              backdropFilter: "blur(30px)",
              boxShadow: userData?.isMember 
                ? "0 0 80px rgba(212, 175, 55, 0.3), inset 0 0 20px rgba(212, 175, 55, 0.2)"
                : "0 0 50px rgba(0, 209, 178, 0.2)",
            }}
          >
            {/* Top HUD Decor */}
            <div style={{ position: 'absolute', top: '15px', width: '100%', left: 0, display: 'flex', justifyContent: 'center', gap: '5px' }}>
              {[...Array(5)].map((_, i) => (
                <div key={i} style={{ width: '15px', height: '2px', background: '#00d1b2', opacity: 0.3 }} />
              ))}
            </div>

            {/* Profile Aura */}
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                style={{
                  position: 'absolute', inset: -15, borderRadius: '50%',
                  border: `2px dashed ${userData?.isMember ? '#d4af37' : '#00d1b2'}`,
                  opacity: 0.4
                }}
              />
              <motion.img
                whileHover={{ scale: 1.1 }}
                src={userData?.avatar ? `/avatars/${userData.avatar}` : "/avatars/1.png"}
                style={{
                  width: "140px", height: "140px", borderRadius: "50%",
                  border: userData?.isMember ? "5px solid #d4af37" : "4px solid #00d1b2",
                  padding: '5px', background: '#000',
                  objectFit: "cover", zIndex: 2, position: 'relative'
                }}
              />
            </div>

            <div className="mt-4">
              <motion.div 
                className={`title is-1 mb-2 ${glitch ? 'chromatic' : ''}`}
                style={{ color: '#fff', letterSpacing: '4px', fontWeight: '950' }}
              >
                {userData?.fullName?.split(' ')[0] || "GUEST"}
              </motion.div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '25px' }}>
                <span className="tag is-black" style={{ border: '1px solid #00d1b2', color: '#00d1b2' }}>LVL 24</span>
                <span className="tag is-black" style={{ border: '1px solid #00d1b2', color: '#00d1b2' }}>DRIVE: {userData?.totalHours || 0}H</span>
              </div>

              {/* Membership "Power-Up" Bar */}
              {userData?.isMember && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  style={{
                    background: 'rgba(212, 175, 55, 0.1)',
                    border: '1px solid #d4af37',
                    borderRadius: '15px',
                    padding: '15px',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  <div className="shimmer" style={{ position: 'absolute', inset: 0, opacity: 0.3 }} />
                  <p style={{ color: '#d4af37', fontWeight: '900', fontSize: '12px', letterSpacing: '2px' }}>
                    ★ ELITE BENEFITS ACTIVE ★
                  </p>
                  <p style={{ color: '#fff', fontSize: '10px', marginTop: '4px', opacity: 0.7 }}>
                    50% PRICE REDUCTION GRANTED
                  </p>
                </motion.div>
              )}
            </div>

            {/* Decorative Corner Brackets */}
            <div style={{ position: 'absolute', bottom: '20px', right: '20px', width: '20px', height: '20px', borderRight: '2px solid #00d1b2', borderBottom: '2px solid #00d1b2', opacity: 0.5 }} />
            <div style={{ position: 'absolute', bottom: '20px', left: '20px', width: '20px', height: '20px', borderLeft: '2px solid #00d1b2', borderBottom: '2px solid #00d1b2', opacity: 0.5 }} />
          </motion.div>

          <motion.div 
            className="has-text-centered mt-6"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
          >
            <Link 
              to="/" 
              className="button is-rounded is-large"
              style={{
                background: 'transparent',
                border: '2px solid #00d1b2',
                color: '#00d1b2',
                padding: '0 50px',
                fontWeight: '900',
                textTransform: 'uppercase',
                letterSpacing: '5px',
                boxShadow: '0 0 20px rgba(0, 209, 178, 0.3)'
              }}
            >
              INITIALIZE
            </Link>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default ProfileBlast;