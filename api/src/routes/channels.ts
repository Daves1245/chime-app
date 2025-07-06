import { Router } from 'express';
import { query } from '../utils/db';
import { Channel } from '../types';

const router = Router();

// Get all channels
router.get('/', async (req, res) => {
    try {
        const result = await query<Channel>('SELECT * FROM channels');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching channels:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get channels by server ID
router.get('/server/:serverId', async (req, res) => {
    try {
        const result = await query<Channel>('SELECT * FROM channels WHERE server_id = $1', [req.params.serverId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching channels:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get channel by ID
router.get('/:id', async (req, res) => {
    try {
        const result = await query<Channel>('SELECT * FROM channels WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Channel not found' });
            return;
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error fetching channel:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Create new channel
router.post('/', async (req, res) => {
    const { name, server_id } = req.body;
    try {
        // First check if server exists
        const serverResult = await query('SELECT id FROM servers WHERE id = $1', [server_id]);
        if (serverResult.rows.length === 0) {
            res.status(500).json({ error: 'Server not found' });
            return;
        }

        const result = await query<Channel>(
            'INSERT INTO channels (name, server_id) VALUES ($1, $2) RETURNING *',
            [name, server_id]
        );
        
        // Update the server's channels array
        await query(
            'UPDATE servers SET channels = array_append(channels, $1) WHERE id = $2',
            [result.rows[0].id, server_id]
        );
        
        res.status(201).json(result.rows[0]);
    } catch (error) {
        console.error('Error creating channel:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update channel
router.put('/:id', async (req, res) => {
    const { name } = req.body;
    try {
        const result = await query<Channel>(
            'UPDATE channels SET name = $1 WHERE id = $2 RETURNING *',
            [name, req.params.id]
        );
        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Channel not found' });
            return;
        }
        res.json(result.rows[0]);
    } catch (error) {
        console.error('Error updating channel:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete channel
router.delete('/:id', async (req, res) => {
    try {
        // Get the channel's server_id before deleting
        const channelResult = await query<Channel>('SELECT server_id FROM channels WHERE id = $1', [req.params.id]);
        if (channelResult.rows.length === 0) {
            res.status(404).json({ error: 'Channel not found' });
            return;
        }

        const server_id = channelResult.rows[0].server_id;

        // Delete the channel
        await query('DELETE FROM channels WHERE id = $1', [req.params.id]);

        // Update the server's channels array
        await query(
            'UPDATE servers SET channels = array_remove(channels, $1) WHERE id = $2',
            [req.params.id, server_id]
        );

        res.json({ message: 'Channel deleted successfully' });
    } catch (error) {
        console.error('Error deleting channel:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;