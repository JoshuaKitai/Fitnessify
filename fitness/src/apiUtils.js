// apiUtils.js - Centralized API utility with authentication
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// Create authenticated fetch function
export const createAuthenticatedFetch = (logout) => {
    return async (url, options = {}) => {
        const token = localStorage.getItem('authToken');
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(url, {
            ...options,
            headers
        });

        if (response.status === 401) {
            // Token expired or invalid
            localStorage.removeItem('authToken');
            if (logout) logout();
            throw new Error('Authentication expired');
        }

        return response;
    };
};

// API endpoints that require authentication
export const apiEndpoints = {
    // Calorie entries
    getEntries: () => `${API_BASE_URL}/entries`,
    getTodayEntries: () => `${API_BASE_URL}/entries/today`,
    addEntry: () => `${API_BASE_URL}/entries`,
    deleteEntry: (id) => `${API_BASE_URL}/entries/${id}`,
    getEntriesByDateRange: (startDate, endDate) =>
        `${API_BASE_URL}/entries/date-range?start_date=${startDate}&end_date=${endDate}`,

    // Progress entries
    getProgress: () => `${API_BASE_URL}/progress`,
    addProgress: () => `${API_BASE_URL}/progress`,
    deleteProgress: (id) => `${API_BASE_URL}/progress/${id}`,
    getProgressByDateRange: (startDate, endDate) =>
        `${API_BASE_URL}/progress/date-range?start_date=${startDate}&end_date=${endDate}`,

    // Goals
    getGoals: () => `${API_BASE_URL}/goals`,
    updateGoals: () => `${API_BASE_URL}/goals`,

    // Stats
    getSummaryStats: (days = 7) => `${API_BASE_URL}/stats/summary?days=${days}`,

    // Nutrition
    nutritionLookup: () => `${API_BASE_URL}/api/nutritionix`,

    // Auth
    login: () => `${API_BASE_URL}/auth/login`,
    register: () => `${API_BASE_URL}/auth/register`,
    verify: () => `${API_BASE_URL}/auth/verify`,
    profile: () => `${API_BASE_URL}/auth/profile`
};

// Hook for authenticated API calls
import { useAuth } from './AuthContext';
import { useCallback } from 'react';

export const useAuthenticatedApi = () => {
    const { logout } = useAuth();

    const authenticatedFetch = useCallback(
        createAuthenticatedFetch(logout),
        [logout]
    );

    return authenticatedFetch;
};

// Example usage in components:
// const authenticatedFetch = useAuthenticatedApi();
// const response = await authenticatedFetch(apiEndpoints.getTodayEntries());