import React, { useState } from "react";
import "./style.css";

const NavBar = () => {
    const [isActive, setIsActive] = useState(false);

    return (
        <nav className={`navbar is-fixed-top glass-nav ${isActive ? "is-active" : ""}`} role="navigation" aria-label="main navigation">
            <div className="container">
                <div className="navbar-brand">
                    <a className="navbar-item" href="/">
                        {/* Removed /public/ from path - Vite serves public folder at root / */}
                        <img src="/logonav.png" alt="Adox Logo" style={{ maxHeight: '40px' }} />
                    </a>

                    <a
                        onClick={() => setIsActive(!isActive)}
                        role="button"
                        className={`navbar-burger burger ${isActive ? "is-active" : ""}`}
                        aria-label="menu"
                        aria-expanded="false"
                    >
                        <span aria-hidden="true"></span>
                        <span aria-hidden="true"></span>
                        <span aria-hidden="true"></span>
                    </a>
                </div>

                <div className={`navbar-menu ${isActive ? "is-active" : ""}`}>
                    <div className="navbar-end">
                        {/* <a className="navbar-item has-text-white" href="#pricing">PRICING</a> */}
                        {/* <a className="navbar-item has-text-white" href="#location">LOCATION</a> */}
                        <div className="navbar-item">
                            <span className="tag is-primary is-rounded has-text-weight-bold">FEB 7TH</span>
                        </div>
                    </div>
                </div>
            </div>
        </nav>
    );
};

export default NavBar;