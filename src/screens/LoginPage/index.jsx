import React, { useState } from "react";
import { auth } from "../../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useNavigate, Link } from "react-router-dom"; 

const LoginPage = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            await signInWithEmailAndPassword(auth, email, password);
            navigate("/"); 
        } catch (err) {
            if (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
                setError("Invalid email or password.");
            } else {
                setError("Failed to login. Please check your connection.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <section className="hero is-fullheight" style={{ background: '#050505' }}>
            <div className="hero-body">
                <div className="container">
                    <div className="columns is-centered">
                        <div className="column is-4-tablet is-4-desktop is-3-widescreen">
                            <form 
                                className="box pt-6 pb-6" 
                                style={{ 
                                    background: '#1a1a1a', 
                                    border: '1px solid #333', 
                                    borderRadius: '20px',
                                    boxShadow: '0 15px 35px rgba(0,0,0,0.5)' 
                                }} 
                                onSubmit={handleLogin}
                            >
                                <div className="has-text-centered mb-6">
                                    <h1 className="title is-3 has-text-white" style={{ letterSpacing: '1px' }}>ADOX PORTAL</h1>
                                    <p className="subtitle is-6 has-text-grey-light">Sign in to access your pass</p>
                                </div>

                                {error && (
                                    <div className="notification is-danger is-light py-2 is-size-7">
                                        {error}
                                    </div>
                                )}

                                <div className="field">
                                    <label className="label has-text-grey-light">Email Address</label>
                                    <div className="control">
                                        <input
                                            className="input"
                                            style={{ background: '#252525', color: 'white', border: '1px solid #444' }}
                                            type="email"
                                            placeholder="e.g. user@adox.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="field">
                                    <label className="label has-text-grey-light">Password</label>
                                    <div className="control">
                                        <input
                                            className="input"
                                            style={{ background: '#252525', color: 'white', border: '1px solid #444' }}
                                            type="password"
                                            placeholder="*******"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="field mt-6">
                                    <button 
                                        className={`button is-primary is-fullwidth has-text-weight-bold ${loading ? 'is-loading' : ''}`} 
                                        style={{ height: '50px' }}
                                        type="submit"
                                        disabled={loading}
                                    >
                                        SIGN IN
                                    </button>
                                </div>

                                <div className="has-text-centered mt-5">
                                    <p className="is-size-7 has-text-grey">
                                        New player? <Link to="/signup" className="has-text-primary has-text-weight-bold">Create Account</Link>
                                    </p>
                                </div>
                            </form>
                            
                            <div className="has-text-centered mt-5">
                                <Link to="/admin" className="is-size-7 has-text-grey-darker" style={{ textDecoration: 'none' }}>
                                    Admin Access
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default LoginPage;