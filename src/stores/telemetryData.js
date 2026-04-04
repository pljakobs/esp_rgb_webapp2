export const telemetryDataColumns = [
  { name: 'col1', label: 'Field', field: 'col1', align: 'left' },
  { name: 'col2', label: 'Description', field: 'col2', align: 'left' },
  { name: 'col3', label: 'When', field: 'col3', align: 'left' }
];

export const telemetryDataRows = [
  { col1: 'id', col2: 'chip ID of this controller', col3: 'always' },
  { col1: 'time', col2: 'current Unix time (if NTP is configured)', col3: 'always' },
  { col1: 'uptime', col2: 'current uptime in seconds', col3: 'always' },
  { col1: 'ip', col2: 'current IP address', col3: 'always' },
  { col1: 'freeHeap', col2: 'current free heap in bytes', col3: 'always' },
  { col1: 'minimumfreeHeapRuntime', col2: 'lowest free heap since boot', col3: 'always' },
  { col1: 'minimumfreeHeap10min', col2: 'lowest free heap in the current 10 minute window', col3: 'always' },
  { col1: 'heapLowErrUptime', col2: 'number of low-heap guard hits since boot', col3: 'always' },
  { col1: 'heapLowErr10min', col2: 'number of low-heap guard hits in the current 10 minute window', col3: 'always' },
  { col1: 'firmware', col2: 'currently running firmware version', col3: 'always' },
  { col1: 'build', col2: 'firmware build type', col3: 'always' },
  { col1: 'soc', col2: 'system-on-chip type', col3: 'always' },
  { col1: 'neighbours', col2: 'number of visible neighbouring devices', col3: 'always' },
  { col1: 'mDNS.received', col2: 'number of mDNS packets received', col3: 'always' },
  { col1: 'mDNS.replies', col2: 'number of mDNS packets replied to', col3: 'always' },
  { col1: 'reboot.number', col2: 'persistent reboot counter', col3: 'after unexpected reboot' },
  { col1: 'reboot.reason', col2: 'reset reason code', col3: 'after unexpected reboot' },
  { col1: 'reboot.exccause', col2: 'exception cause register', col3: 'after exception reboot' },
  { col1: 'reboot.epc1/epc2/epc3', col2: 'program counter snapshot at reboot', col3: 'after exception reboot' },
  { col1: 'reboot.excvaddr', col2: 'faulting address at exception', col3: 'after exception reboot' },
  { col1: 'reboot.depc', col2: 'exception return program counter', col3: 'after exception reboot' }
];
