"""
ROFL TEE Agent Monitoring Log Server

A comprehensive web-based monitoring server that:
1. Collects logs from your TEE Agent via multiple methods
2. Provides REST API endpoints for metrics
3. Serves a real-time dashboard with WebSocket updates
4. Stores metrics in SQLite for historical analysis
5. Provides alerting and notification capabilities

"""

import os
import json
import sqlite3
import asyncio
import logging
import time
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from pathlib import Path
import threading
from collections import defaultdict, deque

# Web framework and WebSocket support
from flask import Flask, request, jsonify, render_template_string
from flask_socketio import SocketIO, emit
import requests

# Background task scheduling
from apscheduler.schedulers.background import BackgroundScheduler

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('monitoring_server')

@dataclass
class LogEntry:
    """Structure for log entries"""
    timestamp: str
    level: str
    logger: str
    message: str
    operation: str = ""
    duration_ms: float = 0.0
    status: str = ""
    metadata: Dict = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}

@dataclass
class Alert:
    """Structure for alerts"""
    id: str
    level: str  # critical, warning, info
    message: str
    timestamp: str
    resolved: bool = False
    metadata: Dict = None
    
    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}

class LogDatabase:
    """SQLite database for storing logs and metrics"""
    
    def __init__(self, db_path: str = "/tmp/rofl_monitoring.db"):
        self.db_path = db_path
        self.init_database()
    
    def init_database(self):
        """Initialize database schema"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Create logs table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                level TEXT NOT NULL,
                logger TEXT NOT NULL,
                message TEXT NOT NULL,
                operation TEXT,
                duration_ms REAL,
                status TEXT,
                metadata TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Create metrics table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS metrics (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                metric_name TEXT NOT NULL,
                metric_value REAL NOT NULL,
                metadata TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Create alerts table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS alerts (
                id TEXT PRIMARY KEY,
                level TEXT NOT NULL,
                message TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                resolved BOOLEAN DEFAULT FALSE,
                metadata TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Create indexes for better performance
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_logs_operation ON logs(operation)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_metrics_name ON metrics(metric_name)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_alerts_level ON alerts(level)')
        
        conn.commit()
        conn.close()
        
        logger.info(f"Database initialized: {self.db_path}")
    
    def insert_log(self, log_entry: LogEntry):
        """Insert a log entry"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO logs (timestamp, level, logger, message, operation, duration_ms, status, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            log_entry.timestamp,
            log_entry.level,
            log_entry.logger,
            log_entry.message,
            log_entry.operation,
            log_entry.duration_ms,
            log_entry.status,
            json.dumps(log_entry.metadata)
        ))
        
        conn.commit()
        conn.close()
    
    def insert_metric(self, name: str, value: float, metadata: Dict = None):
        """Insert a metric"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT INTO metrics (timestamp, metric_name, metric_value, metadata)
            VALUES (?, ?, ?, ?)
        ''', (
            datetime.now().isoformat(),
            name,
            value,
            json.dumps(metadata or {})
        ))
        
        conn.commit()
        conn.close()
    
    def get_recent_logs(self, limit: int = 100, operation: str = None) -> List[Dict]:
        """Get recent log entries"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        query = '''
            SELECT timestamp, level, logger, message, operation, duration_ms, status, metadata
            FROM logs
        '''
        params = []
        
        if operation:
            query += ' WHERE operation = ?'
            params.append(operation)
        
        query += ' ORDER BY created_at DESC LIMIT ?'
        params.append(limit)
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        logs = []
        for row in rows:
            logs.append({
                'timestamp': row[0],
                'level': row[1],
                'logger': row[2],
                'message': row[3],
                'operation': row[4],
                'duration_ms': row[5],
                'status': row[6],
                'metadata': json.loads(row[7]) if row[7] else {}
            })
        
        conn.close()
        return logs
    
    def get_metrics_summary(self, hours: int = 24) -> Dict:
        """Get metrics summary for the last N hours"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        since = (datetime.now() - timedelta(hours=hours)).isoformat()
        
        # Get operation counts
        cursor.execute('''
            SELECT operation, COUNT(*) as count, AVG(duration_ms) as avg_duration
            FROM logs 
            WHERE timestamp > ? AND operation != ''
            GROUP BY operation
        ''', (since,))
        
        operations = {}
        for row in cursor.fetchall():
            operations[row[0]] = {
                'count': row[1],
                'avg_duration_ms': row[2] or 0
            }
        
        # Get error counts
        cursor.execute('''
            SELECT level, COUNT(*) as count
            FROM logs 
            WHERE timestamp > ?
            GROUP BY level
        ''', (since,))
        
        levels = {}
        for row in cursor.fetchall():
            levels[row[0]] = row[1]
        
        conn.close()
        
        return {
            'operations': operations,
            'log_levels': levels,
            'time_window_hours': hours
        }

class LogCollector:
    """Collects logs from various sources"""
    
    def __init__(self, database: LogDatabase, socketio: SocketIO):
        self.database = database
        self.socketio = socketio
        self.log_buffer = deque(maxlen=1000)  # Keep last 1000 logs in memory
        self.alerts = {}
        self.running = False
        
    def start_collection(self):
        """Start log collection"""
        self.running = True
        
        # Start file monitoring thread
        file_thread = threading.Thread(target=self._monitor_log_file, daemon=True)
        file_thread.start()
        
        # Start HTTP endpoint monitoring thread
        http_thread = threading.Thread(target=self._monitor_http_endpoint, daemon=True)
        http_thread.start()
        
        logger.info("Log collection started")
    
    def _monitor_log_file(self):
        """Monitor log file for new entries"""
        log_file_path = "/var/log/kitty_ico_agent.log"
        
        if not os.path.exists(log_file_path):
            logger.warning(f"Log file not found: {log_file_path}")
            return
        
        # Follow the log file like 'tail -f'
        with open(log_file_path, 'r') as f:
            # Go to end of file
            f.seek(0, 2)
            
            while self.running:
                line = f.readline()
                if line:
                    self._process_log_line(line.strip())
                else:
                    time.sleep(0.1)
    
    def _monitor_http_endpoint(self):
        """Monitor TEE Agent HTTP endpoint for metrics"""
        agent_url = os.getenv('TEE_AGENT_URL', 'http://localhost:8080')
        
        while self.running:
            try:
                # Try to get metrics from agent
                response = requests.get(f"{agent_url}/metrics", timeout=5)
                if response.status_code == 200:
                    metrics = response.json()
                    self._process_metrics(metrics)
                
                time.sleep(30)  # Check every 30 seconds
                
            except Exception as e:
                logger.debug(f"Failed to fetch metrics from agent: {e}")
                time.sleep(60)  # Wait longer on error
    
    def _process_log_line(self, line: str):
        """Process a single log line"""
        try:
            # Try to parse as JSON (structured log)
            log_data = json.loads(line)
            
            log_entry = LogEntry(
                timestamp=log_data.get('timestamp', ''),
                level=log_data.get('level', 'INFO'),
                logger=log_data.get('logger', 'unknown'),
                message=log_data.get('message', ''),
                operation=log_data.get('operation', ''),
                duration_ms=log_data.get('duration_ms', 0.0),
                status=log_data.get('status', ''),
                metadata=log_data.get('metadata', {})
            )
            
            # Store in database
            self.database.insert_log(log_entry)
            
            # Add to memory buffer
            self.log_buffer.append(asdict(log_entry))
            
            # Send to WebSocket clients
            self.socketio.emit('new_log', asdict(log_entry))
            
            # Check for alerts
            self._check_for_alerts(log_entry)
            
        except json.JSONDecodeError:
            # Handle plain text logs
            log_entry = LogEntry(
                timestamp=datetime.now().isoformat(),
                level='INFO',
                logger='kitty_ico_agent',
                message=line,
                metadata={}
            )
            
            self.database.insert_log(log_entry)
            self.log_buffer.append(asdict(log_entry))
            self.socketio.emit('new_log', asdict(log_entry))
    
    def _process_metrics(self, metrics: Dict):
        """Process metrics from agent"""
        try:
            # Extract key metrics
            tee_metrics = metrics.get('tee_metrics', {})
            blockchain_metrics = metrics.get('blockchain_metrics', {})
            
            # Store key metrics
            self.database.insert_metric('bids_processed', tee_metrics.get('bids_processed', 0))
            self.database.insert_metric('settlements_processed', tee_metrics.get('settlements_processed', 0))
            self.database.insert_metric('openai_api_calls', tee_metrics.get('openai_api_calls', 0))
            self.database.insert_metric('avg_pitch_score', tee_metrics.get('avg_pitch_score', 0))
            
            # Send metrics update to WebSocket clients
            self.socketio.emit('metrics_update', {
                'timestamp': datetime.now().isoformat(),
                'metrics': metrics
            })
            
        except Exception as e:
            logger.error(f"Failed to process metrics: {e}")
    
    def _check_for_alerts(self, log_entry: LogEntry):
        """Check log entry for alert conditions"""
        alerts_to_create = []
        
        # Error alerts
        if log_entry.level == 'ERROR':
            alert_id = f"error_{int(time.time())}"
            alert = Alert(
                id=alert_id,
                level='critical',
                message=f"Error in {log_entry.operation}: {log_entry.message}",
                timestamp=log_entry.timestamp,
                metadata={'operation': log_entry.operation, 'logger': log_entry.logger}
            )
            alerts_to_create.append(alert)
        
        # Performance alerts
        if log_entry.duration_ms > 5000:  # Operations taking longer than 5 seconds
            alert_id = f"performance_{log_entry.operation}_{int(time.time())}"
            alert = Alert(
                id=alert_id,
                level='warning',
                message=f"Slow operation: {log_entry.operation} took {log_entry.duration_ms:.0f}ms",
                timestamp=log_entry.timestamp,
                metadata={'operation': log_entry.operation, 'duration_ms': log_entry.duration_ms}
            )
            alerts_to_create.append(alert)
        
        # TEE-specific alerts
        if log_entry.operation == 'tee_mode_detection' and 'mock' in log_entry.message:
            alert_id = f"tee_mode_{int(time.time())}"
            alert = Alert(
                id=alert_id,
                level='warning',
                message="TEE running in mock mode, not production",
                timestamp=log_entry.timestamp,
                metadata={'tee_mode': 'mock'}
            )
            alerts_to_create.append(alert)
        
        # Create alerts
        for alert in alerts_to_create:
            self.alerts[alert.id] = alert
            self.socketio.emit('new_alert', asdict(alert))
            logger.warning(f"Alert created: {alert.message}")
    
    def get_recent_logs(self, limit: int = 100) -> List[Dict]:
        """Get recent logs from memory buffer"""
        return list(self.log_buffer)[-limit:]
    
    def get_active_alerts(self) -> List[Dict]:
        """Get active alerts"""
        return [asdict(alert) for alert in self.alerts.values() if not alert.resolved]

# Flask application
app = Flask(__name__)
app.config['SECRET_KEY'] = 'rofl_monitoring_secret_key'
socketio = SocketIO(app, cors_allowed_origins="*")

# Initialize components
database = LogDatabase()
log_collector = LogCollector(database, socketio)

# Dashboard HTML template
DASHBOARD_TEMPLATE = '''
<!DOCTYPE html>
<html>
<head>
    <title>ROFL TEE Agent Monitor</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.0.1/socket.io.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .header { background: #2c3e50; color: white; padding: 20px; margin: -20px -20px 20px -20px; }
        .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 20px; }
        .metric-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .metric-value { font-size: 2em; font-weight: bold; color: #3498db; }
        .metric-label { color: #7f8c8d; text-transform: uppercase; font-size: 0.8em; }
        .logs-container { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .log-entry { padding: 10px; border-bottom: 1px solid #ecf0f1; font-family: monospace; font-size: 0.9em; }
        .log-entry.ERROR { background: #ffe6e6; }
        .log-entry.WARNING { background: #fff3cd; }
        .log-entry.INFO { background: #e7f3ff; }
        .alerts-container { background: #e74c3c; color: white; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
        .alert { margin-bottom: 10px; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 4px; }
        .status-indicator { display: inline-block; width: 12px; height: 12px; border-radius: 50%; margin-right: 8px; }
        .status-connected { background: #27ae60; }
        .status-disconnected { background: #e74c3c; }
        .chart-container { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔒 ROFL TEE Agent Monitor</h1>
        <p>Real-time monitoring for Kitty ICO TEE Agent</p>
    </div>
    
    <div id="alerts-container" class="alerts-container" style="display: none;">
        <h3>🚨 Active Alerts</h3>
        <div id="alerts-list"></div>
    </div>
    
    <div class="metrics-grid">
        <div class="metric-card">
            <div class="metric-value" id="bids-processed">0</div>
            <div class="metric-label">Bids Processed</div>
        </div>
        <div class="metric-card">
            <div class="metric-value" id="settlements-processed">0</div>
            <div class="metric-label">Settlements Processed</div>
        </div>
        <div class="metric-card">
            <div class="metric-value" id="avg-pitch-score">0</div>
            <div class="metric-label">Avg Pitch Score</div>
        </div>
        <div class="metric-card">
            <div class="metric-value" id="openai-calls">0</div>
            <div class="metric-label">OpenAI API Calls</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">
                <span class="status-indicator" id="tee-status"></span>
                <span id="tee-mode">Unknown</span>
            </div>
            <div class="metric-label">TEE Mode</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">
                <span class="status-indicator" id="blockchain-status"></span>
                <span id="connection-status">Checking...</span>
            </div>
            <div class="metric-label">Blockchain Status</div>
        </div>
    </div>
    
    <div class="chart-container">
        <h3>Operations Timeline</h3>
        <canvas id="operations-chart" width="400" height="100"></canvas>
    </div>
    
    <div class="logs-container">
        <h3>📋 Live Logs</h3>
        <div id="logs-list" style="max-height: 500px; overflow-y: auto;"></div>
    </div>

    <script>
        const socket = io();
        const logs = [];
        const alerts = [];
        let operationsChart;
        
        // Initialize chart
        const ctx = document.getElementById('operations-chart').getContext('2d');
        operationsChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Operations/min',
                    data: [],
                    borderColor: '#3498db',
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    x: { display: false },
                    y: { beginAtZero: true }
                }
            }
        });
        
        // Socket event handlers
        socket.on('new_log', function(log) {
            logs.unshift(log);
            if (logs.length > 100) logs.pop();
            updateLogsDisplay();
        });
        
        socket.on('new_alert', function(alert) {
            alerts.unshift(alert);
            updateAlertsDisplay();
        });
        
        socket.on('metrics_update', function(data) {
            updateMetrics(data.metrics);
        });
        
        function updateLogsDisplay() {
            const container = document.getElementById('logs-list');
            container.innerHTML = logs.map(log => 
                `<div class="log-entry ${log.level}">
                    <strong>${log.timestamp}</strong> 
                    [${log.level}] 
                    ${log.operation ? `(${log.operation})` : ''} 
                    ${log.message}
                    ${log.duration_ms ? ` - ${log.duration_ms.toFixed(1)}ms` : ''}
                </div>`
            ).join('');
        }
        
        function updateAlertsDisplay() {
            const container = document.getElementById('alerts-container');
            const alertsList = document.getElementById('alerts-list');
            
            const activeAlerts = alerts.filter(a => !a.resolved);
            
            if (activeAlerts.length > 0) {
                container.style.display = 'block';
                alertsList.innerHTML = activeAlerts.map(alert =>
                    `<div class="alert">
                        <strong>${alert.level.toUpperCase()}</strong>: ${alert.message}
                        <small> - ${alert.timestamp}</small>
                    </div>`
                ).join('');
            } else {
                container.style.display = 'none';
            }
        }
        
        function updateMetrics(metrics) {
            const teeMetrics = metrics.tee_metrics || {};
            const blockchainMetrics = metrics.blockchain_metrics || {};
            
            document.getElementById('bids-processed').textContent = teeMetrics.bids_processed || 0;
            document.getElementById('settlements-processed').textContent = teeMetrics.settlements_processed || 0;
            document.getElementById('avg-pitch-score').textContent = (teeMetrics.avg_pitch_score || 0).toFixed(1);
            document.getElementById('openai-calls').textContent = teeMetrics.openai_api_calls || 0;
            document.getElementById('tee-mode').textContent = teeMetrics.tee_mode || 'Unknown';
            
            // Update status indicators
            const teeStatus = document.getElementById('tee-status');
            const teeMode = teeMetrics.tee_mode || 'unknown';
            teeStatus.className = `status-indicator ${teeMode.includes('production') ? 'status-connected' : 'status-disconnected'}`;
            
            const blockchainStatus = document.getElementById('blockchain-status');
            const connectionStatus = blockchainMetrics.sapphire_connection_status === 'connected' ? 'Connected' : 'Disconnected';
            document.getElementById('connection-status').textContent = connectionStatus;
            blockchainStatus.className = `status-indicator ${connectionStatus === 'Connected' ? 'status-connected' : 'status-disconnected'}`;
            
            // Update chart
            const now = new Date().toLocaleTimeString();
            operationsChart.data.labels.push(now);
            operationsChart.data.datasets[0].data.push(teeMetrics.bids_processed || 0);
            
            if (operationsChart.data.labels.length > 20) {
                operationsChart.data.labels.shift();
                operationsChart.data.datasets[0].data.shift();
            }
            
            operationsChart.update();
        }
        
        // Load initial data
        fetch('/api/logs')
            .then(response => response.json())
            .then(data => {
                logs.push(...data);
                updateLogsDisplay();
            });
            
        fetch('/api/alerts')
            .then(response => response.json())
            .then(data => {
                alerts.push(...data);
                updateAlertsDisplay();
            });
    </script>
</body>
</html>
'''

# REST API Routes
@app.route('/')
def dashboard():
    """Serve the monitoring dashboard"""
    return render_template_string(DASHBOARD_TEMPLATE)

@app.route('/api/logs')
def get_logs():
    """Get recent logs"""
    limit = request.args.get('limit', 100, type=int)
    operation = request.args.get('operation')
    
    if operation:
        logs = database.get_recent_logs(limit, operation)
    else:
        logs = log_collector.get_recent_logs(limit)
    
    return jsonify(logs)

@app.route('/api/metrics')
def get_metrics():
    """Get metrics summary"""
    hours = request.args.get('hours', 24, type=int)
    summary = database.get_metrics_summary(hours)
    return jsonify(summary)

@app.route('/api/alerts')
def get_alerts():
    """Get active alerts"""
    alerts = log_collector.get_active_alerts()
    return jsonify(alerts)

@app.route('/api/health')
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'log_collector_running': log_collector.running,
        'recent_logs_count': len(log_collector.get_recent_logs(10))
    })

@app.route('/api/agent/status')
def get_agent_status():
    """Proxy to get agent status"""
    try:
        agent_url = os.getenv('TEE_AGENT_URL', 'http://localhost:8080')
        response = requests.get(f"{agent_url}/status", timeout=5)
        
        if response.status_code == 200:
            return jsonify(response.json())
        else:
            return jsonify({'error': 'Agent not available'}), 503
    except Exception as e:
        return jsonify({'error': str(e)}), 503

# WebSocket Events
@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    logger.info('Client connected to monitoring server')
    emit('connected', {'message': 'Connected to ROFL TEE Agent Monitor'})

@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection"""
    logger.info('Client disconnected from monitoring server')

@socketio.on('request_logs')
def handle_request_logs(data):
    """Handle request for logs"""
    limit = data.get('limit', 50)
    logs = log_collector.get_recent_logs(limit)
    emit('logs_data', logs)

# Background tasks
def cleanup_old_data():
    """Clean up old data from database"""
    try:
        conn = sqlite3.connect(database.db_path)
        cursor = conn.cursor()
        
        # Keep only last 7 days of logs
        cutoff = (datetime.now() - timedelta(days=7)).isoformat()
        cursor.execute('DELETE FROM logs WHERE timestamp < ?', (cutoff,))
        
        # Keep only last 30 days of metrics
        cutoff = (datetime.now() - timedelta(days=30)).isoformat()
        cursor.execute('DELETE FROM metrics WHERE timestamp < ?', (cutoff,))
        
        conn.commit()
        conn.close()
        
        logger.info("Old data cleaned up")
    except Exception as e:
        logger.error(f"Failed to cleanup old data: {e}")

def main():
    """Main entry point"""
    logger.info("Starting ROFL TEE Agent Monitoring Server...")
    
    # Start log collection
    log_collector.start_collection()
    
    # Schedule background cleanup
    scheduler = BackgroundScheduler()
    scheduler.add_job(cleanup_old_data, 'interval', hours=24)
    scheduler.start()
    
    # Get configuration
    host = os.getenv('MONITOR_HOST', '0.0.0.0')
    port = int(os.getenv('MONITOR_PORT', 5000))
    debug = os.getenv('MONITOR_DEBUG', 'False').lower() == 'true'
    
    logger.info(f"Monitor server starting on {host}:{port}")
    logger.info(f"Dashboard will be available at http://{host}:{port}")
    
    try:
        # Run the server
        socketio.run(app, host=host, port=port, debug=debug)
    except KeyboardInterrupt:
        logger.info("Shutting down monitoring server...")
    finally:
        scheduler.shutdown()

if __name__ == "__main__":
    main()