import React, { useState } from "react";
import { auth } from "../../firebase";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useNavigate } from "react-router-dom"; // Assuming you use react-router

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
            // Redirect to the homepage/QR portal after successful login
            navigate("/"); 
        } catch (err) {
            // Friendly error messages
            if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
                setError("Invalid email or password.");
            } else {
                setError("Failed to login. Please check your connection.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <section className="hero is-light is-fullheight">
            <div className="hero-body">
                <div className="container">
                    <div className="columns is-centered">
                        <div className="column is-5-tablet is-4-desktop is-3-widescreen">
                            <form className="box pt-6 pb-6" onSubmit={handleLogin}>
                                <div className="has-text-centered mb-5">
                                    <h1 className="title is-3">ADOX Portal</h1>
                                    <p className="subtitle is-6">Please sign in to your account</p>
                                </div>

                                {error && (
                                    <div className="notification is-danger is-light py-2">
                                        <button className="delete" onClick={() => setError("")}></button>
                                        {error}
                                    </div>
                                )}

                                <div className="field">
                                    <label className="label">Email</label>
                                    <div className="control has-icons-left">
                                        <input
                                            className="input"
                                            type="email"
                                            placeholder="e.g. user@adox.com"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                        />
                                        <span className="icon is-small is-left">
                                            <i className="fas fa-envelope"></i>
                                        </span>
                                    </div>
                                </div>

                                <div className="field">
                                    <label className="label">Password</label>
                                    <div className="control has-icons-left">
                                        <input
                                            className="input"
                                            type="password"
                                            placeholder="*******"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                        />
                                        <span className="icon is-small is-left">
                                            <i className="fas fa-lock"></i>
                                        </span>
                                    </div>
                                </div>

                                <div className="field mt-5">
                                    <button 
                                        className={`button is-primary is-fullwidth ${loading ? 'is-loading' : ''}`} 
                                        type="submit"
                                        disabled={loading}
                                    >
                                        Sign In
                                    </button>
                                </div>

                                <div className="has-text-centered mt-4">
                                    <p className="is-size-7">
                                        Don't have an account? <a href="/signup">SignUp</a>
                                    </p>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default LoginPage;