import { Router } from 'express';
import { query } from '../utils/db';
import { User } from '../types';

const router = Router();

// Get all users
router.get('/', async (req, res) => {
    try {
        const result = await query<User>('SELECT * FROM users');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get user by ID
router.get('/:id', async (req, res) => {
    try {
        const result = await query<User>('SELECT * FROM users WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create new user
router.post('/', async (req, res) => {
    const { username, display_name, avatar_url } = req.body;
    try {
        // Check if username already exists
        const existingUser = await query<User>('SELECT id FROM users WHERE username = $1', [username]);
        if (existingUser.rows.length > 0) {
            res.status(500).json({ error: 'Username already exists' });
            return;
        }

        const result = await query<User>(
            'INSERT INTO users (username, display_name, avatar_url) VALUES ($1, $2, $3) RETURNING *',
            [username, display_name, avatar_url]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update user
router.put('/:id', async (req, res) => {
    const { username, display_name, avatar_url } = req.body;
    try {
        // Check if user exists
        const userExists = await query<User>('SELECT id FROM users WHERE id = $1', [req.params.id]);
        if (userExists.rows.length === 0) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        // Check if new username is already taken by another user
        if (username) {
            const existingUser = await query<User>(
                'SELECT id FROM users WHERE username = $1 AND id != $2',
                [username, req.params.id]
            );
            if (existingUser.rows.length > 0) {
                res.status(500).json({ error: 'Username already exists' });
                return;
            }
        }

        const result = await query<User>(
            'UPDATE users SET username = $1, display_name = $2, avatar_url = $3 WHERE id = $4 RETURNING *',
            [username, display_name, avatar_url, req.params.id]
        );
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete user
router.delete('/:id', async (req, res) => {
    try {
        const result = await query('DELETE FROM users WHERE id = $1 RETURNING *', [req.params.id]);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'User not found' });
            return;
        }
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;