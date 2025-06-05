const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

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
            localStorage.removeItem('authToken');
            if (logout) logout();
            throw new Error('Authentication expired');
        }

        return response;
    };
};

export const apiEndpoints = {
    getEntries: () => `${API_BASE_URL}/entries`,
    getTodayEntries: () => `${API_BASE_URL}/entries/today`,
    addEntry: () => `${API_BASE_URL}/entries`,
    deleteEntry: (id) => `${API_BASE_URL}/entries/${id}`,
    getEntriesByDateRange: (startDate, endDate) =>
        `${API_BASE_URL}/entries/date-range?start_date=${startDate}&end_date=${endDate}`,

    getProgress: () => `${API_BASE_URL}/progress`,
    addProgress: () => `${API_BASE_URL}/progress`,
    deleteProgress: (id) => `${API_BASE_URL}/progress/${id}`,
    getProgressByDateRange: (startDate, endDate) =>
        `${API_BASE_URL}/progress/date-range?start_date=${startDate}&end_date=${endDate}`,

    getGoals: () => `${API_BASE_URL}/goals`,
    updateGoals: () => `${API_BASE_URL}/goals`,

    getSummaryStats: (days = 7) => `${API_BASE_URL}/stats/summary?days=${days}`,

    nutritionLookup: () => `${API_BASE_URL}/api/nutritionix`,

    login: () => `${API_BASE_URL}/auth/login`,
    register: () => `${API_BASE_URL}/auth/register`,
    verify: () => `${API_BASE_URL}/auth/verify`,
    profile: () => `${API_BASE_URL}/auth/profile`
};

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
