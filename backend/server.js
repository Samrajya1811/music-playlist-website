const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const { GridFsStorage } = require('multer-gridfs-storage');
const { GridFSBucket, ObjectId } = require('mongodb');
const shortid = require('shortid');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());

// MongoDB Connection
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/musicdatabase';
mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('Failed to connect to MongoDB', err));

// Initialize GridFS
let gfs;
const conn = mongoose.connection;
conn.once('open', () => {
    gfs = new GridFSBucket(conn.db, {
        bucketName: 'uploads'
    });
    console.log('GridFS initialized');
});

// Create storage engine using GridFS
const storage = new GridFsStorage({
    url: mongoURI,
    file: (req, file) => {
        return {
            filename: `${Date.now()}-${file.originalname}`,
            bucketName: 'uploads'
        };
    }
});

// Set up multer to handle file uploads
const upload = multer({ 
    storage,
    limits: {
        fileSize: 50 * 1024 * 1024 // 50MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('audio/')) {
            cb(null, true);
        } else {
            cb(new Error('Only audio files are allowed!'), false);
        }
    }
});

// Song Model
const Song = mongoose.model('Song', new mongoose.Schema({
    title: { type: String, required: true },
    artist: { type: String, required: true },
    songcode: { type: String, required: true, unique: true, default: () => shortid.generate() },
    album: { type: String, default: 'Unknown Album' },
    duration: { type: Number, required: true },
    fileId: { type: mongoose.Schema.Types.ObjectId, ref: 'uploads.files' },
    createdAt: { type: Date, default: Date.now }
}));

// Routes

// File Upload Route
app.post('/api/upload', upload.single('audioFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { title, artist, album, duration } = req.body;
        
        if (!title || !artist || !duration) {
            return res.status(400).json({ error: 'Missing required fields: title, artist, duration' });
        }

        const song = new Song({
            title,
            artist,
            album: album || 'Unknown Album',
            duration: parseInt(duration),
            fileId: req.file.id
        });

        await song.save();
        console.log('Song uploaded successfully:', song.title);
        
        res.json({ 
            message: 'Song uploaded successfully!', 
            song: song,
            fileId: req.file.id 
        });
    } catch (error) {
        console.error('Upload error:', error);
        if (error.code === 11000) {
            return res.status(400).json({ error: 'Song with this code already exists' });
        }
        res.status(500).json({ error: 'Error uploading song: ' + error.message });
    }
});

// Get all songs with optional search filters
app.get('/api/songs', async (req, res) => {
    try {
        const { search } = req.query;
        const filter = {};
        
        if (search) {
            filter.$or = [
                { title: new RegExp(search, 'i') },
                { artist: new RegExp(search, 'i') },
                { album: new RegExp(search, 'i') }
            ];
        }
        
        const songs = await Song.find(filter).sort({ createdAt: -1 });
        res.json(songs);
    } catch (err) {
        console.error('Error fetching songs:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Stream audio file
app.get('/api/songs/:songId/audio', async (req, res) => {
    try {
        const songId = req.params.songId;
        
        if (!ObjectId.isValid(songId)) {
            return res.status(400).json({ error: 'Invalid song ID' });
        }
        
        const song = await Song.findById(songId);
        if (!song || !song.fileId) {
            return res.status(404).json({ error: 'Song or audio file not found' });
        }
        
        res.set({
            'Content-Type': 'audio/mpeg',
            'Accept-Ranges': 'bytes',
            'Cache-Control': 'no-cache'
        });
        
        const downloadStream = gfs.openDownloadStream(song.fileId);
        
        downloadStream.on('error', (error) => {
            console.error('Streaming error:', error);
            if (!res.headersSent) {
                res.status(404).json({ error: 'Audio file not found' });
            }
        });
        
        downloadStream.pipe(res);
        
    } catch (err) {
        console.error('Error streaming audio:', err);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Server error' });
        }
    }
});

// Delete song
app.delete('/api/songs/:songId', async (req, res) => {
    try {
        const songId = req.params.songId;
        
        if (!ObjectId.isValid(songId)) {
            return res.status(400).json({ error: 'Invalid song ID' });
        }
        
        const song = await Song.findById(songId);
        if (!song) {
            return res.status(404).json({ error: 'Song not found' });
        }
        
        if (song.fileId) {
            try {
                await gfs.delete(song.fileId);
            } catch (error) {
                console.error('Error deleting file from GridFS:', error);
            }
        }
        
        await Song.findByIdAndDelete(songId);
        
        console.log('Song deleted:', song.title);
        res.json({ message: 'Song deleted successfully' });
    } catch (err) {
        console.error('Error deleting song:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected'
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Handle 404 for undefined routes
app.use('*', (req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
});