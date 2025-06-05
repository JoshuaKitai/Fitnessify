import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

    const verifyToken = useCallback(async (token) => {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/verify`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const userData = await response.json();
                setUser(userData.user);
            } else {
                localStorage.removeItem('authToken');
            }
        } catch (error) {
            console.error('Token verification failed:', error);
            localStorage.removeItem('authToken');
        } finally {
            setLoading(false);
        }
    }, [API_BASE_URL]);

    useEffect(() => {
        const token = localStorage.getItem('authToken');
        if (token) {
            verifyToken(token);
        } else {
            setLoading(false);
        }
    }, [verifyToken]);

    const login = useCallback(async (email, password) => {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Login failed');
            }

            localStorage.setItem('authToken', data.token);
            setUser(data.user);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }, [API_BASE_URL]);

    const register = useCallback(async (username, email, password) => {
        try {
            const response = await fetch(`${API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Registration failed');
            }

            localStorage.setItem('authToken', data.token);
            setUser(data.user);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }, [API_BASE_URL]);

    const logout = useCallback(() => {
        localStorage.removeItem('authToken');
        setUser(null);
    }, []);

    const value = {
        user,
        login,
        register,
        logout,
        loading
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};