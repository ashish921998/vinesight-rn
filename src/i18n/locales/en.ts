import { GLOSSARY_EN } from '../glossary.en';

export const en = {
  glossary: GLOSSARY_EN,

  common: {
    ok: 'OK',
    cancel: 'Cancel',
    close: 'Close',
    save: 'Save',
    saveChanges: 'Save Changes',
    delete: 'Delete',
    edit: 'Edit',
    back: 'Back',
    goBack: 'Go Back',
    next: 'Next',
    complete: 'Complete',
    skip: 'Skip',
    loading: 'Loading…',
    saving: 'Saving…',
    tryAgain: 'Try Again',
    done: 'Done',
    reset: 'Reset',
    error: 'Error',
    unknownDate: 'Unknown date',
    missing: 'Missing',
    search: 'Search...',
    from: 'From',
    to: 'To',
    selectDate: 'Select date',
    na: 'N/A',
    general: 'General',
    filter: 'Filter',
    clearAll: 'Clear all',
    units: {
      hours: 'hours',
    },
    labels: {
      value: 'Value',
      low: 'Low',
      totalValue: 'Total Value',
      quantity: 'Quantity',
      grade: 'Grade',
      unitPrice: 'Unit Price',
      current: 'Current',
      avg: 'Avg',
      min: 'Min',
      max: 'Max',
    },
    noResultsFound: 'No results found',
    tryDifferentSearchTerm: 'Try a different search term',
    clearSearch: 'Clear search',
    a11y: {
      editWithName: 'Edit {{name}}',
      deleteWithName: 'Delete {{name}}',
    },
    actions: {
      takePhoto: 'Take photo',
      selectImage: 'Select image',
      selectPdf: 'Select PDF',
    },
    alerts: {
      missingInformationTitle: 'Missing information',
      enterQuantityToAdd: 'Please enter the quantity you want to add.',
      enterWorkerNameAndDailyRate: 'Please enter worker name and daily rate.',
      fillAllRequiredFields: 'Please fill in all required fields.',
    },
    errors: {
      missingFarmIdForUpdate: 'Missing farm ID for update.',
      failedToUpdateLog: 'Failed to update log. Please try again.',

      failedToUpdateFarm: 'Failed to update farm. Please try again.',
      failedToCreateFarm: 'Failed to create farm. Please try again.',

      enterAtLeastOneMoistureValue: 'Please enter at least one moisture value.',
      failedToSaveSoilProfile: 'Failed to save soil profile. Please try again.',

      enterAtLeastOneParameterValue: 'Please enter at least one parameter value.',
      failedToSaveLabTest: 'Failed to save lab test. Please try again.',

      failedToUpdateStock: 'Failed to update stock. Please try again.',
      failedToSaveWorker: 'Failed to save worker. Please try again.',

      failedToSaveLogs: 'Failed to save logs. Please try again.',
      enterTaskTitle: 'Please enter a task title.',
      selectFarm: 'Please select a farm.',
      failedToSaveTask: 'Failed to save task. Please try again.',

      failedToLoadAttendance: 'Failed to load attendance.',
      failedToLoadAttendanceData: 'Failed to load attendance data.',
      selectAtLeastOneFarm: 'Please select at least one farm.',

      enterItemName: 'Please enter item name.',
      enterValidQuantity: 'Please enter a valid quantity.',
      enterValidUnitPrice: 'Please enter a valid unit price.',
      failedToSaveItem: 'Failed to save item. Please try again.',

      cannotDeleteLogFarmIdNotFound: 'Cannot delete log: farm ID not found.',
      failedToDeleteLog: 'Failed to delete log. Please try again.',
      farmNotFoundForLog: 'Farm not found for this log.',
      failedToDeleteItem: 'Failed to delete item.',

      failedToDeleteFarm: 'Failed to delete farm.',
      failedToDeleteWorker: 'Failed to delete worker.',

      noReportDataAvailable: 'No report data available.',

      invalidFarm: 'Invalid farm',
    },
  },

  farmDetails: {
    loadingFarm: 'Loading farm…',
    notFound: {
      title: 'Farm Not Found',
    },
    deleteFarmTitle: 'Delete farm',
    deleteFarmBody:
      'Are you sure you want to delete "{{name}}"? This will also delete all associated data including irrigation records, spray records, harvests, expenses, soil profiles, and other farm-related data. This action cannot be undone.',
    errors: {
      completeTaskFailed: 'Failed to complete task.',
      deleteTaskFailed: 'Failed to delete task.',
      deleteFarmFailed: 'Failed to delete farm.',
    },
    header: {
      areaAcres: '{{value}} acres',
      areaAcresUnknown: '— acres',
    },
    pruning: {
      daysShort: '{{count}}d',
    },
    weather: {
      current: 'Current Weather',
      temperature: 'Temperature',
      et0Mm: 'ET0 (mm)',
    },
    stats: {
      logEntriesTitle: 'Log Entries',
      recordsSubtitle: 'Records',
      soilWaterTitle: 'Soil Water',
    },
    water: {
      noIrrigationLoggedYet: 'No irrigation logged yet',
      mmUsed: '{{value}} mm used',
      captionThisSeason: '{{usage}} this season',
      captionLogIrrigation: 'Log irrigation to monitor water use',
    },
    workboard: {
      title: 'WORKBOARD',
      subtitle: 'Quick access to tools and resources.',
      actions: {
        ai: 'AI',
        lab: 'Lab',
        reports: 'Reports',
        soilMoisture: 'Soil Moisture',
      },
    },
    tabs: {
      activities: 'Activities',
      tasks: 'Tasks',
    },
    activities: {
      empty: {
        title: 'No Activities Yet',
        subtitle: 'Start logging activities to see them here',
      },
    },
    tasks: {
      empty: {
        title: 'No Tasks Yet',
        subtitleAndroid: 'Tap the + button to create tasks',
        subtitleIos: 'Use the button below to add a task',
      },
    },
    actions: {
      addActivity: 'Add activity',
      seeAllActivities: 'See all activities',
      seeAllTasks: 'See all tasks',
    },
    a11y: {
      editFarm: 'Edit farm',
      deleteFarm: 'Delete farm',
      showActivities: 'Show activities',
      showTasks: 'Show tasks',
      taskCompleted: 'Task completed',
      markTaskComplete: 'Mark task complete',
      deleteTask: 'Delete task: {{title}}',
      editActivity: 'Edit activity: {{type}}',
      deleteActivity: 'Delete activity: {{type}}',
    },
  },

  farmCard: {
    status: {
      needsAttention: 'Needs attention',
      healthy: 'Healthy',
    },
    area: {
      acres: '{{value}} acres',
      unknownAcres: '— acres',
    },
    waterBalance: {
      label: 'Water balance',
      value: '{{value}} mm',
      unknown: '—',
    },
    region: {
      label: 'Region',
      unknown: 'Unknown',
    },
    a11y: {
      editFarm: 'Edit {{name}}',
      deleteFarm: 'Delete {{name}}',
    },
  },

  farmForm: {
    title: {
      add: 'Add Farm',
      edit: 'Edit Farm',
    },
    saveLabel: {
      createFarm: 'Create Farm',
    },
    sections: {
      details: 'Farm Details',
      cropType: 'Crop Type',
      variety: 'Variety',
      plantingDate: 'Planting Date',
      plantSpacingOptional: 'Plant Spacing (Optional)',
      irrigationDetailsOptional: 'Irrigation Details (Optional)',
      pruningDateOptional: 'Pruning Date (Optional)',
      locationOptional: 'Location (Optional)',
      soilPropertiesOptional: 'Soil Properties (Optional)',
      soilTexture: 'Soil Texture',
    },
    fields: {
      name: {
        label: 'Farm Name',
        placeholder: 'e.g., Sunset Vineyards',
      },
      region: {
        label: 'Location',
        placeholder: 'e.g., Nashik, Maharashtra',
      },
      area: {
        label: 'Area',
        placeholder: '10',
      },
      vineSpacing: {
        label: 'Vine Spacing',
      },
      rowSpacing: {
        label: 'Row Spacing',
      },
      tankCapacity: {
        label: 'Tank Capacity',
      },
      systemDischarge: {
        label: 'System Discharge',
      },
      pruningDate: {
        label: 'Pruning Date',
        notSet: 'Not set',
      },
      locationName: {
        label: 'Location Name',
        placeholder: 'e.g., North Field',
      },
      latitude: {
        label: 'Latitude',
      },
      longitude: {
        label: 'Longitude',
      },
      elevation: {
        label: 'Elevation',
      },
      bulkDensity: {
        label: 'Bulk Density',
      },
      cationExchangeCapacity: {
        label: 'Cation Exchange Capacity',
      },
      soilWaterRetention: {
        label: 'Soil Water Retention',
      },
      sandPercentage: {
        label: 'Sand',
      },
      siltPercentage: {
        label: 'Silt',
      },
      clayPercentage: {
        label: 'Clay',
      },
    },
    cropOptions: {
      grapes: {
        label: 'Grapes',
        sublabel: 'Vines',
      },
      mango: {
        label: 'Mango',
        sublabel: 'Trees',
      },
      pomegranate: {
        label: 'Pomegranate',
        sublabel: 'Fruit',
      },
      citrus: {
        label: 'Citrus',
        sublabel: 'Trees',
      },
      banana: {
        label: 'Banana',
        sublabel: 'Plants',
      },
      other: {
        label: 'Other',
        sublabel: 'Custom',
      },
    },
    variety: {
      selectPlaceholder: 'Select variety',
      custom: 'Custom',
      customNameLabel: 'Custom Variety Name',
      customNamePlaceholder: 'Enter variety name',
      modalTitle: 'Select Variety',
    },
    plantingDate: {
      selectPlaceholder: 'Select date',
    },
    location: {
      selectOnMap: 'Select Location on Map',
    },
    soilTexture: {
      selectPlaceholder: 'Select texture',
      modalTitle: 'Select Soil Texture',
      options: {
        sand: 'Sand',
        loamySand: 'Loamy sand',
        sandyLoam: 'Sandy loam',
        loam: 'Loam',
        siltLoam: 'Silt loam',
        silt: 'Silt',
        sandyClayLoam: 'Sandy clay loam',
        clayLoam: 'Clay loam',
        siltyClayLoam: 'Silty clay loam',
        sandyClay: 'Sandy clay',
        siltyClay: 'Silty clay',
        clay: 'Clay',
      },
    },
    soilCompositionWarning:
      'Sand + Silt + Clay should total approximately 100% (currently {{total}}%)',
    infoCardMessage: 'You can always update these details later from your farm settings.',
  },

  logs: {
    screenTitle: 'Farm Logs',
    irrigationDurationHoursShort: '{{hours}}h',
    sprayApplication: 'Spray application',
    harvestDescription: '{{quantityKg}}kg - {{grade}}',
    expenseDescription: '{{cost}} - {{type}}',
    fertigationApplied_one: '{{countFormatted}} fertilizer applied',
    fertigationApplied_other: '{{countFormatted}} fertilizers applied',
    types: {
      irrigation: 'Irrigation',
      spray: 'Spray',
      harvest: 'Harvest',
      expense: 'Expense',
      fertigation: 'Fertigation',
      note: 'Note',
    },
    labels: {
      selectedFarm: 'Selected farm',
    },
    farmPicker: {
      title: 'Select farm',
      allFarms: 'All farms',
      selectFarm: 'Select farm',
      farmsCount_one: '{{count}} farm',
      farmsCount_other: '{{count}} farms',
    },
    search: {
      placeholder: 'Search logs…',
    },
    filters: {
      activityTypes: 'Activity types',
      dateRange: 'Date range',
    },
    empty: {
      title: 'No activity logs found',
      subtitleFiltered: 'Try adjusting your filters',
      subtitleDefault: 'Start logging activities to see them here',
    },
    pagination: {
      showing: 'Showing {{start}}-{{end}} of {{total}}',
      perPage: '{{count}} per page',
      recordsPerPage: 'Records per page',
    },
    datePicker: {
      fromTitle: 'Select from date',
      toTitle: 'Select to date',
    },
    delete: {
      title: 'Delete log?',
      body: 'Are you sure you want to delete this {{type}} log from {{date}}?',
    },
    cta: {
      addActivity: 'Add activity',
    },
  },

  farms: {
    addFarm: 'Add Farm',
    empty: {
      title: 'No farms yet',
      subtitle: 'Add your first farm to start tracking irrigation, sprays, and harvests.',
    },
    search: {
      placeholder: 'Search farms...',
      found_one: '{{count}} farm found',
      found_other: '{{count}} farms found',
    },
    stats: {
      totalFarms: 'Total farms',
      totalArea: 'Total area',
    },
  },

  entryForm: {
    activityType: 'Activity type',
    selectActivityTypeHint: 'Select an activity type to open the full-screen form.',
    useTemplate: 'Use template',
    addEntry: 'Add entry',
    addLog: 'Add log',
    addTask: 'Add task',
    editTask: 'Edit task',
    selectDate: 'Select date',
    selectDueDate: 'Select Due Date',
    done: 'Done',
    selectTaskType: 'Select task type',
    selectPriority: 'Select priority',
    saveLogs: 'Save logs ({{count}})',
    saveTask: 'Save task',
    drafts_one: '{{count}} draft',
    drafts_other: '{{count}} drafts',
    pendingLogs_one: 'Pending logs ({{count}})',
    pendingLogs_other: 'Pending logs ({{count}})',
    farmLabel: 'Farm *',
    selectFarm: 'Select farm',
    partialSuccess: {
      title: 'Partial Success',
      body_one: '{{count}} log failed to save. Please review and try again.',
      body_other: '{{count}} logs failed to save. Please review and try again.',
    },
    taskForm: {
      titleLabel: 'Title *',
      titlePlaceholder: 'Enter task title',
      descriptionLabel: 'Description',
      descriptionPlaceholder: 'Add details about this task',
      typeLabel: 'Type',
      priorityLabel: 'Priority',
      dueDateLabel: 'Due Date',
      selectDueDate: 'Select due date',
      selectDueDateTitle: 'Select Due Date',
    },
    tabs: {
      log: 'Farm log',
      task: 'Task',
    },
    discardChanges: {
      title: 'Discard changes?',
      taskOnly: 'You have unsaved task changes. Are you sure you want to close?',
      logsOnly: 'You have unsaved logs. Are you sure you want to close?',
      both: 'You have unsaved changes. Are you sure you want to close?',
      discard: 'Discard',
    },
  },

  activityEdit: {
    title: 'Edit log',
    detailsTitle: 'Log details',
    dateLabel: 'Date',
    loadErrorTitle: 'Unable to load activity details.',
    loadErrorBody: 'Please try again from the activity list.',
  },

  sprayForm: {
    title: 'Spray application',
    subtitle: 'Log chemicals and water volume',
    waterVolume: {
      label: 'Water volume',
      placeholder: 'Enter volume',
      unitLiters: 'Liters',
      hint: 'Total water used for the spray mix',
    },
    chemicals: {
      label: 'Chemicals',
      addChemical: 'Add chemical',
      namePlaceholder: 'Chemical name',
      qtyPlaceholder: 'Qty',
      selectUnit: 'Select unit',
    },
    validation: {
      ready: 'Ready to add',
      incomplete: 'Add water volume and at least one chemical',
    },
  },

  analytics: {
    title: 'Analytics',
    labels: {
      irrigationHours: 'Irrigation Hours',
      sprayApplications: 'Spray Applications',
      totalHarvest: 'Total Harvest',
      harvestValue: 'Harvest Value',
      performanceScore: 'Performance Score',
    },
    sections: {
      overview: 'Overview',
      trends: 'Trends',
      comparisons: 'Comparisons',
    },
    timeRanges: {
      last7Days: 'Last 7 Days',
      last30Days: 'Last 30 Days',
      yearToDate: 'Year to Date',
    },
    loading: 'Loading analytics...',
    empty: {
      title: 'No Data Available',
      description: 'Start adding farm activities to see your analytics.',
    },
    metrics: {
      revenue: 'Revenue',
      expenses: 'Expenses',
      roi: 'ROI',
    },
    categories: {
      irrigation: 'Irrigation',
      spray: 'Spray',
      harvest: 'Harvest',
      expense: 'Expense',
      efficiency: 'Efficiency',
    },
  },

  tools: {
    subtitle: 'Calculators and Tools',
    sections: {
      calculators: 'Calculators',
    },
    items: {
      weatherIrrigation: 'Weather & Irrigation',
      madCalculator: 'MAD Calculator',
      systemDischarge: 'System Discharge',
      laiCalculator: 'LAI Calculator',
      nutrientCalculator: 'Nutrient Calculator',
    },
    descriptions: {
      weatherIrrigation:
        'Check weather forecasts and calculate irrigation requirements based on ET0',
      madCalculator: 'Calculate Maximum Allowable Depletion for your crops',
      systemDischarge: 'Calculate and track irrigation system discharge rates',
      laiCalculator: 'Calculate Leaf Area Index for canopy management',
      nutrientCalculator: 'Calculate fertilizer and nutrient requirements based on lab tests',
    },
  },

  calculator: {
    mad: {
      title: 'MAD Calculator',
      step1: {
        title: 'Step 1: MAD Calculation',
        label: {
          dbl: 'Distance Between Lines (DBL)',
          rootDepth: 'Root Depth',
          rootWidth: 'Root Width',
          waterRetention: 'Water Retention',
        },
        placeholder: {
          dbl: '3.0',
          rootDepth: '0.6',
          rootWidth: '1.5',
          waterRetention: '15',
        },
        unit: {
          meters: 'm',
          percent: '%',
        },
        calculateButton: 'Calculate MAD',
      },
      step2: {
        title: 'Step 2: Refill Tank Calculator',
        selectRefillSpan: 'Select Refill Span',
        refillSpanGuidance: 'Refill span guidance:',
        guidance: {
          heavy: 'Heavy Growth (0.2): Fruit set - maintain turgor',
          normal: 'Normal Growth (0.3): Flowering - balance growth/stress',
          controlled: 'Controlled Stress (0.4): Veraison - improve quality/sugar',
        },
        calculateButton: 'Calculate Refill Tank',
      },
      results: {
        madTitle: 'Maximum Allowable Deficit',
        interpretation: 'Interpretation',
        interpretationMessages: {
          shallow: 'Shallow root zone - very frequent irrigation needed (daily to twice daily)',
          moderate: 'Moderate root zone - irrigation every 1-2 days recommended',
          deep: 'Deep root zone - irrigation every 2-3 days is typically sufficient',
          veryDeep: 'Very deep roots - irrigation every 3-5 days may be adequate',
        },
        refillTankTitle: 'Refill Tank Requirement',
        whatThisMeans: 'What this means',
        refillExplanation:
          'Apply {{value}} units of water when soil moisture drops to {{percentage}}% of MAD to maintain optimal vine health.',
      },
      actions: {
        reset: 'Reset Calculator',
      },
    },
  },

  parameterSelector: {
    title: 'Parameters ({{count}} selected)',
    selectAll: 'Select All',
    deselectAll: 'Deselect All',
  },

  weather: {
    errors: {
      unableToLoad: 'Unable to load weather data',
    },
    empty: {
      noFarmsTitle: 'No farms available',
      noFarmsSubtitle: 'Add a farm to see weather data for your location',
    },
    warnings: {
      noCoordinates:
        "This farm doesn't have location coordinates. Weather data is showing default location (Nashik). Add GPS coordinates to get farm-specific weather.",
    },
    pickers: {
      growthStage: 'GROWTH STAGE',
      soilType: 'SOIL TYPE',
    },
    location: {
      currentLocation: 'Current Location',
      feelsLike: 'Feels like',
    },
    sections: {
      forecast7Day: '7-day forecast',
      waterRequirements: 'Water requirements',
      alerts: 'Alerts & recommendations',
      irrigationSchedule: 'Irrigation schedule',
    },
    labels: {
      humidity: 'Humidity',
      wind: 'Wind',
      uvIndex: 'UV Index',
      rain: 'Rain',
      dailyEtc: 'Daily ETc',
      weeklyNeed: 'Weekly need',
      total7Days: 'Total (7 days)',
      irrigations_one: '{{count}} irrigation',
      irrigations_other: '{{count}} irrigations',
    },
    alerts: {
      pest: {
        title: 'Pest & disease',
        riskBadge: '{{level}} risk',
      },
      harvest: {
        title: 'Harvest conditions',
        badgeOptimal: 'Optimal',
        badgeModerate: 'Moderate',
      },
    },
    lastUpdated: 'Last updated: {{time}}',
  },

  trends: {
    screens: {
      soil: 'Soil Trends',
      petiole: 'Petiole Trends',
    },
    viewModes: {
      table: 'Table',
      chart: 'Chart',
    },
    empty: {
      noDataTitle: 'No data available',
      needMoreDataTitle: 'Need more data',
      needMoreDataBody: 'Add at least 2 lab tests to view chart',
      noParamsTitle: 'No parameters selected',
      noParamsBody: 'Select at least one parameter to view chart',
    },
    legend: {
      title: 'Legend',
    },
    summary: {
      title: 'Summary',
    },
    table: {
      nutrient: 'Nutrient',
      pruningDate: 'Pruning',
      reportDate: 'Report',
      colorGuide: 'Color Guide:',
      optimal: 'Optimal',
      warning: 'Warning',
      critical: 'Critical',
      trend: 'Trend:',
      increase: 'Increase',
      decrease: 'Decrease',
      stable: 'Stable',
      empty: {
        noDataTitle: 'No Data Available',
        noDataBody: 'Add lab tests to view trends',
        noParamsTitle: 'No Parameter Data',
        noParamsBody: 'Unable to load parameter trends',
      },
    },
  },

  units: {
    acres: 'Acres',
    hectares: 'Hectares',
    meter: 'm',
    millimeter: 'mm',
    feet: 'ft',
    mmPerHour: 'mm/hr',
    kilogramPerMeterCubed: 'kg/m³',
  },

  locationPicker: {
    title: 'Select location',
    permissionDenied: 'Permission to access location was denied',
    unableToGetCurrentLocation: 'Unable to get current location',
    pleaseSelectOnMap: 'Please select a location on the map',
    unableToSelectLocation: 'Unable to select location',
    selectedLocationMarkerTitle: 'Selected location',
    useCurrent: 'Use current location',
    confirm: 'Confirm location',
    mapsUnavailableTitle: 'Map unavailable',
    mapsUnavailableBody:
      'Map view is not available in this build. You can still use your current location, or enter coordinates manually.',
  },

  waterLevelSheet: {
    title: 'Update soil water level',
    saveLabel: 'Save water level',
    alerts: {
      invalidInputTitle: 'Invalid input',
      invalidWaterLevel: 'Please enter a valid water level in mm',
      invalidEto: 'Please enter a valid ET0 value',
      missingSelectionTitle: 'Missing selection',
      selectGrowthStage: 'Please select a growth stage',
      calculateFirstTitle: 'Calculate first',
      calculateFirstMessage: 'Please calculate the water level first',
      successTitle: 'Success',
      successUpdated: 'Water level updated to {{valueMm}} mm',
      errorTitle: 'Error',
      failedToUpdate: 'Failed to update water level',
    },
    sections: {
      waterLevels: {
        title: 'Water levels',
        subtitle: 'Calculate from ET0 or set the level manually.',
      },
      method: {
        title: 'Calculation method',
      },
      etoInputs: {
        title: 'ET0 inputs',
      },
      manualEntry: {
        title: 'Manual entry',
      },
    },
    preview: {
      labels: {
        remaining: 'Remaining',
        totalWaterUsed: 'Total water used',
        change: 'Change',
        lastUpdated: 'Last updated',
      },
      current: {
        title: 'Current water level',
      },
      new: {
        title: 'New water level',
      },
    },
    method: {
      eto: 'ET0',
      manual: 'Manual',
    },
    eto: {
      label: 'ET0 (Reference Evapotranspiration)',
    },
    growthStage: {
      label: 'Growth stage',
      placeholder: 'Select growth stage',
      selected: '{{label}} (Kc: {{kc}})',
    },
    manual: {
      label: 'Soil water level',
    },
    calculate: 'Calculate water level',
    growthStagePicker: {
      title: 'Select growth stage',
      kcLabel: 'Kc: {{kc}}',
      stages: {
        beginningBudbreak: 'Beginning Budbreak',
        shoot30cm: 'Shoot 30cm',
        shoot50cm: 'Shoot 50cm',
        shoot80cm: 'Shoot 80cm',
        beginningBloom: 'Beginning Bloom',
        fruitSet: 'Fruit Set',
        berry6to8mm: 'Berry 6-8mm',
        berry12mm: 'Berry 12mm',
        closingBunches: 'Closing Bunches',
        beginningVeraison: 'Beginning Veraison',
        beginningHarvest: 'Beginning Harvest',
        endHarvest: 'End Harvest',
        afterHarvest: 'After Harvest',
      },
    },
  },

  tabs: {
    dashboard: 'Dashboard',
    explore: 'Farming',
    workers: 'Workers',
    tools: 'Tools',
    settings: 'Settings',
    farms: 'Farms',
  },

  onboarding: {
    language: {
      title: 'Choose language',
      subtitle: 'You can change this later in Settings.',
      english: 'English',
      marathi: 'मराठी',
    },
    welcome: {
      title: 'Welcome to Vinesight',
      subtitle: 'Your smart farming companion',
    },
    howItWorks: {
      title: 'How It Works',
      subtitle: 'Everything you need to manage your farm',
    },
    features: {
      addFarms: {
        title: 'Add your farms',
        description:
          'Create farms with location, crop type, and area. Manage multiple farms in one place.',
      },
      trackEverything: {
        title: 'Track everything',
        description:
          'Log irrigation, sprays, harvests, expenses, and more. Keep all records in one place.',
      },
      waterManagement: {
        title: 'Smart water management',
        description: 'Automatic water level calculations based on weather and soil conditions.',
      },
      labTests: {
        title: 'Lab test results',
        description: 'Store and analyze soil and petiole test results with nutrient tracking.',
      },
      reports: {
        title: 'Generate reports',
        description: 'Create date-range reports to track productivity and analyze performance.',
      },
    },
    preferences: {
      title: 'Farm Preferences',
      country: 'Country',
      selectCountry: 'Select a country',
      areaUnit: 'Area Unit',
      subtitle: 'Help us customize your experience',
    },
    notifications: {
      title: 'Notifications',
      subtitle: 'Get reminders and alerts',
      enable: 'Enable notifications',
      item1: 'Irrigation reminders',
      item2: 'Task deadlines',
      item3: 'Weather alerts',
    },
    complete: {
      title: "You're all set!",
      subtitle: 'Start managing your farms with Vinesight. Add your first farm to get started.',
    },
    cta: {
      continue: 'Continue',
      enableNotifications: 'Enable Notifications',
      getStarted: 'Get Started',
    },
  },

  auth: {
    subtitle: 'Farm Management',
    fullName: 'Full Name',
    email: 'Email',
    password: 'Password',
    signIn: 'Sign In',
    signUp: 'Sign Up',
    or: 'or',
    continueWithApple: 'Continue with Apple',
    continueWithGoogle: 'Continue with Google',
    alreadyHaveAccount: 'Already have an account?',
    dontHaveAccount: "Don't have an account?",
    a11y: {
      switchToSignIn: 'Switch to sign in',
      switchToSignUp: 'Switch to sign up',
    },
  },

  authOtp: {
    invalidEmail: 'Invalid email',
    title: 'Enter verification code',
    subtitle: 'We sent a 6-digit code to',
    verify: 'Verify',
    resend: 'Resend code',
    resendA11y: 'Resend code',
    resendA11yWithSeconds: 'Resend code in {{seconds}} seconds',
    resendInSecondsShort: 'Resend in {{seconds}}s',
    useDifferentEmail: 'Use different email',
    useDifferentEmailA11y: 'Use different email',
  },

  settings: {
    sectionGeneral: 'GENERAL',
    sectionNotifications: 'NOTIFICATIONS',
    sectionAccount: 'ACCOUNT',
    language: 'Language',
    selectLanguage: 'Select Language',
    languageEnglish: 'English',
    languageMarathi: 'Marathi',
    languageHindi: 'Hindi',
    theme: 'Theme',
    selectTheme: 'Select Theme',
    themeSystem: 'System',
    themeLight: 'Light',
    themeDark: 'Dark',
    areaUnit: 'Area Unit',
    currency: 'Currency',
    dailyWaterReminder: 'Daily Water Reminder',
    dailyWaterReminderSubtitle: 'Remind to check water levels',
    lowWaterAlerts: 'Low Water Alerts',
    lowWaterAlertsSubtitle: 'Alert when water is critically low',
    taskReminders: 'Task Reminders',
    taskRemindersSubtitle: 'Remind about scheduled tasks',
    notificationNote: 'Notification settings are stored locally',
    madeForVineyardManagement: 'Made for vineyard management',
    signOut: 'Sign Out',
    signOutConfirmTitle: 'Sign Out',
    signOutConfirmBody: 'Are you sure you want to sign out?',
    deleteAccount: 'Delete Account',
    editProfile: 'Edit Profile',
    email: 'Email',
    emailCannotBeChanged: 'Email cannot be changed',
    fullName: 'Full Name',
    phone: 'Phone',
    enterName: 'Enter your name',
    enterPhone: 'Enter phone number',
    selectCurrency: 'Select Currency',
    selectAreaUnit: 'Select Area Unit',
    errors: {
      signOutFailed: 'Failed to sign out. Please try again.',
      notificationsPermissionDenied: 'Notifications permission was not granted.',
      notificationsUnavailable: 'Notifications are not available in this environment.',
      updateProfileFailed: 'Failed to update profile. Please try again.',
      updateAreaUnitFailed: 'Failed to update area unit. Please try again.',
    },

    deleteAccountModal: {
      title: 'Delete Account',
      warningTitle: 'Warning: This action is irreversible',
      warningBody: 'Deleting your account will permanently remove all your data including:',
      dataList: {
        farms: 'All farm data (farms, crops, soil profiles, lab tests)',
        records: 'All records (irrigation, spray, fertigation, harvest, expenses)',
        workers: 'Worker information and attendance records',
        org: 'Organization memberships and connections',
        uploads: 'All uploaded files (soil test reports, photos, documents)',
        profile: 'Your profile, preferences, and authentication data',
      },
      confirmEmail: {
        label: 'Confirm your email',
        placeholder: 'Enter your email',
        hint: 'Enter your account email to confirm deletion',
      },
      confirmPassword: {
        label: 'Confirm your password',
        placeholder: 'Enter your password',
        hint: 'Enter your password to verify your identity',
      },
      reason: {
        label: 'Reason for deletion (optional)',
        placeholder: "Tell us why you're leaving...",
        hint: 'This helps us improve the service',
      },
      checkbox: {
        prefix: 'I understand that my account and all associated data will be',
        bold: 'permanently deleted',
        suffix: 'and cannot be recovered. I also understand that this action cannot be undone.',
      },
      submit: 'Delete My Account',
      submittedTitle: 'Account Deletion Requested',
      submittedBody:
        'Your account deletion request has been submitted. Your account will be deleted within 30 days. If you change your mind, please contact support immediately.',
      errors: {
        emailMismatch: 'Email does not match your account email.',
        missingPassword: 'Please enter your password.',
        missingConfirmation: 'Please confirm you understand the consequences.',
        invalidPassword: 'Invalid password.',
        submitFailed: 'Failed to submit deletion request. Please try again.',
      },
    },
  },

  ai: {
    title: 'Vinesight AI',
    description:
      'Your personal farming assistant. Ask me anything about grape farming, irrigation, diseases, or harvest!',
    suggestedQuestions: 'Suggested questions:',
    apiKeyRequiredTitle: 'API Key Required',
    apiKeyRequiredBody: 'Please configure your OpenAI API key in the environment settings.',
    input: {
      placeholder: 'Ask about farming…',
    },
    errors: {
      failedResponse: 'Failed to get response from AI',
    },
    defaultSuggestions: {
      waterNeed: 'How much water do I need?',
      diseases: 'Check for common diseases',
      fertilizer: 'Fertilizer recommendations',
      pruning: 'Pruning tips for grapes',
    },
  },

  notifications: {
    dailyWater: {
      title: 'Daily water check',
      body: 'Check your $t(glossary.waterLevel) and plan $t(glossary.irrigation).',
    },
    lowWater: {
      title: 'Low $t(glossary.waterLevel)',
      body: '$t(glossary.irrigation) needed soon. Review today’s readings.',
    },
    taskDue: {
      title: '$t(glossary.task) reminder',
      body: 'You have a scheduled task due.',
    },
  },

  dashboard: {
    greeting: {
      morning: 'Good morning',
      afternoon: 'Good afternoon',
      evening: 'Good evening',
      night: 'Good night',
    },
    stats: {
      farms: 'Farms',
      activeWorkers: 'Active workers',
      activities: 'Activities',
      harvest: 'Harvest',
    },
    needsAttention: {
      title: 'Needs attention',
      reasons: {
        lowWaterLevel: 'Low water level',
      },
    },
    quickActions: {
      title: 'Quick actions',
      irrigation: 'Irrigation',
      spray: 'Spray',
      harvest: 'Harvest',
      note: 'Note',
    },
    recentActivity: {
      title: 'Recent activity',
    },
    empty: {
      recentActivity: 'No recent activity yet.\nAdd an entry to get started.',
      noFarms: 'No farms yet.\nAdd your first farm to get started.',
    },
    cta: {
      addEntry: 'Add an entry',
      addFirstFarm: 'Add your first farm',
    },
    farmPicker: {
      title: 'Select farm',
      dismissA11y: 'Dismiss farm picker',
      closeA11y: 'Close farm picker',
      selectFarmA11y: 'Select farm: {{name}}',
      noFarms: 'No farms available',
    },
  },

  tasks: {
    title: 'Tasks',
    unknownFarm: 'Unknown farm',
    filters: {
      all: 'All',
      pending: 'Pending',
      overdue: 'Overdue',
      completed: 'Completed',
    },
    alerts: {
      completeTitle: 'Complete task',
      completeBody: 'Mark "{{title}}" as completed?',
      completeBodyGeneric: 'Mark this task as completed?',
      deleteTitle: 'Delete task',
      deleteBody: 'Are you sure you want to delete "{{title}}"?',
      deleteBodyGeneric: 'Delete this task?',
    },
    statusSummary: {
      pending: 'Pending',
      overdue: 'Overdue',
      completed: 'Completed',
    },
    empty: {
      title: 'No tasks found',
      subtitleAll: 'Create your first task to get started',
      subtitleFiltered: 'No {{filter}} tasks',
    },
    cta: {
      addTask: 'Add task',
    },
    dueDate: {
      none: 'No due date',
      today: 'Today',
      tomorrow: 'Tomorrow',
      overdue: 'Overdue: {{date}}',
    },
    types: {
      irrigation: 'Irrigation',
      spray: 'Spray',
      fertigation: 'Fertigation',
      harvest: 'Harvest',
      soilTest: 'Soil test',
      petioleTest: 'Petiole test',
      expense: 'Expense',
      note: 'Note',
    },
    priority: {
      low: 'Low',
      medium: 'Medium',
      high: 'High',
    },
    a11y: {
      editTask: 'Edit task: {{title}}',
      deleteTask: 'Delete task: {{title}}',
      completeTask: 'Mark task complete: {{title}}',
    },
    status: {
      pending: 'Pending',
      inProgress: 'In progress',
      completed: 'Completed',
      cancelled: 'Cancelled',
    },
    form: {
      addTitle: 'Add task',
      editTitle: 'Edit task',
      saving: 'Saving…',
      useTemplate: 'Use template',
      selectFarm: 'Select farm',
      fields: {
        farm: 'Farm',
        title: 'Title',
        description: 'Description',
        type: 'Type',
        priority: 'Priority',
        dueDate: 'Due date',
      },
      placeholders: {
        title: 'Enter task title',
        description: 'Add details about this task',
        dueDate: 'YYYY-MM-DD (e.g., 2024-01-25)',
      },
      dueDateHint: 'Enter date in YYYY-MM-DD format',
      dueDateErrors: {
        format: 'Use YYYY-MM-DD format.',
        invalidDate: 'Enter a valid calendar date.',
      },
      errors: {
        missingTitle: 'Please enter a task title',
        missingFarm: 'Please select a farm',
        failedToSave: 'Failed to save task. Please try again.',
      },
    },
  },

  workerAnalytics: {
    notFound: 'Worker not found',
    dailyRate: 'Daily rate',
    dateRange: 'Date range',
    quickStats: 'Quick stats',
    weeklySummary: 'Weekly summary',
    transactions: 'Transactions',
    noTransactions: 'No transactions in this range.',
    full: 'Full',
    half: 'Half',
    absent: 'Absent',
  },

  workers: {
    tabs: {
      workers: 'Workers',
      attendance: 'Attendance',
      analytics: 'Analytics',
    },
    lists: {
      activeTitle: 'Active ({{count}})',
      inactiveTitle: 'Inactive ({{count}})',
    },
    empty: {
      title: 'No workers yet',
      subtitle: 'Add workers to track their attendance and payments.',
    },
    analyticsTab: {
      title: 'Worker Analytics',
      subtitle: 'Track worker performance, attendance, and payments.',
      comingSoon: 'Coming soon',
    },
    ratePerDayShort: ' /day',
    workerCard: {
      editA11y: 'Edit {{name}}',
      deleteA11y: 'Delete {{name}}',
    },
    alerts: {
      deleteWorkerTitle: 'Delete worker?',
      deleteWorkerBody: 'This will permanently delete {{name}} and all their associated records.',
    },
    form: {
      addTitle: 'Add worker',
      editTitle: 'Edit worker',
      saveAdd: 'Add worker',
      sections: {
        details: 'Worker details',
        status: 'Status',
      },
      fields: {
        name: {
          label: 'Worker name',
          placeholder: 'e.g., Rajesh Kumar',
        },
        dailyRate: {
          label: 'Daily rate',
          perDayShort: '/day',
        },
        advanceAmountOptional: {
          label: 'Advance amount (optional)',
        },
      },
      toggles: {
        activeWorker: 'Active worker',
        activeWorkerDescription: "Inactive workers won't appear in attendance lists",
      },
      infoCardMessage:
        'Daily rate is used to calculate earnings. Advance balance tracks outstanding loans.',
    },
  },

  warehouse: {
    title: 'Warehouse',
    loading: {
      inventory: 'Loading inventory…',
    },
    labels: {
      lowStock: 'Low Stock',
      lowStockAlerts: 'Low Stock Alerts',
      itemCount_one: '{{count}} item',
      itemCount_other: '{{count}} items',
      quantity: 'Quantity',
      unitPrice: 'Unit Price',
      totalValue: 'Total Value',
    },
    reorderAt: 'Reorder at: {{quantity}} {{unit}}',
    filters: {
      all: 'All ({{count}})',
      fertilizer: 'Fertilizers ({{count}})',
      spray: 'Sprays ({{count}})',
    },
    search: {
      placeholder: 'Search inventory...',
      found_one: '{{count}} item found',
      found_other: '{{count}} items found',
    },
    itemsCount_one: '{{count}} item',
    itemsCount_other: '{{count}} items',
    itemTypes: {
      fertilizer: 'Fertilizer',
      spray: 'Spray',
    },
    empty: {
      title: 'No items in warehouse',
      subtitle: 'Tap the + button to add your first inventory item',
    },
    actions: {
      addItem: 'Add Item',
    },
    alerts: {
      deleteItemTitle: 'Delete item',
      deleteItemBody: 'Are you sure you want to delete "{{name}}"?',
    },
    stockForm: {
      title: 'Add stock',
      saveLabel: 'Add stock',
      currentLabel: 'Current: {{quantity}} {{unit}}',
      sectionTitle: 'Stock details',
      perUnitSuffix: 'per {{unit}}',
      fields: {
        quantityToAdd: 'Quantity to add',
        unitPriceOptional: 'Unit price ({{currency}}) - optional',
      },
      preview: {
        title: 'After update',
        newStock: 'New stock',
        totalValue: 'Total value',
      },
    },
  },

  labTests: {
    list: {
      title: 'Lab Tests',
      viewTrends: 'View Trends',
      tabs: {
        soil: 'Soil ({{count}})',
        petiole: 'Petiole ({{count}})',
      },
      card: {
        soilAnalysis: 'Soil Analysis',
        petioleAnalysis: 'Petiole Analysis',
        outOfRange: 'Out of range: {{count}}',
        allWithinRange: 'All within range',
        more: '{{count}} more nutrients',
        moreLabel: 'more',
        status: {
          outOfRange: 'out of range',
        },
      },
      deleteAction: 'Delete test',
      empty: {
        title: 'No {{type}} Tests',
        subtitle: 'Add a {{type}} test to track nutrient levels.',
        action: 'Add {{type}} Test',
      },
      deleteTitle: 'Delete test',
      deleteBody: 'Are you sure you want to delete this {{type}} test?',
    },
    form: {
      title: 'Add {{type}} test',
      saveLabel: 'Save test',
      uploadSectionTitle: 'Upload lab report',
      parsingWithAi: 'Parsing with AI...',
      uploadButton: 'Upload Lab Report',
      detailsSectionTitle: 'Test Details',
      parametersSectionTitle: '{{type}} Parameters',
      parametersSectionSubtitle: 'Enter values from your lab report',
      recommendationsSectionTitle: 'Recommendations',
      notesSectionTitle: 'Notes',
      optionalPlaceholder: 'Optional',
      types: {
        soil: 'Soil',
        petiole: 'Petiole',
      },
    },
    details: {
      title: '{{type}} Test Details',
      sections: {
        chemical: '🧪 Chemical Properties',
        major: '🌿 Major Nutrients',
        secondary: '⚗️ Secondary Nutrients',
        micro: '💧 Micro Nutrients',
        other: '📋 Other',
        additional: '📊 Additional Parameters',
      },
      optimalPrefix: 'Optimal:',
    },
    errors: {
      unableToOpenFormTitle: 'Unable to open lab test form',
      invalidFarmId: 'Invalid farmId: {{farmId}}',
      invalidFarmTitle: 'Invalid Farm',
    },
    actions: {
      backToList: 'Back to Lab Tests',
    },
    parameters: {
      ph: 'pH',
      ec: 'EC',
      organicCarbon: 'Organic Carbon',
      organicMatter: 'Organic Matter',
      calciumCarbonate: 'Calcium Carbonate',
      carbonate: 'Carbonate',
      bicarbonate: 'Bicarbonate',
      nitrogen: 'Nitrogen',
      phosphorus: 'Phosphorus',
      potassium: 'Potassium',
      calcium: 'Calcium',
      magnesium: 'Magnesium',
      sulfur: 'Sulfur',
      iron: 'Iron',
      manganese: 'Manganese',
      zinc: 'Zinc',
      copper: 'Copper',
      boron: 'Boron',
      total_nitrogen: 'Total Nitrogen',
      nitrate_nitrogen: 'Nitrate N',
      ammoniacal_nitrogen: 'Ammonical N',
      molybdenum: 'Molybdenum',
      sodium: 'Sodium',
      chloride: 'Chloride',
    },
    upload: {
      chooseMethodTitle: 'Choose upload method',
      chooseMethodBody: 'How would you like to upload the lab test report?',
      permissionDeniedTitle: 'Permission denied',
      permissionDeniedBody: 'Camera permission is required to take photos.',
      uploadFailedTitle: 'Upload failed',
      noValidImageSelected: 'No valid image was selected. Please try again.',
      failedToTakePhoto: 'Failed to take photo. Please try again.',
      failedToSelectImage: 'Failed to select image. Please try again.',
      invalidPdfFile: 'Invalid PDF file. Please try again.',
      failedToSelectPdf: 'Failed to select PDF. Please try again.',
      pdfProcessingTitle: 'PDF processing',
      pdfProcessingBody:
        'Unable to extract text from PDF automatically. Please take a photo or screenshot of your lab report for best results.',
      noDataFoundTitle: 'No data found',
      noDataFoundPdfBody:
        'Could not extract test parameters from PDF. Please try again with a clearer document or enter data manually.',
      noDataFoundImageBody:
        'Could not extract test parameters from the image. Please try again with a clearer image or enter data manually.',
      successTitle: 'Success',
      successBody: 'Successfully extracted {{count}} parameters. Please review and save.',
      parsingFailedTitle: 'Parsing failed',
      parsingFailedBody:
        'Could not extract data. Please take a photo or screenshot of your lab report for best results.',
    },
  },

  soilProfiling: {
    noFarm: {
      title: 'Select a farm first',
      subtitle:
        'Soil profiles are associated with specific farms. Please select a farm to view its soil profiles.',
      cta: 'Go to farms',
    },
    title: 'Soil Profiling',
    tabs: {
      history: 'History',
      trends: 'Trends',
    },
    loading: 'Loading profiles…',
    alerts: {
      deleteProfileTitle: 'Delete profile',
      deleteProfileBody: 'Are you sure you want to delete this soil profile?',
    },
    errors: {
      unableToOpenFormTitle: 'Unable to open soil profile form',
      invalidFarmId: 'Invalid farm ID: {{farmId}}',
    },
    fusarium: 'Fusarium: {{value}}%',
    averageMoisture: 'Average Moisture',
    noProfiles: 'No Soil Profiles',
    noProfilesDescription: "Add soil moisture profiles to track your farm's soil health over time.",
    addFirstProfile: 'Add First Profile',
    notEnoughData: 'Not Enough Data',
    notEnoughDataDescription: 'Add at least 2 profiles to see trends.',
    avgMoisture: 'Avg Moisture',
    totalProfiles: 'Total Profiles',
    recentChange: 'Recent Change',
    fromLastProfile: 'from last profile',
    latestMoisture: 'Latest Moisture',
  },

  soilProfile: {
    moistureStatus: {
      veryDry: 'Very Dry',
      dry: 'Dry',
      optimal: 'Optimal',
      moist: 'Moist',
      wet: 'Wet',
    },
  },

  soilProfileForm: {
    titleAdd: 'Add Soil Profile',
    sections: {
      top: 'Top',
      bottom: 'Bottom',
      left: 'Left',
      right: 'Right',
    },
    date: {
      label: 'Profile date',
      hint: 'Select the date when this soil profile was taken.',
      modalTitle: 'Select profile date',
    },
    moisture: {
      title: 'Moisture readings (%)',
      hint: 'Enter soil moisture percentage for each section. At least one is required.',
    },
    ec: {
      title: 'EC values (dS/m) - optional',
      hint: 'Electrical conductivity readings for each section.',
      fieldSuffix: 'EC',
    },
    fusarium: {
      title: 'Fusarium (%) - optional',
      hint: 'Fusarium wilt percentage if applicable.',
    },
  },

  attendance: {
    filters: {
      label: 'Filters',
      worker: 'Worker',
      farms: 'Farms',
      selectWorker: 'Select worker',
      selectFarms: 'Select farms',
      allWorkers: 'All Workers',
      allFarms: 'All Farms',
      farmsSelected_one: '{{count}} selected',
      farmsSelected_other: '{{count}} selected',
    },
    status: {
      fullDay: 'Full Day',
      fullDayShort: 'F',
      halfDay: 'Half Day',
      halfDayShort: 'H',
      absent: 'Absent',
      absentShort: 'A',
      notSet: 'Not Set',
      notSetShort: '-',
    },
    dateRange: {
      label: 'Date range',
    },
    week: {
      thisWeek: 'This Week',
      unsavedChanges: 'Unsaved Changes',
      upToDate: 'Up to Date',
    },
    quickActions: {
      allFull: 'All Full',
      allHalf: 'All Half',
      allOff: 'All Off',
    },
    buttons: {
      saving: 'Saving...',
      saveAndNext: 'Save & Next',
      saveAndFinish: 'Save & Finish',
      nextWorker: 'Next Worker',
      done: 'Done',
    },
    sheet: {
      selectWorkerTitle: 'Select Worker',
      selectWorkerSubtitle: 'Choose a worker to mark attendance',
    },
    a11y: {
      selectWorkerButton: 'Select worker',
      selectFarmsButton: 'Select farms',
      setAllFullDay: 'Set all days to full day',
      setAllHalfDay: 'Set all days to half day',
      setAllAbsent: 'Set all days to absent',
      savingAttendance: 'Saving attendance',
      saveAndNextWorker: 'Save attendance and go to next worker',
      saveAndFinish: 'Save attendance and finish',
      goToNextWorker: 'Go to next worker',
      dayStatus: '{{day}} {{date}}. {{status}}.',
    },
    empty: {
      noWorkersTitle: 'No workers available',
    },
    alerts: {
      partialErrorTitle: 'Partial error',
      partialErrorBody: 'Saved with {{count}} error(s). Reloading…',
      savedTitle: 'Success',
      savedBody: 'Saved attendance for {{name}}.',
      completeTitle: 'Complete',
      completeBody: 'All workers completed!',
    },
  },

  reports: {
    title: 'Reports',
    types: {
      comprehensive: 'Comprehensive',
      operations: 'Operations',
      financial: 'Financial',
    },
    noFarms: {
      title: 'No farms found',
      subtitle: 'Add a farm first to generate reports',
    },
    selectFarmLabel: 'Select farm',
    selectFarmPlaceholder: 'Select farm',
    dateRange: {
      label: 'Date range',
    },
    reportType: {
      label: 'Report type',
    },
    loading: {
      preview: 'Loading preview…',
    },
    preview: {
      title: 'Preview summary',
      counts: {
        irrigations_one: '{{count}} irrigation',
        irrigations_other: '{{count}} irrigations',
        sprays_one: '{{count}} spray',
        sprays_other: '{{count}} sprays',
        harvests_one: '{{count}} harvest',
        harvests_other: '{{count}} harvests',
        expenses_one: '{{count}} expense',
        expenses_other: '{{count}} expenses',
      },
    },
    exportAs: 'Export as',
    alerts: {
      exportFailedTitle: 'Export failed',
    },
    errors: {
      unableToExport: 'Unable to export report',
    },
    summary: {
      totalRecords: 'Total Records',
      waterUsage: 'Water Usage',
      totalHarvest: 'Total Harvest',
      revenue: 'Revenue',
      netProfit: 'Net Profit',
    },
    export: {
      meta: {
        region: 'Region',
        area: 'Area',
        reportPeriod: 'Report Period',
        to: 'to',
      },
      summaryTitle: 'Summary',
      generatedBy: 'Generated by Vinesight on {{date}}',
      moreRecords: '... and {{count}} more records',
      sections: {
        irrigationRecords: 'Irrigation Records ({{count}})',
        sprayRecords: 'Spray Records ({{count}})',
        harvestRecords: 'Harvest Records ({{count}})',
        expenseRecords: 'Expense Records ({{count}})',
      },
      table: {
        date: 'Date',
        duration: 'Duration',
        area: 'Area',
        growthStage: 'Growth Stage',
        discharge: 'Discharge',
        chemical: 'Chemical',
        dose: 'Dose',
        weather: 'Weather',
        quantity: 'Quantity',
        grade: 'Grade',
        price: 'Price',
        buyer: 'Buyer',
        type: 'Type',
        cost: 'Cost',
        remarks: 'Remarks',
      },
    },
  },
} as const;

export type EnTranslations = typeof en;
