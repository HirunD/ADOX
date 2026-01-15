import React, { useState, useEffect } from "react";

const ComingSoon = () => {
  const [timeLeft, setTimeLeft] = useState({});
  const [phone, setPhone] = useState("");

  const targetDate = new Date("February 7, 2026 00:00:00").getTime();

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const distance = targetDate - now;

      setTimeLeft({
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor(
          (distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
        ),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000),
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const handleNotify = (e) => {
    e.preventDefault();
    const adminNumber = "947XXXXXXXX";
    const message = `Hi Adox Gaming! Notify me when you open! My phone: ${phone}`;
    const whatsappUrl = `https://wa.me/${adminNumber}?text=${encodeURIComponent(
      message
    )}`;
    window.open(whatsappUrl, "_blank");
  };

  return (
    <div
      className="hero is-fullheight"
      style={{
        background: "#050505",
        color: "#fff",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* ANIMATED BACKGROUND GLOWS */}
      <div className="bg-glow"></div>

      <div className="hero-body" style={{ zIndex: 2 }}>
        <div className="container has-text-centered">
          {/* LOGO SECTION */}
          <div className="mb-6">
            <img
              src="/logo.png"
              alt="Adox Gaming Logo"
              className="logo-animation"
              style={{ maxWidth: "350px", width: "80%", height: "auto" }}
            />
          </div>

          <h2
            className="subtitle is-4 has-text-white mb-6"
            style={{ letterSpacing: "4px", fontWeight: "300", opacity: 0.8 }}
          >
            REDEFINING THE{" "}
            <span style={{ color: "#00d1b2", fontWeight: "bold" }}>ARENA</span>
          </h2>

          {/* COUNTDOWN GRID */}
          <div className="columns is-mobile is-centered mb-6">
            {[
              { label: "DAYS", value: timeLeft.days },
              { label: "HOURS", value: timeLeft.hours },
              { label: "MINS", value: timeLeft.minutes },
              { label: "SECS", value: timeLeft.seconds },
            ].map((item, idx) => (
              <div key={idx} className="column is-narrow">
                <div className="countdown-box">
                  <p className="title is-2 has-text-white mb-0">
                    {item.value || "0"}
                  </p>
                  <p className="is-size-7 has-text-primary has-text-weight-bold">
                    {item.label}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="columns is-centered is-multiline px-4">
            {/* PRICING CARD */}
            <div className="column is-4-tablet is-10-mobile">
              <div className="pricing-card">
                <p
                  className="has-text-grey-light is-size-7 mb-4"
                  style={{ letterSpacing: "2px" }}
                >
                  LAUNCH RATES
                </p>
                <div className="is-flex is-justify-content-space-between mb-3 px-4">
                  <span className="has-text-grey">0.5 Hour</span>
                  <span className="has-text-white has-text-weight-bold">
                    Rs. 500
                  </span>
                </div>
                <div className="price-divider"></div>
                <div className="is-flex is-justify-content-space-between mb-3 px-4">
                  <span className="has-text-grey">1.0 Hour</span>
                  <span className="has-text-white has-text-weight-bold">
                    Rs. 800
                  </span>
                </div>
                <div className="price-divider"></div>
                <div className="is-flex is-justify-content-space-between px-4">
                  <span className="has-text-grey">2.0 Hours</span>
                  <span className="has-text-white has-text-weight-bold">
                    Rs. 1500
                  </span>
                </div>
              </div>
            </div>

            {/* NEW: LOCATION CARD */}
            <div className="column is-4-tablet is-10-mobile">
              <div
                className="pricing-card"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "center",
                }}
              >
                <p
                  className="has-text-grey-light is-size-7 mb-4"
                  style={{ letterSpacing: "2px" }}
                >
                  LOCATION
                </p>
                <h3 className="title is-4 has-text-white mb-2">GALLE</h3>
                <p className="has-text-grey is-size-6 mb-5">
                  Infront of Richmond College Galle<br />
                  Ready for the next level?
                </p>

                {/* REPLACE LAT/LONG WITH YOUR ACTUAL ONES */}
                <a
                  href="https://www.google.com/maps/search/?api=1&query=6.052164324068312,80.20661741260649"
                  target="_blank"
                  rel="noreferrer"
                  className="button is-outline is-primary is-light is-outlined"
                  style={{ borderRadius: "10px", border: "1px solid #00d1b2" }}
                >
                  📍 VIEW ON MAPS
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        /* BACKGROUND ANIMATION */
        .bg-glow {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 600px;
          height: 600px;
          background: radial-gradient(circle, rgba(0,209,178,0.15) 0%, rgba(0,0,0,0) 70%);
          transform: translate(-50%, -50%);
          filter: blur(80px);
          animation: moveGlow 10s infinite alternate;
          z-index: 1;
        }

        @keyframes moveGlow {
          from { transform: translate(-60%, -40%); }
          to { transform: translate(-40%, -60%); }
        }

        /* CARD STYLES */
        .countdown-box {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.1);
          padding: 1.5rem;
          min-width: 100px;
          border-radius: 12px;
          backdrop-filter: blur(10px);
        }

        .pricing-card, .notify-card {
          background: rgba(20, 20, 20, 0.6);
          border: 1px solid rgba(0, 209, 178, 0.2);
          padding: 2.5rem 1.5rem;
          border-radius: 20px;
          height: 100%;
          backdrop-filter: blur(20px);
          transition: border 0.3s ease;
        }

        .pricing-card:hover {
          border-color: #00d1b2;
        }

        .price-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
          margin: 1rem 0;
        }

        .custom-input {
          background: rgba(0, 0, 0, 0.3) !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          color: white !important;
          border-radius: 8px;
        }

        .custom-input:focus {
          border-color: #00d1b2 !important;
          box-shadow: 0 0 10px rgba(0, 209, 178, 0.2) !important;
        }

        .shine-button {
          position: relative;
          overflow: hidden;
          transition: all 0.3s ease;
        }

        .shine-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 5px 20px rgba(0, 209, 178, 0.4);
        }

        .logo-animation {
          animation: logoFloat 4s infinite ease-in-out;
          filter: drop-shadow(0 0 15px rgba(0, 209, 178, 0.2));
        }

        @keyframes logoFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }

        @media (max-width: 768px) {
          .bg-glow { width: 300px; height: 300px; }
        }
      `}</style>
    </div>
  );
};

export default ComingSoon;
