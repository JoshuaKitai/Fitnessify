import React, { useState, useEffect, useCallback } from 'react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const Goals = React.memo(() => {
    const [goals, setGoals] = useState({
        daily_calories: 2000,
        daily_protein: 150,
        daily_carbs: 250,
        daily_fat: 65,
        target_weight: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [hasChanges, setHasChanges] = useState(false);

    const getAuthHeaders = useCallback(() => {
        const token = localStorage.getItem('authToken');
        return {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        };
    }, []);

    const fetchGoals = useCallback(async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API_BASE_URL}/goals`, {
                headers: getAuthHeaders()
            });
            if (!res.ok) throw new Error('Failed to fetch goals');
            const data = await res.json();
            setGoals(data);
            setError(null);
        } catch (err) {
            setError('Failed to load goals. Using defaults.');
            console.error('Error fetching goals:', err);
        } finally {
            setLoading(false);
        }
    }, [getAuthHeaders]);

    useEffect(() => {
        fetchGoals();
    }, [fetchGoals]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setGoals(prev => ({
            ...prev,
            [name]: value
        }));
        setHasChanges(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const numericFields = ['daily_calories', 'daily_protein', 'daily_carbs', 'daily_fat'];
        const values = { ...goals };

        for (const field of numericFields) {
            const value = parseFloat(values[field]);
            if (isNaN(value) || value <= 0) {
                setError(`Please enter a valid positive number for ${field.replace('daily_', '').replace('_', ' ')}`);
                return;
            }
            values[field] = value;
        }

        if (values.target_weight) {
            const targetWeight = parseFloat(values.target_weight);
            if (isNaN(targetWeight) || targetWeight <= 0) {
                setError('Please enter a valid target weight or leave it empty');
                return;
            }
            values.target_weight = targetWeight;
        } else {
            values.target_weight = null;
        }

        try {
            setLoading(true);
            setError(null);

            const res = await fetch(`${API_BASE_URL}/goals`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(values)
            });

            const responseData = await res.json();

            if (!res.ok) {
                throw new Error(responseData.error || 'Failed to update goals');
            }

            setSuccess('Goals updated successfully!');
            setHasChanges(false);
            await fetchGoals();
        } catch (err) {
            setError(err.message || 'Failed to update goals');
        } finally {
            setLoading(false);
        }
    };

    const resetToDefaults = () => {
        setGoals({
            daily_calories: 2000,
            daily_protein: 150,
            daily_carbs: 250,
            daily_fat: 65,
            target_weight: ''
        });
        setHasChanges(true);
    };

    useEffect(() => {
        if (success) {
            const timer = setTimeout(() => setSuccess(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [success]);

    useEffect(() => {
        if (error) {
            const timer = setTimeout(() => setError(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [error]);

    const totalMacroCalories = (goals.daily_protein * 4) + (goals.daily_carbs * 4) + (goals.daily_fat * 9);
    const macroPercentages = {
        protein: ((goals.daily_protein * 4) / totalMacroCalories * 100).toFixed(1),
        carbs: ((goals.daily_carbs * 4) / totalMacroCalories * 100).toFixed(1),
        fat: ((goals.daily_fat * 9) / totalMacroCalories * 100).toFixed(1)
    };

    const calorieDiscrepancy = Math.abs(goals.daily_calories - totalMacroCalories);

    return (
        <div className="goals-section">
            <h2>Daily Goals & Targets</h2>

            {error && <div className="error">{error}</div>}
            {success && <div className="success">{success}</div>}

            <div className="goals-form">
                <form onSubmit={handleSubmit}>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Daily Calories Goal</label>
                            <input
                                type="number"
                                name="daily_calories"
                                value={goals.daily_calories}
                                onChange={handleChange}
                                min="800"
                                max="8000"
                                step="50"
                                required
                                disabled={loading}
                            />
                            <small className="goal-text">Recommended: 1,200-3,000 kcal based on activity level</small>
                        </div>

                        <div className="form-group">
                            <label>Daily Protein Goal (g)</label>
                            <input
                                type="number"
                                name="daily_protein"
                                value={goals.daily_protein}
                                onChange={handleChange}
                                min="30"
                                max="500"
                                step="5"
                                required
                                disabled={loading}
                            />
                            <small className="goal-text">Recommended: 0.8-2.2g per kg body weight</small>
                        </div>

                        <div className="form-group">
                            <label>Daily Carbohydrates Goal (g)</label>
                            <input
                                type="number"
                                name="daily_carbs"
                                value={goals.daily_carbs}
                                onChange={handleChange}
                                min="20"
                                max="800"
                                step="5"
                                required
                                disabled={loading}
                            />
                            <small className="goal-text">Recommended: 45-65% of total calories</small>
                        </div>

                        <div className="form-group">
                            <label>Daily Fat Goal (g)</label>
                            <input
                                type="number"
                                name="daily_fat"
                                value={goals.daily_fat}
                                onChange={handleChange}
                                min="10"
                                max="300"
                                step="5"
                                required
                                disabled={loading}
                            />
                            <small className="goal-text">Recommended: 20-35% of total calories</small>
                        </div>

                        <div className="form-group">
                            <label>Target Weight (lbs) - Optional</label>
                            <input
                                type="number"
                                name="target_weight"
                                value={goals.target_weight}
                                onChange={handleChange}
                                min="50"
                                max="500"
                                step="0.5"
                                placeholder="Enter target weight"
                                disabled={loading}
                            />
                            <small className="goal-text">Leave empty if you don't have a weight goal</small>
                        </div>
                    </div>

                    <div className="flex gap-10">
                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={loading || !hasChanges}
                        >
                            {loading ? 'Updating Goals...' : 'Save Goals'}
                        </button>

                        <button
                            type="button"
                            onClick={resetToDefaults}
                            className="btn-secondary"
                            disabled={loading}
                        >
                            Reset to Defaults
                        </button>

                        <button
                            type="button"
                            onClick={fetchGoals}
                            className="btn-secondary"
                            disabled={loading}
                        >
                            {loading ? 'Loading...' : 'Refresh'}
                        </button>
                    </div>
                </form>
            </div>

            <div className="totals mt-20">
                <h3>Macro Analysis</h3>
                <div className="flex gap-20" style={{ flexWrap: 'wrap', marginBottom: '15px' }}>
                    <div>
                        <strong>Protein:</strong> {goals.daily_protein}g ({macroPercentages.protein}%)
                        <div className="goal-text">{(goals.daily_protein * 4).toFixed(0)} calories</div>
                    </div>
                    <div>
                        <strong>Carbs:</strong> {goals.daily_carbs}g ({macroPercentages.carbs}%)
                        <div className="goal-text">{(goals.daily_carbs * 4).toFixed(0)} calories</div>
                    </div>
                    <div>
                        <strong>Fat:</strong> {goals.daily_fat}g ({macroPercentages.fat}%)
                        <div className="goal-text">{(goals.daily_fat * 9).toFixed(0)} calories</div>
                    </div>
                </div>

                <div className="flex-between">
                    <div>
                        <strong>Total from Macros:</strong> {totalMacroCalories.toFixed(0)} calories
                    </div>
                    <div>
                        <strong>Calorie Goal:</strong> {goals.daily_calories} calories
                    </div>
                </div>

                {calorieDiscrepancy > 50 && (
                    <div className="error mt-10">
                        <strong>Warning:</strong> Your macro calories ({totalMacroCalories.toFixed(0)})
                        don't match your calorie goal ({goals.daily_calories}).
                        Difference: {calorieDiscrepancy.toFixed(0)} calories.
                    </div>
                )}

                {calorieDiscrepancy <= 50 && calorieDiscrepancy > 0 && (
                    <div className="success mt-10">
                        Your macro and calorie goals are well balanced!
                        (Difference: {calorieDiscrepancy.toFixed(0)} calories)
                    </div>
                )}
            </div>

            <div className="totals mt-20">
                <h3>Quick Goal Presets</h3>
                <div className="flex gap-10" style={{ flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        onClick={() => {
                            setGoals({
                                daily_calories: 1800,
                                daily_protein: 130,
                                daily_carbs: 180,
                                daily_fat: 60,
                                target_weight: goals.target_weight
                            });
                            setHasChanges(true);
                        }}
                        className="btn-secondary btn-small"
                    >
                        Weight Loss (1800 cal)
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setGoals({
                                daily_calories: 2200,
                                daily_protein: 165,
                                daily_carbs: 275,
                                daily_fat: 73,
                                target_weight: goals.target_weight
                            });
                            setHasChanges(true);
                        }}
                        className="btn-secondary btn-small"
                    >
                        Maintenance (2200 cal)
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setGoals({
                                daily_calories: 2800,
                                daily_protein: 210,
                                daily_carbs: 350,
                                daily_fat: 93,
                                target_weight: goals.target_weight
                            });
                            setHasChanges(true);
                        }}
                        className="btn-secondary btn-small"
                    >
                        Muscle Gain (2800 cal)
                    </button>

                    <button
                        type="button"
                        onClick={() => {
                            setGoals({
                                daily_calories: 3200,
                                daily_protein: 240,
                                daily_carbs: 400,
                                daily_fat: 107,
                                target_weight: goals.target_weight
                            });
                            setHasChanges(true);
                        }}
                        className="btn-secondary btn-small"
                    >
                        Bulking (3200 cal)
                    </button>
                </div>
                <p className="goal-text mt-10">
                    These are general recommendations. Adjust based on your individual needs,
                    activity level, age, gender, and consultation with healthcare professionals.
                </p>
            </div>
        </div>
    );
});

Goals.displayName = 'Goals';

export default Goals;