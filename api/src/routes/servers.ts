import { Router } from 'express';
import { query } from '../utils/db';
import { Server } from '../types';

const router = Router();

// Get all servers
router.get('/', async (req, res) => {
    try {
        const result = await query<Server>('SELECT * FROM servers');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching servers:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get server by ID
router.get('/:id', async (req, res) => {
    try {
        const result = await query<Server>('SELECT * FROM servers WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Server not found' });
            return;
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching server:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create new server
router.post('/', async (req, res) => {
    const { name, ip, port, users = [], channels = [] } = req.body;

    // Validate port
    if (!port || port <= 0 || port >= 65536) {
        res.status(500).json({ error: 'Invalid port number' });
        return;
    }

    try {
        const result = await query<Server>(
            'INSERT INTO servers (name, ip, port, users, channels) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [name, ip, port, users, channels]
        );
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating server:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update server
router.put('/:id', async (req, res) => {
    const { name, ip, port, users, channels } = req.body;

    // Validate port if provided
    if (port !== undefined && (port <= 0 || port >= 65536)) {
        res.status(500).json({ error: 'Invalid port number' });
        return;
    }

    try {
        const result = await query<Server>(
            'UPDATE servers SET name = $1, ip = $2, port = $3, users = $4, channels = $5 WHERE id = $6 RETURNING *',
            [name, ip, port, users || [], channels || [], req.params.id]
        );
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Server not found' });
            return;
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating server:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete server
router.delete('/:id', async (req, res) => {
    try {
        const result = await query('DELETE FROM servers WHERE id = $1 RETURNING *', [req.params.id]);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Server not found' });
            return;
        }
        res.json({ message: 'Server deleted successfully' });
    } catch (error) {
        console.error('Error deleting server:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;