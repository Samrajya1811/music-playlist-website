import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const API_BASE_URL = 'http://localhost:5000/api';

// API functions
const api = {
  uploadSong: async (formData) => {
    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      body: formData
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Upload failed');
    }
    return response.json();
  },
  
  getSongs: async (searchTerm = '') => {
    const url = searchTerm ? 
      `${API_BASE_URL}/songs?search=${encodeURIComponent(searchTerm)}` : 
      `${API_BASE_URL}/songs`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Failed to fetch songs');
    }
    return response.json();
  },

  deleteSong: async (songId) => {
    const response = await fetch(`${API_BASE_URL}/songs/${songId}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      throw new Error('Failed to delete song');
    }
    return response.json();
  }
};

// File Upload Component
const FileUpload = ({ onUploadSuccess }) => {
  const [file, setFile] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    artist: '',
    album: '',
    duration: ''
  });
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState('');

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    
    if (selectedFile && !formData.title) {
      const filename = selectedFile.name.replace(/\.[^/.]+$/, "");
      setFormData(prev => ({ ...prev, title: filename }));
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!file || !formData.title || !formData.artist) {
      setStatus('Please fill in all required fields and select a file');
      return;
    }

    setUploading(true);
    setStatus('');

    const uploadData = new FormData();
    uploadData.append('audioFile', file);
    uploadData.append('title', formData.title);
    uploadData.append('artist', formData.artist);
    uploadData.append('album', formData.album);
    uploadData.append('duration', formData.duration || '180');

    try {
      const response = await api.uploadSong(uploadData);
      setStatus('Upload successful!');
      setFile(null);
      setFormData({ title: '', artist: '', album: '', duration: '' });
      
      const fileInput = document.getElementById('audioFile');
      if (fileInput) fileInput.value = '';
      
      if (onUploadSuccess) {
        onUploadSuccess(response.song);
      }
      
      setTimeout(() => setStatus(''), 3000);
    } catch (error) {
      setStatus('Upload failed: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="upload-section">
      <h2 className="section-title">Upload New Song</h2>
      
      <form onSubmit={handleSubmit} className="upload-form">
        <div className="file-input-wrapper">
          <input
            type="file"
            id="audioFile"
            accept="audio/*"
            onChange={handleFileChange}
            disabled={uploading}
            className="file-input"
          />
          <label htmlFor="audioFile" className="file-label">
            {file ? file.name : 'Choose audio file or drag it here'}
          </label>
        </div>
        
        <div className="form-group">
          <label>Song Title *</label>
          <input
            type="text"
            name="title"
            value={formData.title}
            onChange={handleInputChange}
            disabled={uploading}
            placeholder="Enter song title"
            className="form-input"
            required
          />
        </div>
        
        <div className="form-group">
          <label>Artist *</label>
          <input
            type="text"
            name="artist"
            value={formData.artist}
            onChange={handleInputChange}
            disabled={uploading}
            placeholder="Enter artist name"
            className="form-input"
            required
          />
        </div>
        
        <div className="form-group">
          <label>Album</label>
          <input
            type="text"
            name="album"
            value={formData.album}
            onChange={handleInputChange}
            disabled={uploading}
            placeholder="Enter album name"
            className="form-input"
          />
        </div>
        
        <div className="form-group">
          <label>Duration (seconds)</label>
          <input
            type="number"
            name="duration"
            value={formData.duration}
            onChange={handleInputChange}
            disabled={uploading}
            placeholder="Duration in seconds"
            className="form-input"
            min="1"
          />
        </div>
        
        <button type="submit" disabled={uploading} className="btn btn-primary">
          {uploading ? 'Uploading...' : 'Upload Song'}
        </button>
        
        {status && (
          <div className={`status-message ${status.includes('successful') ? 'status-success' : 'status-error'}`}>
            {status}
          </div>
        )}
      </form>
    </div>
  );
};

// Song List Component
const SongList = ({ onSongSelect, currentSong, refreshTrigger, onSongDelete }) => {
  const [songs, setSongs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchSongs = async () => {
    try {
      const response = await api.getSongs(searchTerm);
      setSongs(response);
    } catch (error) {
      console.error('Error fetching songs:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSongs();
  }, [searchTerm, refreshTrigger]);

  const handleDelete = async (songId, e) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this song?')) {
      try {
        await api.deleteSong(songId);
        setSongs(songs.filter(song => song._id !== songId));
        if (onSongDelete) onSongDelete(songId);
      } catch (error) {
        console.error('Error deleting song:', error);
        alert('Failed to delete song');
      }
    }
  };

  const formatDuration = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="song-list-section">
        <h2 className="section-title">Music Library</h2>
        <div className="loading">
          <div className="loading-spinner"></div>
          Loading songs...
        </div>
      </div>
    );
  }

  return (
    <div className="song-list-section">
      <h2 className="section-title">Music Library</h2>
      
      <input
        type="text"
        placeholder="Search songs or artists..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="search-input"
      />
      
      <div className="songs-grid">
        {songs.length === 0 ? (
          <div className="empty-state">
            <p>No songs found</p>
            <small>Upload some songs to get started</small>
          </div>
        ) : (
          songs.map(song => (
            <div
              key={song._id}
              className={`song-card ${currentSong && currentSong._id === song._id ? 'active' : ''}`}
              onClick={() => onSongSelect(song)}
            >
              <div className="song-info">
                <div className="song-details">
                  <h4>{song.title}</h4>
                  <p>{song.artist} • {song.album}</p>
                </div>
                <div className="song-actions">
                  <div className="song-duration">
                    {formatDuration(song.duration)}
                  </div>
                  <button 
                    className="delete-btn"
                    onClick={(e) => handleDelete(song._id, e)}
                    title="Delete song"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// Audio Player Component
const AudioPlayer = ({ currentSong }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    if (currentSong) {
      setLoading(true);
      const audio = new Audio(`${API_BASE_URL}/songs/${currentSong._id}/audio`);
      audioRef.current = audio;
      
      const handleLoadedMetadata = () => {
        setDuration(audio.duration);
        setLoading(false);
      };
      
      const handleTimeUpdate = () => {
        setCurrentTime(audio.currentTime);
      };
      
      const handleEnded = () => {
        setIsPlaying(false);
        setCurrentTime(0);
      };
      
      audio.addEventListener('loadedmetadata', handleLoadedMetadata);
      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('ended', handleEnded);
      
      return () => {
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('ended', handleEnded);
        audio.pause();
      };
    }
  }, [currentSong]);

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleProgressClick = (e) => {
    if (audioRef.current) {
      const progressBar = e.currentTarget;
      const clickX = e.clientX - progressBar.getBoundingClientRect().left;
      const width = progressBar.offsetWidth;
      const newTime = (clickX / width) * duration;
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  if (!currentSong) return null;

  return (
    <div className="audio-player">
      <div className="player-content">
        <div className="current-song-info">
          <h4>{currentSong.title}</h4>
          <p>{currentSong.artist} • {currentSong.album}</p>
        </div>
        
        <div className="play-controls">
          <button 
            onClick={togglePlayPause} 
            className="play-btn"
            disabled={loading}
          >
            {loading ? '⏳' : (isPlaying ? '⏸️' : '▶️')}
          </button>
          
          <div className="progress-container">
            <div className="progress-bar" onClick={handleProgressClick}>
              <div 
                className="progress-fill" 
                style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
              />
            </div>
            
            <div className="time-display">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main App Component
const App = () => {
  const [currentSong, setCurrentSong] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleSongSelect = (song) => {
    setCurrentSong(song);
  };

  const handleUploadSuccess = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleSongDelete = (deletedSongId) => {
    if (currentSong && currentSong._id === deletedSongId) {
      setCurrentSong(null);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="logo">🎵 MusicFlow</div>
          <div>by Samrajya - LNMIIT</div>
        </div>
      </header>
      
      <main className="main-content">
        <FileUpload onUploadSuccess={handleUploadSuccess} />
        <SongList 
          onSongSelect={handleSongSelect} 
          currentSong={currentSong}
          refreshTrigger={refreshTrigger}
          onSongDelete={handleSongDelete}
        />
      </main>
      
      <AudioPlayer currentSong={currentSong} />
    </div>
  );
};

export default App;