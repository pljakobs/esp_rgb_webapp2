const getWhenLabel = (t, whenKey) => {
  if (whenKey === "always") {
    return t("telemetryTable.when.always");
  }
  if (whenKey === "afterUnexpectedReboot") {
    return t("telemetryTable.when.afterUnexpectedReboot");
  }
  return t("telemetryTable.when.afterExceptionReboot");
};

export const getTelemetryData = (t) => {
  const telemetryDataColumns = [
    {
      name: "col1",
      label: t("telemetryTable.columns.field"),
      field: "col1",
      align: "left",
    },
    {
      name: "col2",
      label: t("telemetryTable.columns.description"),
      field: "col2",
      align: "left",
    },
    {
      name: "col3",
      label: t("telemetryTable.columns.when"),
      field: "col3",
      align: "left",
    },
  ];

  const telemetryDataRows = [
    {
      col1: "id",
      col2: t("telemetryTable.fields.id"),
      col3: getWhenLabel(t, "always"),
    },
    {
      col1: "time",
      col2: t("telemetryTable.fields.time"),
      col3: getWhenLabel(t, "always"),
    },
    {
      col1: "uptime",
      col2: t("telemetryTable.fields.uptime"),
      col3: getWhenLabel(t, "always"),
    },
    {
      col1: "ip",
      col2: t("telemetryTable.fields.ip"),
      col3: getWhenLabel(t, "always"),
    },
    {
      col1: "freeHeap",
      col2: t("telemetryTable.fields.freeHeap"),
      col3: getWhenLabel(t, "always"),
    },
    {
      col1: "minimumfreeHeapRuntime",
      col2: t("telemetryTable.fields.minimumfreeHeapRuntime"),
      col3: getWhenLabel(t, "always"),
    },
    {
      col1: "minimumfreeHeap10min",
      col2: t("telemetryTable.fields.minimumfreeHeap10min"),
      col3: getWhenLabel(t, "always"),
    },
    {
      col1: "heapLowErrUptime",
      col2: t("telemetryTable.fields.heapLowErrUptime"),
      col3: getWhenLabel(t, "always"),
    },
    {
      col1: "heapLowErr10min",
      col2: t("telemetryTable.fields.heapLowErr10min"),
      col3: getWhenLabel(t, "always"),
    },
    {
      col1: "firmware",
      col2: t("telemetryTable.fields.firmware"),
      col3: getWhenLabel(t, "always"),
    },
    {
      col1: "build",
      col2: t("telemetryTable.fields.build"),
      col3: getWhenLabel(t, "always"),
    },
    {
      col1: "soc",
      col2: t("telemetryTable.fields.soc"),
      col3: getWhenLabel(t, "always"),
    },
    {
      col1: "neighbours",
      col2: t("telemetryTable.fields.neighbours"),
      col3: getWhenLabel(t, "always"),
    },
    {
      col1: "mDNS.received",
      col2: t("telemetryTable.fields.mdnsReceived"),
      col3: getWhenLabel(t, "always"),
    },
    {
      col1: "mDNS.replies",
      col2: t("telemetryTable.fields.mdnsReplies"),
      col3: getWhenLabel(t, "always"),
    },
    {
      col1: "reboot.number",
      col2: t("telemetryTable.fields.rebootNumber"),
      col3: getWhenLabel(t, "afterUnexpectedReboot"),
    },
    {
      col1: "reboot.reason",
      col2: t("telemetryTable.fields.rebootReason"),
      col3: getWhenLabel(t, "afterUnexpectedReboot"),
    },
    {
      col1: "reboot.exccause",
      col2: t("telemetryTable.fields.rebootExccause"),
      col3: getWhenLabel(t, "afterExceptionReboot"),
    },
    {
      col1: "reboot.epc1/epc2/epc3",
      col2: t("telemetryTable.fields.rebootEpc"),
      col3: getWhenLabel(t, "afterExceptionReboot"),
    },
    {
      col1: "reboot.excvaddr",
      col2: t("telemetryTable.fields.rebootExcvaddr"),
      col3: getWhenLabel(t, "afterExceptionReboot"),
    },
    {
      col1: "reboot.depc",
      col2: t("telemetryTable.fields.rebootDepc"),
      col3: getWhenLabel(t, "afterExceptionReboot"),
    },
  ];

  return {
    telemetryDataColumns,
    telemetryDataRows,
  };
};
