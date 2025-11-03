export const telemetryDataColumns = [
  { name: 'col1', label: 'Field', field: 'col1', align: 'left' },
  { name: 'col2', label: 'Description', field: 'col2', align: 'left' },
  { name: 'col3', label: 'When', field: 'col3', align: 'left' }
];

export const telemetryDataRows = [
  { col1: 'time', col2: 'current time (if NTP is configured)', col3: 'always' },
  { col1: 'uptime', col2: 'current uptime in seconds', col3: 'always' },
  { col1: 'firmware', col2: 'currently running firmware version', col3: 'always' },
  { col1: 'reboot reason', col2: 'the reason for the last reboot', col3: 'after an unexpected reboot' },
  {col1: 'soc', col2: 'system on chip type', col3: 'always' },
  { col1: 'neighbours', col2: 'number of visible neighbouring devices', col3: 'always' },
  {col1: 'ip_address', col2: 'current IP address', col3: 'always' },
  { col1: 'reboot CPU info', col2: 'additional information about the CPU at reboot, PC, Registers etc', col3: 'after an unexpected reboot' },
  { col1: 'mDNS_received', col2: 'number of mDNS packages received', col3: 'always'},
  { col1: 'mDNS_replies',col2:'number of mDNS packages processed', col3:'always'}
];
