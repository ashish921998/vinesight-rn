import { GLOSSARY_HI } from '../glossary.hi';

export const hi = {
  glossary: GLOSSARY_HI,

  common: {
    ok: 'ठीक है',
    cancel: 'रद्द करें',
    close: 'बंद करें',
    save: 'सहेजें',
    saveChanges: 'परिवर्तन सहेजें',
    delete: 'हटाएं',
    edit: 'संपादित करें',
    back: 'वापस',
    goBack: 'वापस जाएं',
    next: 'अगला',
    complete: 'पूर्ण',
    skip: 'छोड़ें',
    loading: 'लोड हो रहा है…',
    saving: 'सहेजा जा रहा है…',
    tryAgain: 'पुनः प्रयास करें',
    done: 'हो गया',
    reset: 'रीसेट करें',
    error: 'त्रुटि',
    unknownDate: 'अज्ञात तारीख',
    missing: 'गायब',
    search: 'खोजें...',
    from: 'से',
    to: 'तक',
    selectDate: 'तारीख चुनें',
    na: 'उपलब्ध नहीं',
    general: 'सामान्य',
    filter: 'फ़िल्टर',
    clearAll: 'सभी साफ़ करें',
    units: {
      hours: 'घंटे',
    },
    labels: {
      value: 'मूल्य',
      low: 'कम',
      totalValue: 'कुल मूल्य',
      quantity: 'मात्रा',
      grade: 'ग्रेड',
      unitPrice: 'इकाई मूल्य',
      current: 'वर्तमान',
      avg: 'औसत',
      min: 'न्यूनतम',
      max: 'अधिकतम',
    },
    noResultsFound: 'कोई परिणाम नहीं मिला',
    tryDifferentSearchTerm: 'कोई अन्य खोज शब्द आज़माएं',
    clearSearch: 'खोज साफ़ करें',
    a11y: {
      editWithName: '{{name}} संपादित करें',
      deleteWithName: '{{name}} हटाएं',
    },
    actions: {
      takePhoto: 'फोटो लें',
      selectImage: 'छवि चुनें',
      selectPdf: 'PDF चुनें',
    },
    alerts: {
      missingInformationTitle: 'जानकारी गायब है',
      enterQuantityToAdd: 'कृपया जोड़ने के लिए मात्रा दर्ज करें।',
      enterWorkerNameAndDailyRate: 'कृपया श्रमिक का नाम और दैनिक दर दर्ज करें।',
      fillAllRequiredFields: 'कृपया सभी आवश्यक फ़ील्ड भरें।',
    },
    errors: {
      missingFarmIdForUpdate: 'अपडेट के लिए खेत ID गायब है।',
      failedToUpdateLog: 'लॉग अपडेट करने में विफल। कृपया पुनः प्रयास करें।',

      failedToUpdateFarm: 'खेत अपडेट करने में विफल। कृपया पुनः प्रयास करें।',
      failedToCreateFarm: 'खेत बनाने में विफल। कृपया पुनः प्रयास करें।',

      enterAtLeastOneMoistureValue: 'कृपया कम से कम एक नमी मान दर्ज करें।',
      failedToSaveSoilProfile: 'मिट्टी प्रोफाइल सहेजने में विफल। कृपया पुनः प्रयास करें।',

      enterAtLeastOneParameterValue: 'कृपया कम से कम एक पैरामीटर मान दर्ज करें।',
      failedToSaveLabTest: 'लैब परीक्षण सहेजने में विफल। कृपया पुनः प्रयास करें।',

      failedToUpdateStock: 'स्टॉक अपडेट करने में विफल। कृपया पुनः प्रयास करें।',
      failedToSaveWorker: 'श्रमिक सहेजने में विफल। कृपया पुनः प्रयास करें।',

      failedToSaveLogs: 'लॉग सहेजने में विफल। कृपया पुनः प्रयास करें।',
      enterTaskTitle: 'कृपया कार्य शीर्षक दर्ज करें।',
      selectFarm: 'कृपया खेत चुनें।',
      failedToSaveTask: 'कार्य सहेजने में विफल। कृपया पुनः प्रयास करें।',

      failedToLoadAttendance: 'उपस्थिति लोड करने में विफल।',
      failedToLoadAttendanceData: 'उपस्थिति डेटा लोड करने में विफल।',
      selectAtLeastOneFarm: 'कृपया कम से कम एक खेत चुनें।',

      enterItemName: 'कृपया वस्तु का नाम दर्ज करें।',
      enterValidQuantity: 'कृपया एक मान्य मात्रा दर्ज करें।',
      enterValidUnitPrice: 'कृपया एक मान्य इकाई मूल्य दर्ज करें।',
      failedToSaveItem: 'वस्तु सहेजने में विफल। कृपया पुनः प्रयास करें।',

      cannotDeleteLogFarmIdNotFound: 'लॉग हटा नहीं सकते: खेत ID नहीं मिला।',
      failedToDeleteLog: 'लॉग हटाने में विफल। कृपया पुनः प्रयास करें।',
      farmNotFoundForLog: 'इस लॉग के लिए खेत नहीं मिला।',
      failedToDeleteItem: 'वस्तु हटाने में विफल।',

      failedToDeleteFarm: 'खेत हटाने में विफल।',
      failedToDeleteWorker: 'श्रमिक हटाने में विफल।',

      noReportDataAvailable: 'कोई रिपोर्ट डेटा उपलब्ध नहीं है।',

      invalidFarm: 'अमान्य खेत',
    },
  },

  farmDetails: {
    loadingFarm: 'खेत लोड हो रहा है…',
    notFound: {
      title: 'खेत नहीं मिला',
    },
    deleteFarmTitle: 'खेत हटाएं',
    deleteFarmBody:
      'क्या आप वाकई "{{name}}" हटाना चाहते हैं? इससे सिंचाई रिकॉर्ड, छिड़काव रिकॉर्ड, फसल, खर्च, मिट्टी प्रोफाइल और अन्य खेत संबंधित डेटा सहित सभी संबंधित डेटा भी हट जाएगा। यह क्रिया पूर्ववत नहीं की जा सकती।',
    errors: {
      completeTaskFailed: 'कार्य पूर्ण करने में विफल।',
      deleteTaskFailed: 'कार्य हटाने में विफल।',
      deleteFarmFailed: 'खेत हटाने में विफल।',
    },
    header: {
      areaAcres: '{{value}} एकड़',
      areaAcresUnknown: '— एकड़',
    },
    pruning: {
      daysShort: '{{count}}दि',
    },
    weather: {
      current: 'वर्तमान मौसम',
      temperature: 'तापमान',
      et0Mm: 'ET0 (मिमी)',
    },
    stats: {
      logEntriesTitle: 'लॉग प्रविष्टियां',
      recordsSubtitle: 'रिकॉर्ड',
      soilWaterTitle: 'मिट्टी का पानी',
    },
    water: {
      noIrrigationLoggedYet: 'अभी तक कोई सिंचाई लॉग नहीं की गई',
      mmUsed: '{{value}} मिमी उपयोग किया गया',
      captionThisSeason: 'इस मौसम में {{usage}}',
      captionLogIrrigation: 'पानी के उपयोग की निगरानी के लिए सिंचाई लॉग करें',
    },
    workboard: {
      title: 'वर्कबोर्ड',
      subtitle: 'उपकरण और संसाधनों तक त्वरित पहुंच।',
      actions: {
        ai: 'AI',
        lab: 'लैब',
        reports: 'रिपोर्ट',
        soilMoisture: 'मिट्टी की नमी',
      },
    },
    tabs: {
      activities: 'गतिविधियां',
      tasks: 'कार्य',
    },
    activities: {
      empty: {
        title: 'अभी तक कोई गतिविधि नहीं',
        subtitle: 'उन्हें यहां देखने के लिए गतिविधियां लॉग करना शुरू करें',
      },
    },
    tasks: {
      empty: {
        title: 'अभी तक कोई कार्य नहीं',
        subtitleAndroid: 'कार्य बनाने के लिए + बटन टैप करें',
        subtitleIos: 'कार्य जोड़ने के लिए नीचे दिए गए बटन का उपयोग करें',
      },
    },
    actions: {
      addActivity: 'गतिविधि जोड़ें',
    },
    a11y: {
      editFarm: 'खेत संपादित करें',
      deleteFarm: 'खेत हटाएं',
      showActivities: 'गतिविधियां दिखाएं',
      showTasks: 'कार्य दिखाएं',
      taskCompleted: 'कार्य पूर्ण',
      markTaskComplete: 'कार्य पूर्ण के रूप में चिह्नित करें',
      deleteTask: 'कार्य हटाएं: {{title}}',
    },
  },

  farmCard: {
    status: {
      needsAttention: 'ध्यान देने की आवश्यकता है',
      healthy: 'स्वस्थ',
    },
    area: {
      acres: '{{value}} एकड़',
      unknownAcres: '— एकड़',
    },
    waterBalance: {
      label: 'पानी का संतुलन',
      value: '{{value}} मिमी',
      unknown: '—',
    },
    region: {
      label: 'क्षेत्र',
      unknown: 'अज्ञात',
    },
    a11y: {
      editFarm: '{{name}} संपादित करें',
      deleteFarm: '{{name}} हटाएं',
    },
  },

  farmForm: {
    title: {
      add: 'खेत जोड़ें',
      edit: 'खेत संपादित करें',
    },
    saveLabel: {
      createFarm: 'खेत बनाएं',
    },
    sections: {
      details: 'खेत विवरण',
      cropType: 'फसल प्रकार',
      variety: 'किस्म',
      plantingDate: 'रोपण तिथि',
      plantSpacingOptional: 'पौधों की दूरी (वैकल्पिक)',
      irrigationDetailsOptional: 'सिंचाई विवरण (वैकल्पिक)',
      pruningDateOptional: 'छंटाई तिथि (वैकल्पिक)',
      locationOptional: 'स्थान (वैकल्पिक)',
      soilPropertiesOptional: 'मिट्टी गुण (वैकल्पिक)',
      soilTexture: 'मिट्टी की बनावट',
    },
    fields: {
      name: {
        label: 'खेत का नाम',
        placeholder: 'उदा., सनसेट विनयार्ड्स',
      },
      region: {
        label: 'स्थान',
        placeholder: 'उदा., नासिक, महाराष्ट्र',
      },
      area: {
        label: 'क्षेत्रफल',
        placeholder: '10',
      },
      vineSpacing: {
        label: 'बेल की दूरी',
      },
      rowSpacing: {
        label: 'पंक्ति की दूरी',
      },
      tankCapacity: {
        label: 'टैंक क्षमता',
      },
      systemDischarge: {
        label: 'सिस्टम डिस्चार्ज',
      },
      pruningDate: {
        label: 'छंटाई तिथि',
        notSet: 'सेट नहीं है',
      },
      locationName: {
        label: 'स्थान का नाम',
        placeholder: 'उदा., उत्तरी खेत',
      },
      latitude: {
        label: 'अक्षांश',
      },
      longitude: {
        label: 'देशांतर',
      },
      elevation: {
        label: 'ऊंचाई',
      },
      bulkDensity: {
        label: 'थोक घनत्व',
      },
      cationExchangeCapacity: {
        label: 'कैटायन एक्सचेंज क्षमता',
      },
      soilWaterRetention: {
        label: 'मिट्टी जल प्रतिधारण',
      },
      sandPercentage: {
        label: 'रेत',
      },
      siltPercentage: {
        label: 'गाद',
      },
      clayPercentage: {
        label: 'मिट्टी',
      },
    },
    cropOptions: {
      grapes: {
        label: 'अंगूर',
        sublabel: 'बेलें',
      },
      mango: {
        label: 'आम',
        sublabel: 'पेड़',
      },
      pomegranate: {
        label: 'अनार',
        sublabel: 'फल',
      },
      citrus: {
        label: 'नींबू',
        sublabel: 'पेड़',
      },
      banana: {
        label: 'केला',
        sublabel: 'पौधे',
      },
      other: {
        label: 'अन्य',
        sublabel: 'कस्टम',
      },
    },
    variety: {
      selectPlaceholder: 'किस्म चुनें',
      custom: 'कस्टम',
      customNameLabel: 'कस्टम किस्म का नाम',
      customNamePlaceholder: 'किस्म का नाम दर्ज करें',
      modalTitle: 'किस्म चुनें',
    },
    plantingDate: {
      selectPlaceholder: 'तारीख चुनें',
    },
    location: {
      selectOnMap: 'मानचित्र पर स्थान चुनें',
    },
    soilTexture: {
      selectPlaceholder: 'बनावट चुनें',
      modalTitle: 'मिट्टी की बनावट चुनें',
      options: {
        sand: 'रेत',
        loamySand: 'दोमट रेत',
        sandyLoam: 'रेतीली दोमट',
        loam: 'दोमट',
        siltLoam: 'गादयुक्त दोमट',
        silt: 'गाद',
        sandyClayLoam: 'रेतीली चिकनी दोमट',
        clayLoam: 'चिकनी दोमट',
        siltyClayLoam: 'गादयुक्त चिकनी दोमट',
        sandyClay: 'रेतीली चिकनी मिट्टी',
        siltyClay: 'गादयुक्त चिकनी मिट्टी',
        clay: 'चिकनी मिट्टी',
      },
    },
    soilCompositionWarning:
      'रेत + गाद + मिट्टी का योग लगभग 100% होना चाहिए (वर्तमान में {{total}}%)',
    infoCardMessage: 'आप इन विवरणों को बाद में अपनी खेत सेटिंग्स से अपडेट कर सकते हैं।',
  },

  logs: {
    screenTitle: 'खेत लॉग',
    irrigationDurationHoursShort: '{{hours}}घं',
    sprayApplication: 'छिड़काव अनुप्रयोग',
    harvestDescription: '{{quantityKg}}किग्रा - {{grade}}',
    expenseDescription: '{{cost}} - {{type}}',
    fertigationApplied_one: '{{countFormatted}} उर्वरक लागू किया गया',
    fertigationApplied_other: '{{countFormatted}} उर्वरक लागू किए गए',
    types: {
      irrigation: 'सिंचाई',
      spray: 'छिड़काव',
      harvest: 'कटाई',
      expense: 'खर्च',
      fertigation: 'फर्टिगेशन',
      note: 'नोट',
    },
    labels: {
      selectedFarm: 'चयनित खेत',
    },
    farmPicker: {
      title: 'खेत चुनें',
      allFarms: 'सभी खेत',
      selectFarm: 'खेत चुनें',
      farmsCount_one: '{{count}} खेत',
      farmsCount_other: '{{count}} खेत',
    },
    search: {
      placeholder: 'लॉग खोजें…',
    },
    filters: {
      activityTypes: 'गतिविधि प्रकार',
    },
    empty: {
      title: 'कोई गतिविधि लॉग नहीं मिला',
      subtitleFiltered: 'अपने फ़िल्टर समायोजित करने का प्रयास करें',
      subtitleDefault: 'उन्हें यहां देखने के लिए गतिविधियां लॉग करना शुरू करें',
    },
    pagination: {
      showing: '{{total}} में से {{start}}-{{end}} दिखाया जा रहा है',
      perPage: '{{count}} प्रति पृष्ठ',
      recordsPerPage: 'प्रति पृष्ठ रिकॉर्ड',
    },
    datePicker: {
      fromTitle: 'प्रारंभ तिथि चुनें',
      toTitle: 'समाप्ति तिथि चुनें',
    },
    delete: {
      title: 'लॉग हटाएं?',
      body: 'क्या आप वाकई {{date}} से इस {{type}} लॉग को हटाना चाहते हैं?',
    },
  },

  farms: {
    addFarm: 'खेत जोड़ें',
    empty: {
      title: 'अभी तक कोई खेत नहीं',
      subtitle: 'सिंचाई, छिड़काव और फसल को ट्रैक करने के लिए अपना पहला खेत जोड़ें।',
    },
    search: {
      placeholder: 'खेत खोजें...',
      found_one: '{{count}} खेत मिला',
      found_other: '{{count}} खेत मिले',
    },
    stats: {
      totalFarms: 'कुल खेत',
      totalArea: 'कुल क्षेत्रफल',
    },
  },

  entryForm: {
    activityType: 'गतिविधि प्रकार',
    selectActivityTypeHint: 'पूर्ण-स्क्रीन फॉर्म खोलने के लिए गतिविधि प्रकार चुनें।',
    useTemplate: 'टेम्पलेट उपयोग करें',
    addEntry: 'प्रविष्टि जोड़ें',
    addLog: 'लॉग जोड़ें',
    addTask: 'कार्य जोड़ें',
    editTask: 'कार्य संपादित करें',
    selectDate: 'तारीख चुनें',
    selectDueDate: 'नियत तारीख चुनें',
    done: 'हो गया',
    selectTaskType: 'कार्य प्रकार चुनें',
    selectPriority: 'प्राथमिकता चुनें',
    saveLogs: 'लॉग सहेजें ({{count}})',
    saveTask: 'कार्य सहेजें',
    drafts_one: '{{count}} ड्राफ्ट',
    drafts_other: '{{count}} ड्राफ्ट',
    pendingLogs_one: 'लंबित लॉग ({{count}})',
    pendingLogs_other: 'लंबित लॉग ({{count}})',
    farmLabel: 'खेत *',
    selectFarm: 'खेत चुनें',
    partialSuccess: {
      title: 'आंशिक सफलता',
      body_one: '{{count}} लॉग सहेजने में विफल। कृपया समीक्षा करें और पुनः प्रयास करें।',
      body_other: '{{count}} लॉग सहेजने में विफल। कृपया समीक्षा करें और पुनः प्रयास करें।',
    },
    taskForm: {
      titleLabel: 'शीर्षक *',
      titlePlaceholder: 'कार्य शीर्षक दर्ज करें',
      descriptionLabel: 'विवरण',
      descriptionPlaceholder: 'इस कार्य के बारे में विवरण जोड़ें',
      typeLabel: 'प्रकार',
      priorityLabel: 'प्राथमिकता',
      dueDateLabel: 'नियत तारीख',
      selectDueDate: 'नियत तारीख चुनें',
      selectDueDateTitle: 'नियत तारीख चुनें',
    },
    tabs: {
      log: 'खेत लॉग',
      task: 'कार्य',
    },
    discardChanges: {
      title: 'परिवर्तन रद्द करें?',
      taskOnly: 'आपके पास असहेजे गए कार्य परिवर्तन हैं। क्या आप वाकई बंद करना चाहते हैं?',
      logsOnly: 'आपके पास असहेजे गए लॉग हैं। क्या आप वाकई बंद करना चाहते हैं?',
      both: 'आपके पास असहेजे गए परिवर्तन हैं। क्या आप वाकई बंद करना चाहते हैं?',
      discard: 'रद्द करें',
    },
  },

  activityEdit: {
    title: 'लॉग संपादित करें',
    detailsTitle: 'लॉग विवरण',
    dateLabel: 'तारीख',
    loadErrorTitle: 'गतिविधि विवरण लोड करने में असमर्थ।',
    loadErrorBody: 'कृपया गतिविधि सूची से पुनः प्रयास करें।',
  },

  sprayForm: {
    title: 'छिड़काव अनुप्रयोग',
    subtitle: 'रसायन और पानी की मात्रा लॉग करें',
    waterVolume: {
      label: 'पानी की मात्रा',
      placeholder: 'मात्रा दर्ज करें',
      unitLiters: 'लीटर',
      hint: 'छिड़काव मिश्रण के लिए उपयोग किया गया कुल पानी',
    },
    chemicals: {
      label: 'रसायन',
      addChemical: 'रसायन जोड़ें',
      namePlaceholder: 'रसायन का नाम',
      qtyPlaceholder: 'मात्रा',
      selectUnit: 'इकाई चुनें',
    },
    validation: {
      ready: 'जोड़ने के लिए तैयार',
      incomplete: 'पानी की मात्रा और कम से कम एक रसायन जोड़ें',
    },
  },

  analytics: {
    title: 'विश्लेषण',
    labels: {
      irrigationHours: 'सिंचाई घंटे',
      sprayApplications: 'छिड़काव अनुप्रयोग',
      totalHarvest: 'कुल कटाई',
      harvestValue: 'कटाई मूल्य',
      performanceScore: 'प्रदर्शन स्कोर',
    },
    sections: {
      overview: 'अवलोकन',
      trends: 'रुझान',
      comparisons: 'तुलना',
    },
    timeRanges: {
      last7Days: 'पिछले 7 दिन',
      last30Days: 'पिछले 30 दिन',
      yearToDate: 'वर्ष से आज तक',
    },
    loading: 'विश्लेषण लोड हो रहा है...',
    empty: {
      title: 'कोई डेटा उपलब्ध नहीं',
      description: 'अपने विश्लेषण देखने के लिए खेत गतिविधियां जोड़ना शुरू करें।',
    },
    metrics: {
      revenue: 'राजस्व',
      expenses: 'खर्च',
      roi: 'ROI',
    },
    categories: {
      irrigation: 'सिंचाई',
      spray: 'छिड़काव',
      harvest: 'कटाई',
      expense: 'खर्च',
      efficiency: 'दक्षता',
    },
  },

  tools: {
    subtitle: 'कैलकुलेटर और उपकरण',
    sections: {
      calculators: 'कैलकुलेटर',
    },
    items: {
      weatherIrrigation: 'मौसम और सिंचाई',
      madCalculator: 'MAD कैलकुलेटर',
      systemDischarge: 'सिस्टम डिस्चार्ज',
      laiCalculator: 'LAI कैलकुलेटर',
      nutrientCalculator: 'पोषक तत्व कैलकुलेटर',
    },
    descriptions: {
      weatherIrrigation: 'मौसम पूर्वानुमान जांचें और ET0 के आधार पर सिंचाई आवश्यकताओं की गणना करें',
      madCalculator: 'अपनी फसलों के लिए अधिकतम स्वीकार्य कमी की गणना करें',
      systemDischarge: 'सिंचाई सिस्टम डिस्चार्ज दरों की गणना करें और ट्रैक करें',
      laiCalculator: 'कैनोपी प्रबंधन के लिए पत्ती क्षेत्र सूचकांक की गणना करें',
      nutrientCalculator: 'लैब परीक्षणों के आधार पर उर्वरक और पोषक तत्वों की आवश्यकता की गणना करें',
    },
  },

  weather: {
    errors: {
      unableToLoad: 'मौसम डेटा लोड करने में असमर्थ',
    },
    empty: {
      noFarmsTitle: 'कोई खेत उपलब्ध नहीं',
      noFarmsSubtitle: 'अपने स्थान के लिए मौसम डेटा देखने के लिए एक खेत जोड़ें',
    },
    warnings: {
      noCoordinates:
        'इस खेत में स्थान निर्देशांक नहीं हैं। मौसम डेटा डिफ़ॉल्ट स्थान (नासिक) दिखा रहा है। खेत-विशिष्ट मौसम प्राप्त करने के लिए GPS निर्देशांक जोड़ें।',
    },
    pickers: {
      growthStage: 'विकास चरण',
      soilType: 'मिट्टी का प्रकार',
    },
    location: {
      currentLocation: 'वर्तमान स्थान',
      feelsLike: 'ऐसा लगता है',
    },
    sections: {
      forecast7Day: '7 दिन का पूर्वानुमान',
      waterRequirements: 'पानी की आवश्यकताएं',
      alerts: 'अलर्ट और सिफारिशें',
      irrigationSchedule: 'सिंचाई अनुसूची',
    },
    labels: {
      humidity: 'आर्द्रता',
      wind: 'हवा',
      uvIndex: 'UV सूचकांक',
      rain: 'बारिश',
      dailyEtc: 'दैनिक ETc',
      weeklyNeed: 'साप्ताहिक आवश्यकता',
      total7Days: 'कुल (7 दिन)',
      irrigations_one: '{{count}} सिंचाई',
      irrigations_other: '{{count}} सिंचाई',
    },
    alerts: {
      pest: {
        title: 'कीट और रोग',
        riskBadge: '{{level}} जोखिम',
      },
      harvest: {
        title: 'कटाई की स्थिति',
        badgeOptimal: 'इष्टतम',
        badgeModerate: 'मध्यम',
      },
    },
    lastUpdated: 'अंतिम अपडेट: {{time}}',
  },

  trends: {
    screens: {
      soil: 'मिट्टी रुझान',
      petiole: 'पेटीओल रुझान',
    },
    viewModes: {
      table: 'तालिका',
      chart: 'चार्ट',
    },
    empty: {
      noDataTitle: 'कोई डेटा उपलब्ध नहीं',
      needMoreDataTitle: 'अधिक डेटा की आवश्यकता है',
      needMoreDataBody: 'चार्ट देखने के लिए कम से कम 2 लैब परीक्षण जोड़ें',
      noParamsTitle: 'कोई पैरामीटर चयनित नहीं',
      noParamsBody: 'चार्ट देखने के लिए कम से कम एक पैरामीटर चुनें',
    },
    legend: {
      title: 'लीजेंड',
    },
    summary: {
      title: 'सारांश',
    },
    table: {
      nutrient: 'पोषक तत्व',
      colorGuide: 'रंग गाइड:',
      optimal: 'इष्टतम',
      warning: 'चेतावनी',
      critical: 'गंभीर',
      trend: 'रुझान:',
      increase: 'वृद्धि',
      decrease: 'कमी',
      stable: 'स्थिर',
      empty: {
        noDataTitle: 'कोई डेटा उपलब्ध नहीं',
        noDataBody: 'रुझान देखने के लिए लैब परीक्षण जोड़ें',
        noParamsTitle: 'कोई पैरामीटर डेटा नहीं',
        noParamsBody: 'पैरामीटर रुझान लोड करने में असमर्थ',
      },
    },
  },

  units: {
    acres: 'एकड़',
    hectares: 'हेक्टेयर',
  },

  locationPicker: {
    title: 'स्थान चुनें',
    permissionDenied: 'स्थान एक्सेस करने की अनुमति अस्वीकृत',
    unableToGetCurrentLocation: 'वर्तमान स्थान प्राप्त करने में असमर्थ',
    pleaseSelectOnMap: 'कृपया मानचित्र पर एक स्थान चुनें',
    unableToSelectLocation: 'स्थान चुनने में असमर्थ',
    selectedLocationMarkerTitle: 'चयनित स्थान',
    useCurrent: 'वर्तमान स्थान उपयोग करें',
    confirm: 'स्थान की पुष्टि करें',
    mapsUnavailableTitle: 'मानचित्र अनुपलब्ध',
    mapsUnavailableBody:
      'इस बिल्ड में मानचित्र दृश्य उपलब्ध नहीं है। आप अभी भी अपना वर्तमान स्थान उपयोग कर सकते हैं, या मैन्युअल रूप से निर्देशांक दर्ज कर सकते हैं।',
  },

  waterLevelSheet: {
    title: 'मिट्टी के पानी का स्तर अपडेट करें',
    saveLabel: 'पानी का स्तर सहेजें',
    alerts: {
      invalidInputTitle: 'अमान्य इनपुट',
      invalidWaterLevel: 'कृपया मिमी में एक मान्य पानी का स्तर दर्ज करें',
      invalidEto: 'कृपया एक मान्य ET0 मान दर्ज करें',
      missingSelectionTitle: 'गायब चयन',
      selectGrowthStage: 'कृपया एक विकास चरण चुनें',
      calculateFirstTitle: 'पहले गणना करें',
      calculateFirstMessage: 'कृपया पहले पानी का स्तर गणना करें',
      successTitle: 'सफलता',
      successUpdated: 'पानी का स्तर {{valueMm}} मिमी पर अपडेट किया गया',
      errorTitle: 'त्रुटि',
      failedToUpdate: 'पानी का स्तर अपडेट करने में विफल',
    },
    sections: {
      waterLevels: {
        title: 'पानी का स्तर',
        subtitle: 'ET0 से गणना करें या स्तर मैन्युअल रूप से सेट करें।',
      },
      method: {
        title: 'गणना विधि',
      },
      etoInputs: {
        title: 'ET0 इनपुट',
      },
      manualEntry: {
        title: 'मैन्युअल प्रविष्टि',
      },
    },
    preview: {
      labels: {
        remaining: 'शेष',
        totalWaterUsed: 'कुल पानी उपयोग किया गया',
        change: 'परिवर्तन',
        lastUpdated: 'अंतिम अपडेट',
      },
      current: {
        title: 'वर्तमान पानी का स्तर',
      },
      new: {
        title: 'नया पानी का स्तर',
      },
    },
    method: {
      eto: 'ET0',
      manual: 'मैन्युअल',
    },
    eto: {
      label: 'ET0 (संदर्भ वाष्पीकरण)',
    },
    growthStage: {
      label: 'विकास चरण',
      placeholder: 'विकास चरण चुनें',
      selected: '{{label}} (Kc: {{kc}})',
    },
    manual: {
      label: 'मिट्टी के पानी का स्तर',
    },
    calculate: 'पानी का स्तर गणना करें',
    growthStagePicker: {
      title: 'विकास चरण चुनें',
      kcLabel: 'Kc: {{kc}}',
      stages: {
        beginningBudbreak: 'कलियों का आरंभ',
        shoot30cm: 'शूट 30 सेमी',
        shoot50cm: 'शूट 50 सेमी',
        shoot80cm: 'शूट 80 सेमी',
        beginningBloom: 'फूल का आरंभ',
        fruitSet: 'फल सेट',
        berry6to8mm: 'बेरी 6-8 मिमी',
        berry12mm: 'बेरी 12 मिमी',
        closingBunches: 'गुच्छों का बंद होना',
        beginningVeraison: 'वेराइसन का आरंभ',
        beginningHarvest: 'कटाई का आरंभ',
        endHarvest: 'कटाई का अंत',
        afterHarvest: 'कटाई के बाद',
      },
    },
  },

  tabs: {
    dashboard: 'डैशबोर्ड',
    explore: 'अन्वेषण',
    workers: 'श्रमिक',
    tools: 'उपकरण',
    settings: 'सेटिंग्स',
    farms: 'खेत',
  },

  onboarding: {
    language: {
      title: 'भाषा चुनें',
      subtitle: 'आप इसे बाद में सेटिंग्स में बदल सकते हैं।',
      english: 'English',
      marathi: 'मराठी',
    },
    welcome: {
      title: 'Vinesight में आपका स्वागत है',
      subtitle: 'आपका स्मार्ट खेती साथी',
    },
    howItWorks: {
      title: 'यह कैसे काम करता है',
      subtitle: 'अपने खेत को प्रबंधित करने के लिए आपको जो कुछ भी चाहिए',
    },
    features: {
      addFarms: {
        title: 'अपने खेत जोड़ें',
        description:
          'स्थान, फसल प्रकार और क्षेत्रफल के साथ खेत बनाएं। एक ही स्थान पर कई खेतों का प्रबंधन करें।',
      },
      trackEverything: {
        title: 'सब कुछ ट्रैक करें',
        description:
          'सिंचाई, छिड़काव, कटाई, खर्च और बहुत कुछ लॉग करें। सभी रिकॉर्ड एक ही स्थान पर रखें।',
      },
      waterManagement: {
        title: 'स्मार्ट जल प्रबंधन',
        description: 'मौसम और मिट्टी की स्थिति के आधार पर स्वचालित पानी के स्तर की गणना।',
      },
      labTests: {
        title: 'लैब परीक्षण परिणाम',
        description:
          'पोषक तत्व ट्रैकिंग के साथ मिट्टी और पेटीओल परीक्षण परिणाम संग्रहीत और विश्लेषण करें।',
      },
      reports: {
        title: 'रिपोर्ट बनाएं',
        description:
          'उत्पादकता को ट्रैक करने और प्रदर्शन का विश्लेषण करने के लिए तारीख-श्रेणी रिपोर्ट बनाएं।',
      },
    },
    preferences: {
      title: 'खेत प्राथमिकताएं',
      country: 'देश',
      selectCountry: 'एक देश चुनें',
      areaUnit: 'क्षेत्रफल इकाई',
      subtitle: 'अपने अनुभव को अनुकूलित करने में हमारी मदद करें',
    },
    notifications: {
      title: 'सूचनाएं',
      subtitle: 'अनुस्मारक और अलर्ट प्राप्त करें',
      enable: 'सूचनाएं सक्षम करें',
      item1: 'सिंचाई अनुस्मारक',
      item2: 'कार्य समय सीमा',
      item3: 'मौसम अलर्ट',
    },
    complete: {
      title: 'आप सभी सेट हैं!',
      subtitle:
        'Vinesight के साथ अपने खेतों का प्रबंधन शुरू करें। शुरू करने के लिए अपना पहला खेत जोड़ें।',
    },
    cta: {
      continue: 'जारी रखें',
      enableNotifications: 'सूचनाएं सक्षम करें',
      getStarted: 'शुरू करें',
    },
  },

  auth: {
    subtitle: 'खेत प्रबंधन',
    fullName: 'पूरा नाम',
    email: 'ईमेल',
    password: 'पासवर्ड',
    signIn: 'साइन इन करें',
    signUp: 'साइन अप करें',
    or: 'या',
    continueWithApple: 'Apple के साथ जारी रखें',
    continueWithGoogle: 'Google के साथ जारी रखें',
    alreadyHaveAccount: 'पहले से खाता है?',
    dontHaveAccount: 'खाता नहीं है?',
    a11y: {
      switchToSignIn: 'साइन इन पर स्विच करें',
      switchToSignUp: 'साइन अप पर स्विच करें',
    },
  },

  authOtp: {
    invalidEmail: 'अमान्य ईमेल',
    title: 'सत्यापन कोड दर्ज करें',
    subtitle: 'हमने एक 6-अंकीय कोड भेजा है',
    verify: 'सत्यापित करें',
    resend: 'कोड पुनः भेजें',
    resendA11y: 'कोड पुनः भेजें',
    resendA11yWithSeconds: '{{seconds}} सेकंड में कोड पुनः भेजें',
    resendInSecondsShort: '{{seconds}}से में पुनः भेजें',
    useDifferentEmail: 'अलग ईमेल उपयोग करें',
    useDifferentEmailA11y: 'अलग ईमेल उपयोग करें',
  },

  settings: {
    sectionGeneral: 'सामान्य',
    sectionNotifications: 'सूचनाएं',
    sectionAccount: 'खाता',
    language: 'भाषा',
    selectLanguage: 'भाषा चुनें',
    languageEnglish: 'English',
    languageMarathi: 'मराठी',
    languageHindi: 'हिंदी',
    areaUnit: 'क्षेत्रफल इकाई',
    currency: 'मुद्रा',
    dailyWaterReminder: 'दैनिक जल अनुस्मारक',
    dailyWaterReminderSubtitle: 'पानी के स्तर की जांच करने के लिए याद दिलाएं',
    lowWaterAlerts: 'कम पानी अलर्ट',
    lowWaterAlertsSubtitle: 'जब पानी गंभीर रूप से कम हो तो अलर्ट करें',
    taskReminders: 'कार्य अनुस्मारक',
    taskRemindersSubtitle: 'निर्धारित कार्यों के बारे में याद दिलाएं',
    notificationNote: 'सूचना सेटिंग्स स्थानीय रूप से संग्रहीत हैं',
    madeForVineyardManagement: 'दाख की बारी प्रबंधन के लिए बनाया गया',
    signOut: 'साइन आउट',
    signOutConfirmTitle: 'साइन आउट',
    signOutConfirmBody: 'क्या आप वाकई साइन आउट करना चाहते हैं?',
    deleteAccount: 'खाता हटाएं',
    editProfile: 'प्रोफाइल संपादित करें',
    email: 'ईमेल',
    emailCannotBeChanged: 'ईमेल बदला नहीं जा सकता',
    fullName: 'पूरा नाम',
    phone: 'फोन',
    enterName: 'अपना नाम दर्ज करें',
    enterPhone: 'फोन नंबर दर्ज करें',
    selectCurrency: 'मुद्रा चुनें',
    selectAreaUnit: 'क्षेत्रफल इकाई चुनें',
    errors: {
      signOutFailed: 'साइन आउट करने में विफल। कृपया पुनः प्रयास करें।',
      notificationsPermissionDenied: 'सूचनाएं अनुमति प्रदान नहीं की गई।',
      notificationsUnavailable: 'इस वातावरण में सूचनाएं उपलब्ध नहीं हैं।',
      updateProfileFailed: 'प्रोफाइल अपडेट करने में विफल। कृपया पुनः प्रयास करें।',
      updateAreaUnitFailed: 'क्षेत्रफल इकाई अपडेट करने में विफल। कृपया पुनः प्रयास करें।',
    },

    deleteAccountModal: {
      title: 'खाता हटाएं',
      warningTitle: 'चेतावनी: यह क्रिया अपरिवर्तनीय है',
      warningBody: 'अपना खाता हटाने से निम्नलिखित सहित आपका सभी डेटा स्थायी रूप से हटा दिया जाएगा:',
      dataList: {
        farms: 'सभी खेत डेटा (खेत, फसलें, मिट्टी प्रोफाइल, लैब परीक्षण)',
        records: 'सभी रिकॉर्ड (सिंचाई, छिड़काव, फर्टिगेशन, कटाई, खर्च)',
        workers: 'श्रमिक जानकारी और उपस्थिति रिकॉर्ड',
        org: 'संगठन सदस्यता और कनेक्शन',
        uploads: 'सभी अपलोड की गई फाइलें (मिट्टी परीक्षण रिपोर्ट, फोटो, दस्तावेज़)',
        profile: 'आपकी प्रोफाइल, प्राथमिकताएं और प्रमाणीकरण डेटा',
      },
      confirmEmail: {
        label: 'अपने ईमेल की पुष्टि करें',
        placeholder: 'अपना ईमेल दर्ज करें',
        hint: 'हटाने की पुष्टि करने के लिए अपना खाता ईमेल दर्ज करें',
      },
      confirmPassword: {
        label: 'अपने पासवर्ड की पुष्टि करें',
        placeholder: 'अपना पासवर्ड दर्ज करें',
        hint: 'अपनी पहचान सत्यापित करने के लिए अपना पासवर्ड दर्ज करें',
      },
      reason: {
        label: 'हटाने का कारण (वैकल्पिक)',
        placeholder: 'हमें बताएं कि आप क्यों जा रहे हैं...',
        hint: 'यह हमें सेवा में सुधार करने में मदद करता है',
      },
      checkbox: {
        prefix: 'मैं समझता हूं कि मेरा खाता और सभी संबंधित डेटा',
        bold: 'स्थायी रूप से हटा दिया जाएगा',
        suffix:
          'और पुनर्प्राप्त नहीं किया जा सकता। मैं यह भी समझता हूं कि यह क्रिया पूर्ववत नहीं की जा सकती।',
      },
      submit: 'मेरा खाता हटाएं',
      submittedTitle: 'खाता हटाने का अनुरोध किया गया',
      submittedBody:
        'आपका खाता हटाने का अनुरोध सबमिट कर दिया गया है। आपका खाता 30 दिनों के भीतर हटा दिया जाएगा। यदि आप अपना मन बदलते हैं, तो कृपया तुरंत समर्थन से संपर्क करें।',
      errors: {
        emailMismatch: 'ईमेल आपके खाता ईमेल से मेल नहीं खाता।',
        missingPassword: 'कृपया अपना पासवर्ड दर्ज करें।',
        missingConfirmation: 'कृपया पुष्टि करें कि आप परिणामों को समझते हैं।',
        invalidPassword: 'अमान्य पासवर्ड।',
        submitFailed: 'हटाने का अनुरोध सबमिट करने में विफल। कृपया पुनः प्रयास करें।',
      },
    },
  },

  ai: {
    title: 'Vinesight AI',
    description:
      'आपका व्यक्तिगत खेती सहायक। मुझसे अंगूर की खेती, सिंचाई, रोगों या कटाई के बारे में कुछ भी पूछें!',
    suggestedQuestions: 'सुझाए गए प्रश्न:',
    apiKeyRequiredTitle: 'API कुंजी आवश्यक',
    apiKeyRequiredBody: 'कृपया पर्यावरण सेटिंग्स में अपनी OpenAI API कुंजी कॉन्फ़िगर करें।',
    input: {
      placeholder: 'खेती के बारे में पूछें…',
    },
    errors: {
      failedResponse: 'AI से प्रतिक्रिया प्राप्त करने में विफल',
    },
    defaultSuggestions: {
      waterNeed: 'मुझे कितने पानी की आवश्यकता है?',
      diseases: 'सामान्य रोगों की जांच करें',
      fertilizer: 'उर्वरक सिफारिशें',
      pruning: 'अंगूर के लिए छंटाई सुझाव',
    },
  },

  notifications: {
    dailyWater: {
      title: 'दैनिक पानी की जांच',
      body: 'अपने $t(glossary.waterLevel) की जांच करें और $t(glossary.irrigation) की योजना बनाएं।',
    },
    lowWater: {
      title: 'कम $t(glossary.waterLevel)',
      body: '$t(glossary.irrigation) जल्द आवश्यक। आज की रीडिंग की समीक्षा करें।',
    },
    taskDue: {
      title: '$t(glossary.task) अनुस्मारक',
      body: 'आपके पास एक निर्धारित कार्य है जो देय है।',
    },
  },

  dashboard: {
    greeting: {
      morning: 'सुप्रभात',
      afternoon: 'शुभ दोपहर',
      evening: 'शुभ संध्या',
      night: 'शुभ रात्रि',
    },
    stats: {
      farms: 'खेत',
      activeWorkers: 'सक्रिय श्रमिक',
      activities: 'गतिविधियां',
      harvest: 'कटाई',
    },
    needsAttention: {
      title: 'ध्यान देने की आवश्यकता है',
      reasons: {
        lowWaterLevel: 'पानी का स्तर कम',
      },
    },
    quickActions: {
      title: 'त्वरित क्रियाएं',
      irrigation: 'सिंचाई',
      spray: 'छिड़काव',
      harvest: 'कटाई',
      note: 'नोट',
    },
    recentActivity: {
      title: 'हाल की गतिविधि',
    },
    empty: {
      recentActivity: 'अभी तक कोई हालिया गतिविधि नहीं।\nशुरू करने के लिए एक प्रविष्टि जोड़ें।',
      noFarms: 'अभी तक कोई खेत नहीं।\nशुरू करने के लिए अपना पहला खेत जोड़ें।',
    },
    cta: {
      addEntry: 'एक प्रविष्टि जोड़ें',
      addFirstFarm: 'अपना पहला खेत जोड़ें',
    },
    farmPicker: {
      title: 'खेत चुनें',
      dismissA11y: 'खेत चयनकर्ता खारिज करें',
      closeA11y: 'खेत चयनकर्ता बंद करें',
      selectFarmA11y: 'खेत चुनें: {{name}}',
      noFarms: 'कोई खेत उपलब्ध नहीं',
    },
  },

  tasks: {
    title: 'कार्य',
    unknownFarm: 'अज्ञात खेत',
    filters: {
      all: 'सभी',
      pending: 'लंबित',
      overdue: 'अतिदेय',
      completed: 'पूर्ण',
    },
    alerts: {
      completeTitle: 'कार्य पूर्ण करें',
      completeBody: '"{{title}}" को पूर्ण के रूप में चिह्नित करें?',
      completeBodyGeneric: 'इस कार्य को पूर्ण के रूप में चिह्नित करें?',
      deleteTitle: 'कार्य हटाएं',
      deleteBody: 'क्या आप वाकई "{{title}}" हटाना चाहते हैं?',
      deleteBodyGeneric: 'इस कार्य को हटाएं?',
    },
    statusSummary: {
      pending: 'लंबित',
      overdue: 'अतिदेय',
      completed: 'पूर्ण',
    },
    empty: {
      title: 'कोई कार्य नहीं मिला',
      subtitleAll: 'शुरू करने के लिए अपना पहला कार्य बनाएं',
      subtitleFiltered: 'कोई {{filter}} कार्य नहीं',
    },
    cta: {
      addTask: 'कार्य जोड़ें',
    },
    dueDate: {
      none: 'कोई नियत तारीख नहीं',
      today: 'आज',
      tomorrow: 'कल',
      overdue: 'अतिदेय: {{date}}',
    },
    types: {
      irrigation: 'सिंचाई',
      spray: 'छिड़काव',
      fertigation: 'फर्टिगेशन',
      harvest: 'कटाई',
      soilTest: 'मिट्टी परीक्षण',
      petioleTest: 'पेटीओल परीक्षण',
      expense: 'खर्च',
      note: 'नोट',
    },
    priority: {
      low: 'कम',
      medium: 'मध्यम',
      high: 'उच्च',
    },
    status: {
      pending: 'लंबित',
      inProgress: 'प्रगति में',
      completed: 'पूर्ण',
      cancelled: 'रद्द',
    },
    form: {
      addTitle: 'कार्य जोड़ें',
      editTitle: 'कार्य संपादित करें',
      saving: 'सहेजा जा रहा है…',
      useTemplate: 'टेम्पलेट उपयोग करें',
      selectFarm: 'खेत चुनें',
      fields: {
        farm: 'खेत',
        title: 'शीर्षक',
        description: 'विवरण',
        type: 'प्रकार',
        priority: 'प्राथमिकता',
        dueDate: 'नियत तारीख',
      },
      placeholders: {
        title: 'कार्य शीर्षक दर्ज करें',
        description: 'इस कार्य के बारे में विवरण जोड़ें',
        dueDate: 'YYYY-MM-DD (उदा., 2024-01-25)',
      },
      dueDateHint: 'YYYY-MM-DD प्रारूप में तारीख दर्ज करें',
      dueDateErrors: {
        format: 'YYYY-MM-DD प्रारूप उपयोग करें।',
        invalidDate: 'एक मान्य कैलेंडर तारीख दर्ज करें।',
      },
      errors: {
        missingTitle: 'कृपया कार्य शीर्षक दर्ज करें',
        missingFarm: 'कृपया एक खेत चुनें',
        failedToSave: 'कार्य सहेजने में विफल। कृपया पुनः प्रयास करें।',
      },
    },
  },

  workers: {
    tabs: {
      workers: 'श्रमिक',
      attendance: 'उपस्थिति',
      analytics: 'विश्लेषण',
    },
    lists: {
      activeTitle: 'सक्रिय ({{count}})',
      inactiveTitle: 'निष्क्रिय ({{count}})',
    },
    empty: {
      title: 'अभी तक कोई श्रमिक नहीं',
      subtitle: 'उनकी उपस्थिति और भुगतान को ट्रैक करने के लिए श्रमिक जोड़ें।',
    },
    analyticsTab: {
      title: 'श्रमिक विश्लेषण',
      subtitle: 'श्रमिक प्रदर्शन, उपस्थिति और भुगतान ट्रैक करें।',
      comingSoon: 'जल्द आ रहा है',
    },
    ratePerDayShort: ' /दिन',
    workerCard: {
      editA11y: '{{name}} संपादित करें',
      deleteA11y: '{{name}} हटाएं',
    },
    alerts: {
      deleteWorkerTitle: 'श्रमिक हटाएं?',
      deleteWorkerBody: 'यह {{name}} और उनके सभी संबंधित रिकॉर्ड को स्थायी रूप से हटा देगा।',
    },
    form: {
      addTitle: 'श्रमिक जोड़ें',
      editTitle: 'श्रमिक संपादित करें',
      saveAdd: 'श्रमिक जोड़ें',
      sections: {
        details: 'श्रमिक विवरण',
        status: 'स्थिति',
      },
      fields: {
        name: {
          label: 'श्रमिक का नाम',
          placeholder: 'उदा., राजेश कुमार',
        },
        dailyRate: {
          label: 'दैनिक दर',
          perDayShort: '/दिन',
        },
        advanceAmountOptional: {
          label: 'अग्रिम राशि (वैकल्पिक)',
        },
      },
      toggles: {
        activeWorker: 'सक्रिय श्रमिक',
        activeWorkerDescription: 'निष्क्रिय श्रमिक उपस्थिति सूचियों में दिखाई नहीं देंगे',
      },
      infoCardMessage:
        'दैनिक दर का उपयोग कमाई की गणना के लिए किया जाता है। अग्रिम शेष बकाया ऋण को ट्रैक करता है।',
    },
  },

  warehouse: {
    title: 'गोदाम',
    loading: {
      inventory: 'इन्वेंटरी लोड हो रही है…',
    },
    labels: {
      lowStock: 'कम स्टॉक',
      lowStockAlerts: 'कम स्टॉक अलर्ट',
      itemCount_one: '{{count}} वस्तु',
      itemCount_other: '{{count}} वस्तुएं',
      quantity: 'मात्रा',
      unitPrice: 'इकाई मूल्य',
      totalValue: 'कुल मूल्य',
    },
    reorderAt: 'पुनः ऑर्डर करें: {{quantity}} {{unit}}',
    filters: {
      all: 'सभी ({{count}})',
      fertilizer: 'उर्वरक ({{count}})',
      spray: 'छिड़काव ({{count}})',
    },
    search: {
      placeholder: 'इन्वेंटरी खोजें...',
      found_one: '{{count}} वस्तु मिली',
      found_other: '{{count}} वस्तुएं मिलीं',
    },
    itemsCount_one: '{{count}} वस्तु',
    itemsCount_other: '{{count}} वस्तुएं',
    itemTypes: {
      fertilizer: 'उर्वरक',
      spray: 'छिड़काव',
    },
    empty: {
      title: 'गोदाम में कोई वस्तु नहीं',
      subtitle: 'अपनी पहली इन्वेंटरी वस्तु जोड़ने के लिए + बटन टैप करें',
    },
    actions: {
      addItem: 'वस्तु जोड़ें',
    },
    alerts: {
      deleteItemTitle: 'वस्तु हटाएं',
      deleteItemBody: 'क्या आप वाकई "{{name}}" हटाना चाहते हैं?',
    },
    stockForm: {
      title: 'स्टॉक जोड़ें',
      saveLabel: 'स्टॉक जोड़ें',
      currentLabel: 'वर्तमान: {{quantity}} {{unit}}',
      sectionTitle: 'स्टॉक विवरण',
      perUnitSuffix: 'प्रति {{unit}}',
      fields: {
        quantityToAdd: 'जोड़ने के लिए मात्रा',
        unitPriceOptional: 'इकाई मूल्य ({{currency}}) - वैकल्पिक',
      },
      preview: {
        title: 'अपडेट के बाद',
        newStock: 'नया स्टॉक',
        totalValue: 'कुल मूल्य',
      },
    },
  },

  labTests: {
    list: {
      title: 'लैब परीक्षण',
      viewTrends: 'रुझान देखें',
      tabs: {
        soil: 'मिट्टी ({{count}})',
        petiole: 'पेटीओल ({{count}})',
      },
      card: {
        soilAnalysis: 'मिट्टी विश्लेषण',
        petioleAnalysis: 'पेटीओल विश्लेषण',
      },
      empty: {
        title: 'कोई {{type}} परीक्षण नहीं',
        subtitle: 'पोषक तत्वों के स्तर को ट्रैक करने के लिए एक {{type}} परीक्षण जोड़ें।',
        action: '{{type}} परीक्षण जोड़ें',
      },
      deleteTitle: 'परीक्षण हटाएं',
      deleteBody: 'क्या आप वाकई इस {{type}} परीक्षण को हटाना चाहते हैं?',
    },
    form: {
      title: '{{type}} परीक्षण जोड़ें',
      saveLabel: 'परीक्षण सहेजें',
      uploadSectionTitle: 'लैब रिपोर्ट अपलोड करें',
      parsingWithAi: 'AI के साथ पार्स किया जा रहा है...',
      uploadButton: 'लैब रिपोर्ट अपलोड करें',
      detailsSectionTitle: 'परीक्षण विवरण',
      parametersSectionTitle: '{{type}} पैरामीटर',
      parametersSectionSubtitle: 'अपनी लैब रिपोर्ट से मान दर्ज करें',
      recommendationsSectionTitle: 'सिफारिशें',
      notesSectionTitle: 'नोट्स',
      optionalPlaceholder: 'वैकल्पिक',
      types: {
        soil: 'मिट्टी',
        petiole: 'पेटीओल',
      },
    },
    details: {
      title: '{{type}} परीक्षण विवरण',
      sections: {
        chemical: '🧪 रासायनिक गुण',
        major: '🌿 प्रमुख पोषक तत्व',
        secondary: '⚗️ द्वितीयक पोषक तत्व',
        micro: '💧 सूक्ष्म पोषक तत्व',
        other: '📋 अन्य',
        additional: '📊 अतिरिक्त पैरामीटर',
      },
      optimalPrefix: 'इष्टतम:',
    },
    errors: {
      unableToOpenFormTitle: 'लैब परीक्षण फॉर्म खोलने में असमर्थ',
      invalidFarmId: 'अमान्य farmId: {{farmId}}',
      invalidFarmTitle: 'अमान्य खेत',
    },
    actions: {
      backToList: 'लैब परीक्षण सूची पर वापस जाएं',
    },
    parameters: {
      ph: 'pH',
      ec: 'EC',
      organicCarbon: 'कार्बनिक कार्बन',
      organicMatter: 'कार्बनिक पदार्थ',
      calciumCarbonate: 'कैल्शियम कार्बोनेट',
      carbonate: 'कार्बोनेट',
      bicarbonate: 'बाइकार्बोनेट',
      nitrogen: 'नाइट्रोजन',
      phosphorus: 'फास्फोरस',
      potassium: 'पोटैशियम',
      calcium: 'कैल्शियम',
      magnesium: 'मैग्नीशियम',
      sulfur: 'सल्फर',
      iron: 'लोहा',
      manganese: 'मैंगनीज',
      zinc: 'जस्ता',
      copper: 'तांबा',
      boron: 'बोरॉन',
      total_nitrogen: 'कुल नाइट्रोजन',
      nitrate_nitrogen: 'नाइट्रेट N',
      ammoniacal_nitrogen: 'अमोनिकल N',
      molybdenum: 'मोलिब्डेनम',
      sodium: 'सोडियम',
      chloride: 'क्लोराइड',
    },
    upload: {
      chooseMethodTitle: 'अपलोड विधि चुनें',
      chooseMethodBody: 'आप लैब परीक्षण रिपोर्ट कैसे अपलोड करना चाहेंगे?',
      permissionDeniedTitle: 'अनुमति अस्वीकृत',
      permissionDeniedBody: 'फोटो लेने के लिए कैमरा अनुमति आवश्यक है।',
      uploadFailedTitle: 'अपलोड विफल',
      noValidImageSelected: 'कोई मान्य छवि नहीं चुनी गई। कृपया पुनः प्रयास करें।',
      failedToTakePhoto: 'फोटो लेने में विफल। कृपया पुनः प्रयास करें।',
      failedToSelectImage: 'छवि चुनने में विफल। कृपया पुनः प्रयास करें।',
      invalidPdfFile: 'अमान्य PDF फाइल। कृपया पुनः प्रयास करें।',
      failedToSelectPdf: 'PDF चुनने में विफल। कृपया पुनः प्रयास करें।',
      pdfProcessingTitle: 'PDF प्रोसेसिंग',
      pdfProcessingBody:
        'PDF से स्वचालित रूप से टेक्स्ट निकालने में असमर्थ। सर्वोत्तम परिणामों के लिए कृपया अपनी लैब रिपोर्ट की फोटो या स्क्रीनशॉट लें।',
      noDataFoundTitle: 'कोई डेटा नहीं मिला',
      noDataFoundPdfBody:
        'PDF से परीक्षण पैरामीटर निकाल नहीं सके। कृपया स्पष्ट दस्तावेज़ के साथ पुनः प्रयास करें या डेटा मैन्युअल रूप से दर्ज करें।',
      noDataFoundImageBody:
        'छवि से परीक्षण पैरामीटर निकाल नहीं सके। कृपया स्पष्ट छवि के साथ पुनः प्रयास करें या डेटा मैन्युअल रूप से दर्ज करें।',
      successTitle: 'सफलता',
      successBody: 'सफलतापूर्वक {{count}} पैरामीटर निकाले गए। कृपया समीक्षा करें और सहेजें।',
      parsingFailedTitle: 'पार्सिंग विफल',
      parsingFailedBody:
        'डेटा निकाल नहीं सके। सर्वोत्तम परिणामों के लिए कृपया अपनी लैब रिपोर्ट की फोटो या स्क्रीनशॉट लें।',
    },
  },

  soilProfiling: {
    noFarm: {
      title: 'पहले एक खेत चुनें',
      subtitle:
        'मिट्टी प्रोफाइल विशिष्ट खेतों से जुड़े होते हैं। कृपया अपने मिट्टी प्रोफाइल देखने के लिए एक खेत चुनें।',
      cta: 'खेतों पर जाएं',
    },
    title: 'मिट्टी प्रोफाइलिंग',
    tabs: {
      history: 'इतिहास',
      trends: 'रुझान',
    },
    loading: 'प्रोफाइल लोड हो रहे हैं…',
    alerts: {
      deleteProfileTitle: 'प्रोफाइल हटाएं',
      deleteProfileBody: 'क्या आप वाकई इस मिट्टी प्रोफाइल को हटाना चाहते हैं?',
    },
    errors: {
      unableToOpenFormTitle: 'मिट्टी प्रोफाइल फॉर्म खोलने में असमर्थ',
      invalidFarmId: 'अमान्य खेत ID: {{farmId}}',
    },
  },

  soilProfileForm: {
    titleAdd: 'मिट्टी प्रोफाइल जोड़ें',
    sections: {
      top: 'ऊपर',
      bottom: 'नीचे',
      left: 'बाएं',
      right: 'दाएं',
    },
    date: {
      label: 'प्रोफाइल तिथि',
      hint: 'वह तिथि चुनें जब यह मिट्टी प्रोफाइल लिया गया था।',
      modalTitle: 'प्रोफाइल तिथि चुनें',
    },
    moisture: {
      title: 'नमी रीडिंग (%)',
      hint: 'प्रत्येक अनुभाग के लिए मिट्टी की नमी प्रतिशत दर्ज करें। कम से कम एक आवश्यक है।',
    },
    ec: {
      title: 'EC मान (dS/m) - वैकल्पिक',
      hint: 'प्रत्येक अनुभाग के लिए विद्युत चालकता रीडिंग।',
      fieldSuffix: 'EC',
    },
    fusarium: {
      title: 'फुसैरियम (%) - वैकल्पिक',
      hint: 'यदि लागू हो तो फुसैरियम विल्ट प्रतिशत।',
    },
  },

  attendance: {
    filters: {
      label: 'फ़िल्टर',
      worker: 'श्रमिक',
      farms: 'खेत',
      selectWorker: 'श्रमिक चुनें',
      selectFarms: 'खेत चुनें',
      allWorkers: 'सभी श्रमिक',
      allFarms: 'सभी खेत',
      farmsSelected_one: '{{count}} चयनित',
      farmsSelected_other: '{{count}} चयनित',
    },
    status: {
      fullDay: 'पूर्ण दिवस',
      fullDayShort: 'पू',
      halfDay: 'आधा दिन',
      halfDayShort: 'आ',
      absent: 'अनुपस्थित',
      absentShort: 'अ',
      notSet: 'सेट नहीं',
      notSetShort: '-',
    },
    week: {
      thisWeek: 'यह सप्ताह',
      unsavedChanges: 'असहेजे गए परिवर्तन',
      upToDate: 'अद्यतन',
    },
    quickActions: {
      allFull: 'सभी पूर्ण',
      allHalf: 'सभी आधा',
      allOff: 'सभी बंद',
    },
    buttons: {
      saving: 'सहेजा जा रहा है...',
      saveAndNext: 'सहेजें और अगला',
      saveAndFinish: 'सहेजें और समाप्त करें',
      nextWorker: 'अगला श्रमिक',
      done: 'हो गया',
    },
    sheet: {
      selectWorkerTitle: 'श्रमिक चुनें',
      selectWorkerSubtitle: 'उपस्थिति चिह्नित करने के लिए एक श्रमिक चुनें',
    },
    a11y: {
      selectWorkerButton: 'श्रमिक चुनें',
      selectFarmsButton: 'खेत चुनें',
      setAllFullDay: 'सभी दिनों को पूर्ण दिवस पर सेट करें',
      setAllHalfDay: 'सभी दिनों को आधे दिन पर सेट करें',
      setAllAbsent: 'सभी दिनों को अनुपस्थित पर सेट करें',
      savingAttendance: 'उपस्थिति सहेजी जा रही है',
      saveAndNextWorker: 'उपस्थिति सहेजें और अगले श्रमिक पर जाएं',
      saveAndFinish: 'उपस्थिति सहेजें और समाप्त करें',
      goToNextWorker: 'अगले श्रमिक पर जाएं',
      dayStatus: '{{day}} {{date}}। {{status}}।',
    },
    empty: {
      noWorkersTitle: 'कोई श्रमिक उपलब्ध नहीं',
    },
    alerts: {
      partialErrorTitle: 'आंशिक त्रुटि',
      partialErrorBody: '{{count}} त्रुटि के साथ सहेजा गया। पुनः लोड हो रहा है…',
      savedTitle: 'सफलता',
      savedBody: '{{name}} के लिए उपस्थिति सहेजी गई।',
      completeTitle: 'पूर्ण',
      completeBody: 'सभी श्रमिक पूर्ण!',
    },
  },

  reports: {
    title: 'रिपोर्ट',
    types: {
      comprehensive: 'व्यापक',
      operations: 'संचालन',
      financial: 'वित्तीय',
    },
    noFarms: {
      title: 'कोई खेत नहीं मिला',
      subtitle: 'रिपोर्ट बनाने के लिए पहले एक खेत जोड़ें',
    },
    selectFarmLabel: 'खेत चुनें',
    selectFarmPlaceholder: 'खेत चुनें',
    dateRange: {
      label: 'तारीख सीमा',
    },
    reportType: {
      label: 'रिपोर्ट प्रकार',
    },
    loading: {
      preview: 'पूर्वावलोकन लोड हो रहा है…',
    },
    preview: {
      title: 'पूर्वावलोकन सारांश',
      counts: {
        irrigations_one: '{{count}} सिंचाई',
        irrigations_other: '{{count}} सिंचाई',
        sprays_one: '{{count}} छिड़काव',
        sprays_other: '{{count}} छिड़काव',
        harvests_one: '{{count}} कटाई',
        harvests_other: '{{count}} कटाई',
        expenses_one: '{{count}} खर्च',
        expenses_other: '{{count}} खर्च',
      },
    },
    exportAs: 'इस रूप में निर्यात करें',
    alerts: {
      exportFailedTitle: 'निर्यात विफल',
    },
    errors: {
      unableToExport: 'रिपोर्ट निर्यात करने में असमर्थ',
    },
    summary: {
      totalRecords: 'कुल रिकॉर्ड',
      waterUsage: 'पानी का उपयोग',
      totalHarvest: 'कुल कटाई',
      revenue: 'राजस्व',
      netProfit: 'शुद्ध लाभ',
    },
    export: {
      meta: {
        region: 'क्षेत्र',
        area: 'क्षेत्रफल',
        reportPeriod: 'रिपोर्ट अवधि',
        to: 'से',
      },
      summaryTitle: 'सारांश',
      generatedBy: '{{date}} को Vinesight द्वारा जेनरेट किया गया',
      moreRecords: '... और {{count}} अधिक रिकॉर्ड',
      sections: {
        irrigationRecords: 'सिंचाई रिकॉर्ड ({{count}})',
        sprayRecords: 'छिड़काव रिकॉर्ड ({{count}})',
        harvestRecords: 'कटाई रिकॉर्ड ({{count}})',
        expenseRecords: 'खर्च रिकॉर्ड ({{count}})',
      },
      table: {
        date: 'तारीख',
        duration: 'अवधि',
        area: 'क्षेत्रफल',
        growthStage: 'विकास चरण',
        discharge: 'डिस्चार्ज',
        chemical: 'रसायन',
        dose: 'खुराक',
        weather: 'मौसम',
        quantity: 'मात्रा',
        grade: 'ग्रेड',
        price: 'मूल्य',
        buyer: 'खरीदार',
        type: 'प्रकार',
        cost: 'लागत',
        remarks: 'टिप्पणियां',
      },
    },
  },
} as const;
