import React from "react";
import "./style.css";

const NavBar = () => {
    return (
        <nav className="navbar is-fixed-top glass-nav" role="navigation" aria-label="main navigation">
            <div className="container">
                <div className="navbar-brand">
                    <a className="navbar-item" href="/">
                        <img 
                            src="/logonav.png" 
                            alt="Adox Logo" 
                            style={{ maxHeight: '40px' }} 
                        />
                    </a>
                </div>
            </div>
        </nav>
    );
};

export default NavBar;