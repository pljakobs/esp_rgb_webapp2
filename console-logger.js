// Console Logger - Captures all console output to downloadable file
// Usage: Run this BEFORE running any other scripts in browser console

(function() {
  const logs = [];
  const startTime = Date.now();
  
  // Store original console methods
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalInfo = console.info;
  const originalDebug = console.debug;
  
  // Helper to format log entry
  function formatLog(level, args) {
    const timestamp = ((Date.now() - startTime) / 1000).toFixed(3);
    const message = Array.from(args).map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch (e) {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');
    return `[${timestamp}s] [${level}] ${message}`;
  }
  
  // Override console methods
  console.log = function(...args) {
    logs.push(formatLog('LOG', args));
    originalLog.apply(console, args);
  };
  
  console.warn = function(...args) {
    logs.push(formatLog('WARN', args));
    originalWarn.apply(console, args);
  };
  
  console.error = function(...args) {
    logs.push(formatLog('ERROR', args));
    originalError.apply(console, args);
  };
  
  console.info = function(...args) {
    logs.push(formatLog('INFO', args));
    originalInfo.apply(console, args);
  };
  
  console.debug = function(...args) {
    logs.push(formatLog('DEBUG', args));
    originalDebug.apply(console, args);
  };
  
  // Add global function to save logs
  window.saveLogs = function(filename = 'console-logs.txt') {
    const content = logs.join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    originalLog(`📥 Saved ${logs.length} log entries to ${filename}`);
  };
  
  // Add global function to clear captured logs
  window.clearLogs = function() {
    const count = logs.length;
    logs.length = 0;
    originalLog(`🗑️ Cleared ${count} captured log entries`);
  };
  
  // Add global function to view log count
  window.logCount = function() {
    originalLog(`📊 Captured ${logs.length} log entries`);
    return logs.length;
  };
  
  originalLog('✅ Console logger initialized!');
  originalLog('📝 Use saveLogs() to download logs to file');
  originalLog('📊 Use logCount() to see captured log count');
  originalLog('🗑️ Use clearLogs() to clear captured logs');
})();
