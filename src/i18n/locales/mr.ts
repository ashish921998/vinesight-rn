import { GLOSSARY_MR } from '../glossary.mr';

export const mr = {
  glossary: GLOSSARY_MR,

  common: {
    ok: 'ठीक आहे',
    cancel: 'रद्द',
    close: 'बंद',
    save: 'जतन करा',
    saveChanges: 'बदल जतन करा',
    delete: 'हटवा',
    edit: 'संपादित करा',
    back: 'मागे',
    goBack: 'मागे जा',
    next: 'पुढे',
    complete: 'पूर्ण करा',
    skip: 'वगळा',
    loading: 'लोड होत आहे…',
    saving: 'जतन होत आहे…',
    tryAgain: 'पुन्हा प्रयत्न करा',
    done: 'पूर्ण',
    reset: 'रीसेट',
    error: 'त्रुटी',
    unknownDate: 'अज्ञात दिनांक',
    missing: 'अनुपलब्ध',
    search: 'शोधा...',
    from: 'पासून',
    to: 'पर्यंत',
    selectDate: 'दिनांक निवडा',
    na: 'लागू नाही',
    general: 'सामान्य',
    filter: 'फिल्टर',
    clearAll: 'सर्व साफ करा',
    today: 'आज',
    yesterday: 'काल',
    units: {
      hours: 'तास',
      days: 'दिवस',
    },
    labels: {
      value: 'मूल्य',
      low: 'कमी',
      totalValue: 'एकूण मूल्य',
      quantity: 'प्रमाण',
      grade: 'दर्जा',
      unitPrice: 'युनिट किंमत',
      current: 'सध्याचे',
      avg: 'सरासरी',
      min: 'किमान',
      max: 'कमाल',
      readyToAdd: 'जोडण्यासाठी तयार',
      enterQuantityAndSelectGrade: 'प्रमाण नोंदवा आणि दर्जा निवडा',
      summary: 'सारांश',
    },
    noResultsFound: 'निकाल आढळले नाहीत',
    tryDifferentSearchTerm: 'वेगळा शोध शब्द वापरा',
    clearSearch: 'शोध साफ करा',
    a11y: {
      editWithName: '{{name}} संपादित करा',
      deleteWithName: '{{name}} हटवा',
      opensEditForm: 'संपादन फॉर्म उघडतो',
      deletesThisItem: 'हा आयटम हटवतो',
    },
    actions: {
      takePhoto: 'फोटो काढा',
      selectImage: 'प्रतिमा निवडा',
      selectPdf: 'PDF निवडा',
    },
    alerts: {
      missingInformationTitle: 'माहिती अपूर्ण',
      enterQuantityToAdd: 'कृपया जोडण्यासाठी प्रमाण टाका.',
      enterWorkerNameAndDailyRate: 'कृपया $t(glossary.worker) नाव आणि दैनिक दर टाका.',
      fillAllRequiredFields: 'कृपया आवश्यक सर्व माहिती भरा.',
    },
    errors: {
      missingFarmIdForUpdate: 'अद्ययावत करण्यासाठी $t(glossary.farm) आयडी उपलब्ध नाही.',
      failedToUpdateLog: 'नोंद अद्ययावत होऊ शकली नाही. कृपया पुन्हा प्रयत्न करा.',

      failedToUpdateFarm: '$t(glossary.farm) अद्ययावत होऊ शकले नाही. कृपया पुन्हा प्रयत्न करा.',
      failedToCreateFarm: '$t(glossary.farm) तयार होऊ शकले नाही. कृपया पुन्हा प्रयत्न करा.',

      enterAtLeastOneMoistureValue: 'कृपया किमान एक ओलावा मूल्य टाका.',
      failedToSaveSoilProfile:
        '$t(glossary.soil) प्रोफाइल जतन होऊ शकले नाही. कृपया पुन्हा प्रयत्न करा.',

      enterAtLeastOneParameterValue: 'कृपया किमान एक पॅरामीटर मूल्य टाका.',
      failedToSaveLabTest: '$t(glossary.labTest) जतन होऊ शकली नाही. कृपया पुन्हा प्रयत्न करा.',

      failedToUpdateStock: 'स्टॉक अद्ययावत होऊ शकला नाही. कृपया पुन्हा प्रयत्न करा.',
      failedToSaveWorker: '$t(glossary.worker) जतन होऊ शकला नाही. कृपया पुन्हा प्रयत्न करा.',

      failedToSaveLogs: 'नोंदी जतन होऊ शकल्या नाहीत. कृपया पुन्हा प्रयत्न करा.',
      enterTaskTitle: 'कृपया $t(glossary.task) शीर्षक टाका.',
      selectFarm: 'कृपया $t(glossary.farm) निवडा.',
      failedToSaveTask: '$t(glossary.task) जतन होऊ शकले नाही. कृपया पुन्हा प्रयत्न करा.',

      failedToLoadAttendance: '$t(glossary.attendance) लोड होऊ शकली नाही.',
      failedToLoadAttendanceData: '$t(glossary.attendance) डेटा लोड होऊ शकला नाही.',
      selectAtLeastOneFarm: 'कृपया किमान एक $t(glossary.farm) निवडा.',

      enterItemName: 'कृपया वस्तूचे नाव टाका.',
      enterValidQuantity: 'कृपया वैध प्रमाण टाका.',
      enterValidUnitPrice: 'कृपया वैध युनिट किंमत टाका.',
      failedToSaveItem: 'वस्तू जतन होऊ शकली नाही. कृपया पुन्हा प्रयत्न करा.',

      cannotDeleteLogFarmIdNotFound: 'नोंद हटवता येत नाही: $t(glossary.farm) आयडी आढळला नाही.',
      failedToDeleteLog: 'नोंद हटवता आली नाही. कृपया पुन्हा प्रयत्न करा.',
      farmNotFoundForLog: 'या नोंदीसाठी $t(glossary.farm) आढळले नाही.',
      failedToDeleteItem: 'वस्तू हटवता आली नाही.',

      failedToDeleteFarm: '$t(glossary.farm) हटवता आले नाही.',
      failedToDeleteWorker: '$t(glossary.worker) हटवता आला नाही.',

      noReportDataAvailable: '$t(glossary.report) डेटा उपलब्ध नाही.',

      invalidFarm: 'अवैध $t(glossary.farm)',
      invalidFarmNumericInput: 'कृपया $t(glossary.farm) तपशीलात वैध संख्यात्मक मूल्ये टाका.',
    },
  },

  sprayCatalog: {
    title: 'स्प्रे कॅटलॉग',
    subtitle: 'कीड आणि मोडनुसार मिक्स पाहा.',
    searchPlaceholder: 'मिक्स, $t(glossary.pest) किंवा उत्पादन शोधा',
    modeFilter: 'अर्ज मोड',
    modeAll: 'सर्व',
    modePreventive: 'प्रतिबंधक',
    modeCurative: 'उपचारात्मक',
    modeBoth: 'दोन्ही',
    pestFilter: 'लक्ष्य $t(glossary.pest)/समस्या',
    genericProblem: 'सामान्य संरक्षण',
    modeLabel: 'मोड: {{mode}}',
    openTankMix: 'टँक मिक्स कॅल्क्युलेटरमध्ये उघडा',
  },

  productDetail: {
    titleFallback: 'उत्पादन तपशील',
    activeIngredient: 'सक्रिय घटक: {{value}}',
    phiDays: 'PHI: {{days}} दिवस',
    usageCount: '{{count}} कॅटलॉग मिक्समध्ये वापरलेले',
  },

  farmDetails: {
    loadingFarm: '$t(glossary.farm) लोड होत आहे…',
    notFound: {
      title: '$t(glossary.farm) आढळले नाही',
    },
    deleteFarmTitle: '$t(glossary.farm) हटवा',
    deleteFarmBody:
      'आपण "{{name}}" $t(glossary.farm) हटवू इच्छिता का? यामुळे $t(glossary.irrigation) नोंदी, $t(glossary.spray) नोंदी, $t(glossary.harvest), $t(glossary.expense), $t(glossary.soil) प्रोफाइल आणि इतर संबंधित डेटा देखील हटवला जाईल. ही कृती परत करता येणार नाही.',
    errors: {
      completeTaskFailed: '$t(glossary.task) पूर्ण करता आले नाही.',
      deleteTaskFailed: '$t(glossary.task) हटवता आले नाही.',
      deleteFarmFailed: '$t(glossary.farm) हटवता आले नाही.',
    },
    header: {
      areaAcres: '{{value}} एकर',
      areaAcresUnknown: '— एकर',
    },
    pruning: {
      daysShort: '{{count}}दि',
    },
    weather: {
      current: 'सध्याचे $t(glossary.weather)',
      temperature: 'तापमान',
      et0Mm: 'ET0 (mm)',
    },
    stats: {
      logEntriesTitle: 'नोंदी',
      recordsSubtitle: 'रेकॉर्ड्स',
      soilWaterTitle: '$t(glossary.soil)तील पाणी',
    },
    safeHarvest: {
      title: 'लवकरात लवकर सुरक्षित $t(glossary.harvest)',
      noTarget: 'या हंगामासाठी लक्ष्य $t(glossary.harvest) दिनांक सेट केलेला नाही.',
      noData: 'अजून PHI आधारित $t(glossary.spray) नोंदी उपलब्ध नाहीत.',
      safeDate: '{{date}} पासून सुरक्षित',
      inlineDate: 'सुरक्षित $t(glossary.harvest) दिनांक: {{date}}',
      blockedBy: '{{reason}} मुळे अडथळा',
      ctaSetTarget: 'लक्ष्य दिनांक सेट करा',
      ctaOpenChecker: 'Safe-to-spray तपासा',
      saveTarget: 'लक्ष्य दिनांक जतन करा',
    },
    water: {
      noIrrigationLoggedYet: 'अजून $t(glossary.irrigation) नोंदवलेले नाही',
      mmUsed: '{{value}} mm वापरले',
      captionThisSeason: 'या हंगामात {{usage}}',
      captionLogIrrigation: 'पाणी वापर मॉनिटर करण्यासाठी $t(glossary.irrigation) नोंदवा',
    },
    seasons: {
      title: 'हंगाम',
      formTitle: 'हंगाम समाप्त करा',
      startFormTitle: 'हंगाम सुरू करा',
      firstTimeHint: 'पहिल्यांदा हंगाम समाप्त करत आहात? हंगामाची सुरुवात आणि समाप्ती तारीख भरा.',
      startHint: 'पिकानुसार टेम्पलेट निवडा आणि सुरूवातीची तारीख निश्चित करा.',
      lastEndDate: 'मागील हंगाम {{date}} ला संपला. पुढील हंगामाची सुरुवात आपोआप सेट होईल.',
      startDateLabel: 'हंगाम सुरूवात तारीख',
      endDateLabel: 'हंगाम समाप्ती तारीख',
      templateLabel: 'हंगाम टेम्पलेट',
      seasonNameLabel: 'हंगाम नाव (ऐच्छिक)',
      seasonNamePlaceholder: 'उदा. Summer 2026',
      templateHint: 'निवडलेले टेम्पलेट: {{template}}',
      showEndSeasonForm: 'हंगाम समाप्त करा',
      startSeasonButton: 'हंगाम सुरू करा',
      endSeasonButton: 'हंगाम जतन करा',
      statusActive: '{{start}} पासून सक्रिय',
      statusNone: 'सक्रिय हंगाम नाही',
      reviewRequiredBadge: 'हंगाम इतिहास तपासा',
      betweenSeasonsBadge: 'हंगाम संपला',
      betweenSeasonsHint: 'हंगाम संपला. पुढील हंगाम {{date}} पासून सुरू होईल.',
      actions: {
        startSeasonToContinue: 'नोंदी जोडण्यासाठी आधी हंगाम सुरू करा.',
      },
      alerts: {
        startSuccessTitle: 'हंगाम यशस्वीरित्या सुरू झाला',
        startSuccess: 'नवीन हंगाम आता सक्रिय आहे.',
        endSuccessTitle: 'हंगाम यशस्वीरित्या संपला',
        endSuccess: 'हंगाम यशस्वीरित्या समाप्त झाला.',
        reviewQueuedSuccess: 'हंगाम असाइनमेंट पुनरावलोकन यशस्वीरित्या सुरू केले.',
      },
      errors: {
        invalidRange: 'हंगाम समाप्ती तारीख सुरूवातीच्या तारखेपेक्षा नंतरची असावी.',
        startBeforeAllowed: 'हंगाम सुरूवात तारीख मागील हंगाम समाप्तीनंतरची असावी.',
        duplicateEndDate: 'ही हंगाम समाप्ती तारीख आधीच जतन केलेली आहे.',
        startFailed: 'हंगाम सुरू करता आला नाही.',
        endFailed: 'हंगाम समाप्त करता आला नाही.',
        noActiveSeason: 'या शेतासाठी सक्रिय हंगाम आढळला नाही.',
        reviewQueueFailed: 'हंगाम असाइनमेंट पुनरावलोकन सुरू करता आले नाही.',
        activeSeasonExists:
          'सक्रिय हंगाम आहे. कृपया नवीन हंगाम तयार करण्यापूर्वी वर्तमान हंगाम समाप्त करा.',
      },
    },
    workboard: {
      title: 'वर्कबोर्ड',
      subtitle: 'टूल्स आणि संसाधनांना पटकन प्रवेश.',
      actions: {
        ai: 'AI सहाय्यक',
        lab: 'तपासणी',
        reports: '$t(glossary.report)',
        soilMoisture: '$t(glossary.soil)तील ओलावा',
        tempWorker: 'तात्पुरता\n$t(glossary.worker)',
      },
    },
    fertilizerPlan: {
      title: '$t(glossary.fertilizer) योजना',
      subtitle: 'या शेतासाठी सल्लागाराने दिलेली योजना.',
      upcomingCount_one: '{{count}} आयटम',
      upcomingCount_other: '{{count}} आयटम',
      emptyTitle: 'सध्या $t(glossary.fertilizer) योजना नाही',
      emptySubtitle: 'तुमच्या सल्लागाराने अद्याप योजना शेअर केलेली नाही.',
      cta: 'सल्लागाराशी संपर्क करा',
      consultantLabel: '{{name}} यांची योजना',
      consultantUnknown: 'सल्लागार योजना',
      updatedLabel: '{{date}} रोजी अद्ययावत',
      loading: 'योजना लोड होत आहे…',
      inputsCount_one: '{{count}} इनपुट',
      inputsCount_other: '{{count}} इनपुट',
      noInputs: 'इनपुट नाहीत',
      unknownInput: 'अज्ञात इनपुट',
    },
    tabs: {
      activities: 'नोंदी',
      tasks: 'कामे',
    },
    activities: {
      empty: {
        title: 'अजून नोंदी नाहीत',
        subtitle: 'इथे पाहण्यासाठी नोंदी करायला सुरुवात करा',
        filteredTitle: 'जुळणाऱ्या नोंदी नाहीत',
        filteredSubtitle: 'तुमचे फिल्टर बदलून पहा',
      },
    },
    tasks: {
      empty: {
        title: 'अजून कामे नाहीत',
        subtitleAndroid: '+ बटण टॅप करून कामे तयार करा',
        subtitleIos: 'खालील बटण वापरून $t(glossary.task) जोडा',
      },
    },
    actions: {
      addActivity: 'नोंद जोडा',
      seeAllLogs: 'सर्व नोंदी पहा',
      seeAllTasks: 'सर्व $t(glossary.task) पहा',
      menuTitle: '$t(glossary.farm) क्रिया',
      editFarm: '$t(glossary.farm) संपादित करा',
      startSeason: 'हंगाम सुरू करा',
      endSeason: 'हंगाम समाप्त करा',
      reviewSeasonHistory: 'हंगाम इतिहास तपासा',
    },
    a11y: {
      editFarm: '$t(glossary.farm) संपादित करा',
      deleteFarm: '$t(glossary.farm) हटवा',
      openFarmActions: '$t(glossary.farm) क्रिया उघडा',
      showActivities: 'नोंदी दाखवा',
      showTasks: 'कामे दाखवा',
      taskCompleted: '$t(glossary.task) पूर्ण',
      markTaskComplete: '$t(glossary.task) पूर्ण म्हणून चिन्हांकित करा',
      deleteTask: '$t(glossary.task) हटवा: {{title}}',
      editActivity: 'क्रियाकलाप संपादित करा: {{type}}',
      deleteActivity: 'क्रियाकलाप हटवा: {{type}}',
    },
  },

  farmCard: {
    status: {
      needsAttention: 'लक्ष आवश्यक',
      healthy: 'निरोगी',
    },
    area: {
      acres: '{{value}} एकर',
      unknownAcres: '— एकर',
    },
    waterBalance: {
      label: 'पाणी शिल्लक',
      value: '{{value}} mm',
      unknown: '—',
    },
    region: {
      label: 'स्थान',
      unknown: 'अज्ञात',
    },
    a11y: {
      editFarm: '$t(glossary.farm) संपादित करा: {{name}}',
      deleteFarm: '$t(glossary.farm) हटवा: {{name}}',
    },
  },

  farmForm: {
    title: {
      add: '$t(glossary.farm) जोडा',
      edit: '$t(glossary.farm) संपादित करा',
    },
    saveLabel: {
      createFarm: '$t(glossary.farm) तयार करा',
    },
    sections: {
      details: '$t(glossary.farm) तपशील',
      cropType: 'पीक प्रकार',
      variety: 'वाण',
      plantingDate: 'लागवड दिनांक',
      plantSpacingOptional: 'लागवडीचे अंतर (ऐच्छिक)',
      irrigationDetailsOptional: '$t(glossary.irrigation) तपशील (ऐच्छिक)',
      pruningDateOptional: '$t(glossary.pruning) दिनांक (ऐच्छिक)',
      locationOptional: 'ठिकाण (ऐच्छिक)',
      soilPropertiesOptional: '$t(glossary.soil) गुणधर्म (ऐच्छिक)',
      soilTexture: '$t(glossary.soil)चा पोत',
    },
    fields: {
      name: {
        label: '$t(glossary.farm) नाव',
        placeholder: 'उदा., सनसेट व्हाइनयार्ड्स',
      },
      region: {
        label: 'स्थान',
        placeholder: 'उदा., नाशिक, महाराष्ट्र',
      },
      area: {
        label: 'क्षेत्रफळ',
        placeholder: '10',
      },
      vineSpacing: {
        label: 'वेल अंतर',
      },
      rowSpacing: {
        label: 'ओळ अंतर',
      },
      tankCapacity: {
        label: 'टँक क्षमता',
      },
      systemDischarge: {
        label: 'सिस्टम डिस्चार्ज',
      },
      pruningDate: {
        label: '$t(glossary.pruning) दिनांक',
        notSet: 'सेट नाही',
      },
      locationName: {
        label: 'ठिकाण नाव',
        placeholder: 'उदा., उत्तर बाजूचा भाग',
      },
      latitude: {
        label: 'अक्षांश',
      },
      longitude: {
        label: 'रेखांश',
      },
      elevation: {
        label: 'उंची',
      },
      bulkDensity: {
        label: 'बल्क घनता',
      },
      cationExchangeCapacity: {
        label: 'कॅटायन एक्स्चेंज क्षमता',
      },
      soilWaterRetention: {
        label: '$t(glossary.soil) पाणी धारण',
      },
      sandPercentage: {
        label: 'वाळू',
      },
      siltPercentage: {
        label: 'गाळ',
      },
      clayPercentage: {
        label: 'चिकणमाती',
      },
    },
    cropOptions: {
      grapes: {
        label: 'द्राक्ष',
        sublabel: 'वेली',
      },
      mango: {
        label: 'आंबा',
        sublabel: 'झाडे',
      },
      pomegranate: {
        label: 'डाळिंब',
        sublabel: 'फळ',
      },
      citrus: {
        label: 'लिंबूवर्गीय',
        sublabel: 'झाडे',
      },
      banana: {
        label: 'केळी',
        sublabel: 'झाडे',
      },
      tomato: {
        label: 'टोमॅटो',
        sublabel: 'झाडे',
      },
      sugarcane: {
        label: 'ऊस',
        sublabel: 'पीक',
      },
      guava: {
        label: 'पेरू',
        sublabel: 'झाडे',
      },
      other: {
        label: 'इतर',
        sublabel: 'कस्टम',
      },
    },
    cropPicker: {
      modalTitle: 'पीक निवडा',
      searchPlaceholder: 'पीक शोधा',
      defaultSublabel: 'पीक',
      customCropLabel: 'कस्टम पीक',
      customCropInputLabel: 'कस्टम पीक नाव',
      customCropInputPlaceholder: 'पीक नाव टाका',
      useCustomCrop: '"{{crop}}" वापरा',
      noResults: 'जुळणारी पीके आढळली नाहीत',
    },
    variety: {
      selectPlaceholder: 'वाण निवडा',
      custom: 'कस्टम',
      customNameLabel: 'कस्टम वाण नाव',
      customNamePlaceholder: 'वाण नाव टाका',
      modalTitle: 'वाण निवडा',
      searchPlaceholder: 'वाण शोधा',
    },
    plantingDate: {
      selectPlaceholder: 'दिनांक निवडा',
    },
    location: {
      selectOnMap: 'नकाशावर ठिकाण निवडा',
    },
    soilTexture: {
      selectPlaceholder: 'पोत निवडा',
      modalTitle: '$t(glossary.soil)चा पोत निवडा',
      options: {
        sand: 'वाळू',
        loamySand: 'लोमी वाळू',
        sandyLoam: 'वाळूयुक्त लोम',
        loam: 'लोम',
        siltLoam: 'गाळयुक्त लोम',
        silt: 'गाळ',
        sandyClayLoam: 'वाळूयुक्त चिकण लोम',
        clayLoam: 'चिकण लोम',
        siltyClayLoam: 'गाळयुक्त चिकण लोम',
        sandyClay: 'वाळूयुक्त चिकण',
        siltyClay: 'गाळयुक्त चिकण',
        clay: 'चिकण',
      },
    },
    soilCompositionWarning: 'वाळू + गाळ + चिकण यांची बेरीज सुमारे 100% असावी (सध्या {{total}}%)',
    soilCompositionHint:
      'वाळू, गाळ आणि चिकणमातीचे टक्केवारी (0-100) टाका, ज्यांची बेरीज सुमारे 100% असेल.',
    overflowError: '{{fields}} चे मूल्य {{max}} पेक्षा जास्त नसावे.',
    infoCardMessage: 'तुम्ही हे तपशील नंतर $t(glossary.farm) सेटिंग्जमधून कधीही अद्ययावत करू शकता.',
  },

  logs: {
    screenTitle: '$t(glossary.farm) नोंदी',
    irrigationDurationHoursShort: '{{hours}} ता',
    sprayApplication: '$t(glossary.spray)',
    harvestDescription: '{{quantityKg}}kg - {{grade}}',
    expenseDescription: '{{cost}} - {{type}}',
    fertigationApplied_one: '{{countFormatted}} $t(glossary.fertigation) वापरले',
    fertigationApplied_other: '{{countFormatted}} $t(glossary.fertigation)े वापरली',
    types: {
      irrigation: '$t(glossary.irrigation)',
      spray: '$t(glossary.spray)',
      harvest: '$t(glossary.harvest)',
      expense: '$t(glossary.expense)',
      fertigation: '$t(glossary.fertigation)',
      note: 'नोंद',
    },
    labels: {
      selectedFarm: 'निवडलेले $t(glossary.farm)',
    },
    farmPicker: {
      title: '$t(glossary.farm) निवडा',
      allFarms: 'सर्व $t(glossary.farm)',
      selectFarm: '$t(glossary.farm) निवडा',
      farmsCount_one: '{{count}} $t(glossary.farm)',
      farmsCount_other: '{{count}} $t(glossary.farm)',
    },
    search: {
      placeholder: 'नोंदी शोधा…',
    },
    filters: {
      activityTypes: 'क्रियाकलाप प्रकार',
      dateRange: 'तारीख श्रेणी',
    },
    empty: {
      title: 'क्रियाकलाप नोंदी आढळल्या नाहीत',
      subtitleFiltered: 'फिल्टर बदलून पाहा',
      subtitleDefault: 'इथे पाहण्यासाठी क्रियाकलाप नोंदवायला सुरुवात करा',
    },
    pagination: {
      showing: 'एकूण {{total}} पैकी {{start}}-{{end}} दाखवत आहे',
      perPage: 'प्रति पृष्ठ {{count}}',
      recordsPerPage: 'प्रति पृष्ठ नोंदी',
    },
    datePicker: {
      fromTitle: 'पासूनचा दिनांक निवडा',
      toTitle: 'पर्यंतचा दिनांक निवडा',
    },
    delete: {
      title: 'नोंद हटवायची?',
      body: '{{date}} ची {{type}} नोंद हटवायची आहे का?',
    },
    cta: {
      addActivity: '$t(glossary.activity) जोडा',
    },
  },

  farms: {
    addFarm: '$t(glossary.farm) जोडा',
    empty: {
      title: 'अजून $t(glossary.farm) नाहीत',
      subtitle:
        'सुरू करण्यासाठी पहिले $t(glossary.farm) जोडा आणि $t(glossary.irrigation), $t(glossary.spray), $t(glossary.harvest) ट्रॅक करा.',
    },
    search: {
      placeholder: '$t(glossary.farm) शोधा...',
      found_one: '{{count}} $t(glossary.farm) आढळली',
      found_other: '{{count}} $t(glossary.farm) आढळली',
    },
    stats: {
      totalFarms: 'एकूण $t(glossary.farm)',
      totalArea: 'एकूण क्षेत्रफळ',
    },
  },

  entryForm: {
    activityType: 'क्रियाकलाप प्रकार',
    selectActivityTypeHint: 'पूर्ण फॉर्म उघडण्यासाठी क्रियाकलाप प्रकार निवडा.',
    useTemplate: 'टेम्पलेट वापरा',
    addEntry: 'नोंद जोडा',
    addLog: 'नोंद जोडा',
    addTask: '$t(glossary.task) जोडा',
    editTask: '$t(glossary.task) संपादित करा',
    selectDate: 'दिनांक निवडा',
    selectDueDate: 'देय दिनांक निवडा',
    done: 'पूर्ण',
    selectTaskType: '$t(glossary.task) प्रकार निवडा',
    selectPriority: 'प्राधान्य निवडा',
    saveLogs: 'नोंदी जतन करा ({{count}})',
    saveTask: '$t(glossary.task) जतन करा',
    farmLabel: '$t(glossary.farm) *',
    selectFarm: '$t(glossary.farm) निवडा',
    allFarms: 'सर्व $t(glossary.farm)',
    allFarmsExpenseOnly: 'सर्व $t(glossary.farm) पर्याय फक्त $t(glossary.expense) नोंदीसाठी आहे.',
    allFarmsNoFarms: 'हा $t(glossary.expense) लागू करण्यासाठी $t(glossary.farm) उपलब्ध नाहीत.',
    partialSuccess: {
      title: 'आंशिक यश',
      body_one: '{{count}} लॉग जतन करण्यात अयशस्वी. कृपया पुन्हा प्रयत्न करा.',
      body_other: '{{count}} लॉग जतन करण्यात अयशस्वी. कृपया पुन्हा प्रयत्न करा.',
    },
    taskCompletionLinkFailed:
      'नोंदी जतन झाल्या, पण स्रोत $t(glossary.task) पूर्ण म्हणून चिन्हांकित करता आले नाही.',
    plannedSprayInputs: 'नियोजित $t(glossary.spray) इनपुट',
    plannedFertilizers: 'नियोजित खते',
    plannedItemNamePlaceholder: 'नाव',
    plannedItemQtyPlaceholder: 'प्रमाण',
    taskForm: {
      titleLabel: 'शीर्षक *',
      titlePlaceholder: '$t(glossary.task) शीर्षक प्रविष्ट करा',
      descriptionLabel: 'वर्णन',
      descriptionPlaceholder: 'या $t(glossary.task) बद्दल तपशील जोडा',
      typeLabel: 'प्रकार',
      priorityLabel: 'प्राधान्य',
      dueDateLabel: 'देय दिनांक',
      selectDueDate: 'देय दिनांक निवडा',
      selectDueDateTitle: 'देय दिनांक निवडा',
    },
    drafts_one: '{{count}} मसुदा',
    drafts_other: '{{count}} मसुदे',
    pendingLogs_one: 'प्रलंबित नोंदी ({{count}})',
    pendingLogs_other: 'प्रलंबित नोंदी ({{count}})',
    tabs: {
      log: '$t(glossary.farm) नोंद',
      task: '$t(glossary.task)',
    },
    discardChanges: {
      title: 'बदल रद्द करायचे?',
      taskOnly: 'जतन न केलेले $t(glossary.task) बदल आहेत. बंद करायचे आहे का?',
      logsOnly: 'जतन न केलेल्या नोंदी आहेत. बंद करायचे आहे का?',
      both: 'जतन न केलेले बदल आहेत. बंद करायचे आहे का?',
      discard: 'रद्द करा',
    },
    phiErrors: {
      catalogRequiredTitle: 'कॅटलॉग मिक्स आवश्यक',
      catalogRequiredBody: 'ही $t(glossary.spray) नोंद जोडण्यापूर्वी प्रीलोडेड मिक्स निवडा.',
      computeFailedTitle: 'PHI उपलब्ध नाही',
      computeFailedBody: 'निवडलेल्या दिनांकासाठी PHI गणना करता आली नाही.',
      conflictTitle: '$t(glossary.harvest) सुरक्षा संघर्ष',
      conflictBody:
        'हा $t(glossary.spray) {{component}} मुळे {{safeDate}} पर्यंत $t(glossary.harvest) थांबवतो, पण लक्ष्य दिनांक {{targetDate}} आहे.',
    },
  },

  activityEdit: {
    title: 'नोंद संपादित करा',
    detailsTitle: 'नोंद तपशील',
    dateLabel: 'दिनांक',
    loadErrorTitle: 'क्रियाकलाप तपशील लोड होऊ शकले नाहीत.',
    loadErrorBody: 'कृपया क्रियाकलाप यादीतून पुन्हा प्रयत्न करा.',
  },

  sprayForm: {
    title: '$t(glossary.spray)',
    subtitle: 'रसायने आणि पाणी मात्रा नोंदवा',
    waterVolume: {
      label: 'पाणी मात्रा',
      placeholder: 'प्रमाण टाका',
      unitLiters: 'लिटर',
      hint: 'स्प्रे मिश्रणासाठी वापरलेले एकूण पाणी',
    },
    chemicals: {
      label: 'रसायने',
      addChemical: 'रसायन जोडा',
      namePlaceholder: 'रसायनाचे नाव',
      qtyPlaceholder: 'प्रमाण',
      selectUnit: 'युनिट निवडा',
      totalQty: 'एकूण प्रमाण',
      perAcre: 'प्रति एकर',
    },
    quickAdd: 'जलद जोडा',
    catalogOnly: {
      title: 'कॅटलॉग मिक्स',
      selectedMix: 'निवडलेले: {{name}}',
      requiredHint: 'पुढे जाण्यासाठी कॅटलॉग मिक्स निवडा',
      fallbackLabel: 'कॅटलॉग मिक्स',
    },
    catalogOptional: {
      title: 'कॅटलॉग मिक्स (ऐच्छिक)',
      hint: 'ऐच्छिक: PHI तपासणी सक्षम करण्यासाठी कॅटलॉग मिक्स निवडा',
    },
    noMatchesHint: 'जुळणारे सापडले नाही. सानुकूल रसायन नावासह पुढे जा.',
    validation: {
      ready: 'जोडण्यासाठी तयार',
      incomplete: 'पाणी मात्रा आणि किमान एक रसायन जोडा',
    },
  },

  fertigationForm: {
    title: 'फर्टिगेशन',
    subtitle: '$t(glossary.fertigation) अनुप्रयोग नोंदवा',
    waterVolume: {
      label: 'पाणी मात्रा',
      placeholder: 'प्रमाण टाका',
      unitLiters: 'लिटर',
      hint: 'फर्टिगेशनसाठी वापरलेले एकूण पाणी (वैकल्पिक)',
    },
    fertilizers: {
      label: 'खते',
      addFertilizer: '$t(glossary.fertigation) जोडा',
      namePlaceholder: 'खताचे नाव',
      qtyPlaceholder: 'प्रमाण',
      selectUnit: 'युनिट निवडा',
    },
    quickAdd: 'जलद जोडा',
    noMatchesHint: 'जुळणारे सापडले नाही. सानुकूल $t(glossary.fertigation) नावासह पुढे जा.',
    validation: {
      ready: 'जोडण्यासाठी तयार',
      incomplete: 'किमान एक $t(glossary.fertigation) आणि मात्रा जोडा',
    },
  },

  irrigationForm: {
    title: '$t(glossary.irrigation)',
    subtitle: '$t(glossary.irrigation) कालावधी नोंदवा',
    durationLabel: 'कालावधी',
    durationPlaceholder: 'कालावधी नोंदवा',
    durationUnit: 'तास',
    durationHint: '$t(glossary.irrigation) चक्र किती वेळ चाललं?',
    enterHoursGuidance: 'पुढे जाण्यासाठी $t(glossary.irrigation) तास नोंदवा.',
    validation: {
      ready: 'जोडण्यासाठी तयार',
      incomplete: 'पुढे जाण्यासाठी कालावधी नोंदवा',
    },
    areaLabel: 'क्षेत्र',
    estimatedWaterLabel: 'अंदाजे पाणी',
  },

  expenseForm: {
    title: '$t(glossary.expense)',
    subtitle: '$t(glossary.farm) $t(glossary.expense) नोंदवा',
    category: 'श्रेणी',
    amount: 'रक्कम',
    amountPlaceholder: 'रक्कम नोंदवा',
    amountHint: 'एकूण खर्चाची रक्कम',
    types: {
      Equipment: 'उपकरण',
      Fuel: 'इंधन',
      'Seeds/Plants': 'बिया/झाडे',
      Packaging: 'पॅकेजिंग',
      Transport: 'वाहतूक',
      Maintenance: 'देखभाल',
      Other: 'इतर',
    },
    remarks: {
      label: 'टिप्पण्या',
      placeholder: 'या खर्चाबद्दल टिप्पण्या जोडा (पर्यायी)',
      hint: 'पर्यायी - $t(glossary.expense) वर्णन करा',
    },
    validation: {
      selectCategoryAndEnterAmount: 'श्रेणी निवडा आणि रक्कम नोंदवा',
    },
  },

  harvestForm: {
    title: '$t(glossary.harvest)',
    subtitle: 'कापणीची प्रमाण आणि तपशील नोंदवा',
    quantityLabel: 'प्रमाण',
    quantityPlaceholder: 'प्रमाण नोंदवा',
    unitKg: 'किग्रा',
    quantityHint: 'एकूण कापणीचे वजन',
    pricePerKgLabel: 'प्रति किग्रा किंमत',
    pricePerKgPlaceholder: 'किंमत नोंदवा',
    pricePerKgHint: 'पर्यायी - प्रति किलोग्राम किंमत',
    buyerLabel: 'खरेदीदार',
    buyerPlaceholder: 'खरेदीदाराचे नाव नोंदवा (पर्यायी)',
    buyerHint: 'पर्यायी - कोणी $t(glossary.harvest) विकत घेतली',
    grades: {
      exportQuality: 'निर्यात दर्जा',
      premium: 'प्रीमियम',
      standard: 'मानक',
      reject: 'अस्वीकार',
    },
  },

  analytics: {
    title: 'विश्लेषण',
    labels: {
      irrigationHours: '$t(glossary.irrigation) तास',
      sprayApplications: '$t(glossary.spray) वापर',
      totalHarvest: 'एकूण $t(glossary.harvest)',
      harvestValue: '$t(glossary.harvest) मूल्य',
      performanceScore: 'कामगिरी गुण',
    },
    sections: {
      overview: 'आढावा',
      trends: 'कल',
      comparisons: 'तुलना',
    },
    timeRanges: {
      last7Days: 'शेवटचे 7 दिवस',
      last30Days: 'शेवटचे 30 दिवस',
      yearToDate: 'वर्षापासून',
    },
    loading: 'विश्लेषण लोड होत आहे...',
    empty: {
      title: 'डेटा उपलब्ध नाही',
      description: 'विश्लेषण पाहण्यासाठी $t(glossary.farm) क्रियाकलाप जोडा.',
    },
    metrics: {
      revenue: 'उत्पन्न',
      expenses: '$t(glossary.expense)',
      roi: 'ROI',
    },
    categories: {
      irrigation: '$t(glossary.irrigation)',
      spray: '$t(glossary.spray)',
      harvest: '$t(glossary.harvest)',
      expense: '$t(glossary.expense)',
      efficiency: 'कार्यक्षमता',
    },
  },

  tools: {
    subtitle: 'कॅल्क्युलेटर आणि साधने',
    sections: {
      calculators: 'कॅल्क्युलेटर',
    },
    items: {
      weatherIrrigation: '$t(glossary.weather) आणि $t(glossary.irrigation)',
      madCalculator: 'MAD कॅल्क्युलेटर',
      systemDischarge: 'सिस्टम डिस्चार्ज',
      laiCalculator: 'LAI कॅल्क्युलेटर',
      nutrientCalculator: 'पोषक कॅल्क्युलेटर',
      tankMixCalculator: 'टँक मिक्स कॅल्क्युलेटर',
      safeToSprayChecker: 'Safe-to-spray तपासणी',
      sprayCatalog: 'स्प्रे कॅटलॉग',
    },
    descriptions: {
      weatherIrrigation:
        '$t(glossary.weather) अंदाज पहा आणि ET0 वरून $t(glossary.irrigation) आवश्यकता गणा',
      madCalculator: 'तुमच्या पिकांसाठी Maximum Allowable Depletion गणा',
      systemDischarge: '$t(glossary.irrigation) सिस्टम डिस्चार्ज दर गणा आणि ट्रॅक करा',
      laiCalculator: 'कॅनपी व्यवस्थापनासाठी Leaf Area Index गणा',
      nutrientCalculator:
        '$t(glossary.labTest) वरून $t(glossary.fertigation) आणि पोषक आवश्यकता गणा',
      tankMixCalculator: 'टँक क्षमतेनुसार प्रत्येक घटकाचे अचूक gm/ml प्रमाण काढा',
      safeToSprayChecker: 'लक्ष्य $t(glossary.harvest) दिनांकासाठी सुरक्षित स्प्रे विंडो तपासा',
      sprayCatalog: '$t(glossary.pest), मोड आणि PHI सह कॅटलॉग स्प्रे/मिक्स ब्राउझ करा',
    },
  },

  tankMix: {
    title: 'टँक मिक्स कॅल्क्युलेटर',
    subtitle: 'कॅटलॉग मिक्स निवडा आणि टँकसाठी अचूक प्रमाण काढा.',
    searchLabel: 'मिक्स शोधा',
    searchPlaceholder: 'मिक्स किंवा समस्या शोधा',
    tankSizeLabel: 'टँक आकार (लिटर)',
    catalogMixes: 'कॅटलॉग मिक्स',
    genericProblem: 'सामान्य संरक्षण',
    resultTitle: '{{liters}}L साठी आवश्यक प्रमाण',
    resultDose: 'डोस: {{value}} {{unit}} ({{basis}})',
    resultTotal: 'एकूण: {{value}} {{unit}}',
    shareSummary: 'मिक्स सारांश शेअर करा',
  },

  safeToSpray: {
    title: 'Safe-to-spray तपासणी',
    subtitle: 'लक्ष्य $t(glossary.harvest) दिनांक टाका आणि सुरक्षित स्प्रे पाहा.',
    searchLabel: 'मिक्स, कीड किंवा उत्पादन शोधा',
    searchPlaceholder: 'मिक्स, कीड किंवा उत्पादन शोधा',
    targetDate: 'लक्ष्य $t(glossary.harvest) दिनांक',
    saveSeasonTarget: 'हा दिनांक हंगामासाठी जतन करा',
    blocking: 'गव्हर्निंग PHI: {{days}} दिवस ({{component}})',
    latestDate: 'शेवटचा सुरक्षित स्प्रे दिनांक: {{date}}',
    daysLeft: '{{count}} दिवस शिल्लक',
    windowPassed: 'विंडो {{count}} दिवसांपूर्वी संपली',
  },

  widgets: {
    common: {
      loading: 'लोड होत आहे…',
      error: 'डेटा लोड करण्यात अयशस्वी',
      empty: 'कोणतेही डेटा उपलब्ध नाही',
      retry: 'पुन्हा प्रयत्न करा',
    },
    quickStats: {
      title: 'जलद आकडे',
      loading: 'जलद आकडे लोड होत आहेत',
      error: 'जलद आकड्यांमध्ये त्रुटी',
      empty: 'जलद आकडे उपलब्ध नाहीत',
      overview: 'जलद आकड्यांचा आढावा',
      trendLabel: 'कल',
      statAccessibility: '{{label}}: {{value}}, {{trendLabel}} {{trendDirection}} {{trendValue}}',
      trend: {
        up: 'वाढ',
        down: 'घट',
        neutral: 'बदल नाही',
      },
      stats: {
        activeFarms: 'सक्रिय शेते',
        workersToday: 'आजचे $t(glossary.worker)',
        waterReserve: 'पाण्याचा साठा',
        seasonExpenses: 'हंगामाचा $t(glossary.expense)',
      },
    },
    weather: {
      title: 'व्हाइनयार्ड $t(glossary.weather)',
      conditions: {
        sunny: 'सूर्यप्रकाश',
        cloudy: 'ढगाळ',
        rainy: 'पावसाळी',
        partlyCloudy: 'आंशिक ढगाळ',
      },
      humidity: 'नमी',
      wind: 'वारा',
      forecast: '3 दिवसांचा अंदाज',
      days: {
        today: 'आज',
        tomorrow: 'उद्या',
        dayAfter: 'त्यानंतर',
      },
    },
    vineyardHealth: {
      title: 'व्हाइनयार्ड आरोग्य',
      overallStatus: 'एकंदरीत स्थिती',
      metrics: {
        waterStatus: 'पाण्याची स्थिती',
        diseaseRisk: 'रोगाचा धोका',
        growthStage: 'वाढीचा टप्पा',
        soilMoisture: 'मातीची नमी',
      },
      values: {
        minimal: 'किमान',
        veraison: 'Véraison',
      },
    },
    taskSummary: {
      title: 'आगामी कार्ये',
      tasksCount: '{{count}} कार्ये',
      overdueCount: '{{count}} विलंबित',
      status: {
        overdue: 'विलंबित',
        dueToday: 'आज देय',
        upcoming: 'आगामी',
      },
      labels: {
        irrigationBlockA: '$t(glossary.irrigation) - ब्लॉक A',
        sprayFungicide: 'स्प्रे - फंगिसाइड',
        fertigationRound3: 'फर्टिगेशन फेज 3',
        harvestSampling: 'हार्वेस्ट सॅम्पलिंग',
        dueToday: 'आज देय',
        tomorrow: 'उद्या',
        in3Days: '3 दिवसांत',
        overdue: 'विलंबित',
      },
      empty: 'कोणतेही आगामी कार्य नाहीत',
    },
    template: {
      title: 'विजेट टेम्पलेट',
      testWidget: {
        label: 'टेस्ट विजेट',
      },
    },
  },

  developerTools: {
    section: 'डेव्हलपर',
    widgetShowcase: {
      title: 'विजेट शोकेस',
      description: 'iOS, Android आणि Web वर विजेट्स एका स्क्रीनवरून पहा.',
    },
  },

  calculator: {
    mad: {
      title: 'MAD कॅल्क्युलेटर',
      step1: {
        title: 'चरण 1: MAD गणना',
        label: {
          dbl: 'ओळींमधील अंतर (DBL)',
          rootDepth: 'मुळांची खोली',
          rootWidth: 'मुळांची रुंदी',
          waterRetention: 'पाणी धारण क्षमता',
        },
        placeholder: {
          dbl: '3.0',
          rootDepth: '0.6',
          rootWidth: '1.5',
          waterRetention: '15',
        },
        unit: {
          meters: 'मी',
          percent: '%',
        },
        calculateButton: 'MAD गणा',
      },
      step2: {
        title: 'चरण 2: रीफिल टँक कॅल्क्युलेटर',
        selectRefillSpan: 'रीफिल कालावधी निवडा',
        refillSpanGuidance: 'रीफिल कालावधी मार्गदर्शक:',
        guidance: {
          heavy: 'जास्त वाढ (0.2): फळ लावणे - टर्गर राखा',
          normal: 'सामान्य वाढ (0.3): फुलणे - वाढ/तणाव संतुलित ठेवा',
          controlled: 'नियंत्रित तणाव (0.4): वेरासन - गुणवत्ता/साखर सुधारा',
        },
        calculateButton: 'रीफिल टँक गणा',
      },
      results: {
        madTitle: 'जास्तीत जास्त अनुमत घट',
        interpretation: 'व्याख्या',
        interpretationMessages: {
          shallow:
            'उथळ मुळ क्षेत्र - अत्यंत वारंवार $t(glossary.irrigation) आवश्यक (दररोज किंवा दिवसातून दोनदा)',
          moderate: 'मध्यम मुळ क्षेत्र - 1-2 दिवसांत $t(glossary.irrigation) शिफारस केले आहे',
          deep: 'खोल मुळ क्षेत्र - सामान्यतः 2-3 दिवसांचे $t(glossary.irrigation) पुरेसे आहे',
          veryDeep: 'खूप खोल मुळे - 3-5 दिवसांचे $t(glossary.irrigation) पुरेसे असू शकते',
        },
        refillTankTitle: 'रीफिल टँक आवश्यकता',
        whatThisMeans: 'याचा अर्थ काय',
        refillExplanation:
          'अष्टपौराणिक द्राक्ष आरोग्य राखण्यासाठी $t(glossary.soil) ओलसरपणा MAD च्या {{percentage}}% पर्यंत कमी झाल्यावर {{value}} एकक पाणी लावा.',
      },
      actions: {
        reset: 'कॅल्क्युलेटर रीसेट करा',
      },
    },
  },

  parameterSelector: {
    title: 'मापदंड ({{count}} निवडले)',
    selectAll: 'सर्व निवडा',
    deselectAll: 'सर्व निवड रद्द करा',
  },

  weather: {
    errors: {
      unableToLoad: '$t(glossary.weather) डेटा लोड होऊ शकला नाही',
    },
    empty: {
      noFarmsTitle: '$t(glossary.farm) उपलब्ध नाहीत',
      noFarmsSubtitle: 'तुमच्या ठिकाणासाठी $t(glossary.weather) पाहण्यासाठी $t(glossary.farm) जोडा',
    },
    warnings: {
      noCoordinates:
        'या $t(glossary.farm)मध्ये स्थान निर्देशांक नाहीत. $t(glossary.weather) डेटा डीफॉल्ट स्थान (नाशिक) दर्शवत आहे. $t(glossary.farm)-विशिष्ट $t(glossary.weather) मिळवण्यासाठी GPS निर्देशांक जोडा.',
    },
    pickers: {
      growthStage: 'वाढीचा टप्पा',
      soilType: '$t(glossary.soil) प्रकार',
    },
    location: {
      currentLocation: 'सध्याचे स्थान',
      feelsLike: 'वाटत आहे',
    },
    sections: {
      forecast7Day: '7 दिवसांचा अंदाज',
      waterRequirements: 'पाणी आवश्यकता',
      alerts: 'इशारे आणि शिफारसी',
      irrigationSchedule: '$t(glossary.irrigation) वेळापत्रक',
    },
    labels: {
      humidity: 'आर्द्रता',
      wind: 'वारा',
      uvIndex: 'UV निर्देशांक',
      rain: 'पाऊस',
      dailyEtc: 'दैनिक ETc',
      weeklyNeed: 'साप्ताहिक गरज',
      total7Days: 'एकूण (7 दिवस)',
      irrigations_one: '{{count}} $t(glossary.irrigation)',
      irrigations_other: '{{count}} $t(glossary.irrigation)',
    },
    alerts: {
      pest: {
        title: '$t(glossary.pest) व $t(glossary.disease)',
        riskBadge: '{{level}} जोखीम',
      },
      harvest: {
        title: '$t(glossary.harvest) परिस्थिती',
        badgeOptimal: 'योग्य',
        badgeModerate: 'मध्यम',
      },
    },
    lastUpdated: 'शेवटचे अद्ययावत: {{time}}',
  },

  trends: {
    screens: {
      soil: '$t(glossary.soil) ट्रेंड्स',
      petiole: '$t(glossary.petiole) ट्रेंड्स',
    },
    viewModes: {
      table: 'तक्ता',
      chart: 'चार्ट',
    },
    empty: {
      noDataTitle: 'डेटा उपलब्ध नाही',
      needMoreDataTitle: 'अधिक डेटा आवश्यक',
      needMoreDataBody: 'चार्ट पाहण्यासाठी किमान 2 $t(glossary.labTest) जोडा',
      noParamsTitle: 'पॅरामीटर निवडले नाहीत',
      noParamsBody: 'चार्ट पाहण्यासाठी किमान एक पॅरामीटर निवडा',
    },
    legend: {
      title: 'लेजेन्ड',
    },
    summary: {
      title: 'सारांश',
    },
    table: {
      nutrient: 'पोषक घटक',
      pruningDate: '$t(glossary.pruning)',
      reportDate: '$t(glossary.report)',
      daysAfterPruningShort: 'DAP',
      colorGuide: 'रंग मार्गदर्शक:',
      optimal: 'योग्य',
      warning: 'इशारा',
      critical: 'गंभीर',
      trend: 'कल:',
      increase: 'वाढ',
      decrease: 'घट',
      stable: 'स्थिर',
      empty: {
        noDataTitle: 'डेटा उपलब्ध नाही',
        noDataBody: 'ट्रेंड्स पाहण्यासाठी $t(glossary.labTest) जोडा',
        noParamsTitle: 'पॅरामीटर डेटा नाही',
        noParamsBody: 'पॅरामीटर ट्रेंड्स लोड करणे अशक्य',
      },
    },
    nutrientFlow: {
      title: '$t(glossary.petiole) चाचण्यांदरम्यान मातीला दिलेले पोषक घटक ({{unit}})',
      subtitle: 'प्रत्येक तारीख-अंतरालात नोंदवलेल्या $t(glossary.fertigation) लॉगवर आधारित.',
      empty: 'अंतरालानुसार पोषक प्रवाह पाहण्यासाठी किमान 2 $t(glossary.petiole) चाचण्या जोडा.',
      partialHistory: 'आंशिक इतिहास: या अंतरालांतील काही लॉगमध्ये पोषक संरचनेचे स्नॅपशॉट नाहीत.',
      nutrient: 'पोषक घटक',
      coverage: 'कव्हरेज {{value}}%',
    },
  },

  units: {
    acres: 'एकर',
    hectares: 'हेक्टर',
    meter: 'मी',
    millimeter: 'मिमी',
    feet: 'फीट',
    mmPerHour: 'मिमी/तास',
    kilogramPerMeterCubed: 'किग्रा/मी³',
    gmPerLiter: 'gm/L',
    kgPerAcre: 'kg/acre',
  },

  locationPicker: {
    title: 'ठिकाण निवडा',
    permissionDenied: 'ठिकाण प्रवेशाची परवानगी नाकारली गेली',
    unableToGetCurrentLocation: 'सध्याचे ठिकाण मिळू शकले नाही',
    pleaseSelectOnMap: 'नकाशावर ठिकाण निवडा',
    unableToSelectLocation: 'ठिकाण निवडता आले नाही',
    invalidCoordinates: 'कृपया वैध अक्षांश आणि रेखांश समन्वय टाका.',
    selectedLocationMarkerTitle: 'निवडलेले ठिकाण',
    useCurrent: 'सध्याचे ठिकाण वापरा',
    confirm: 'ठिकाण निश्चित करा',
    mapsUnavailableTitle: 'नकाशा उपलब्ध नाही',
    mapsUnavailableBody:
      'या बिल्डमध्ये नकाशा उपलब्ध नाही. तुम्ही सध्याचे ठिकाण वापरू शकता किंवा समन्वय (coordinates) हाताने टाकू शकता.',
    searchPlaceholder: 'पत्ता शोधा...',
    unknownLocation: 'अज्ञात ठिकाण',
    noResultsFound: 'कोणतेही परिणाम आढळले नाहीत',
    unableToGetLocationDetails: 'ठिकाणाचे तपशील मिळवण्यात अक्षम',
  },

  waterLevelSheet: {
    title: '$t(glossary.soil)तील पाणी पातळी अद्ययावत करा',
    saveLabel: 'पाणी पातळी जतन करा',
    alerts: {
      invalidInputTitle: 'अवैध इनपुट',
      invalidWaterLevel: 'कृपया mm मध्ये वैध पाणी पातळी टाका',
      invalidEto: 'कृपया वैध ET0 मूल्य टाका',
      missingSelectionTitle: 'निवड आवश्यक',
      selectGrowthStage: 'कृपया वाढीचा टप्पा निवडा',
      calculateFirstTitle: 'आधी गणना करा',
      calculateFirstMessage: 'कृपया आधी पाणी पातळीची गणना करा',
      successTitle: 'यशस्वी',
      successUpdated: 'पाणी पातळी {{valueMm}} mm वर अद्ययावत झाली',
      errorTitle: 'त्रुटी',
      failedToUpdate: 'पाणी पातळी अद्ययावत होऊ शकली नाही',
    },
    sections: {
      waterLevels: {
        title: 'पाणी पातळी',
        subtitle: 'ET0 वरून गणना करा किंवा हाताने पातळी सेट करा.',
      },
      method: {
        title: 'गणनेची पद्धत',
      },
      etoInputs: {
        title: 'ET0 इनपुट',
      },
      manualEntry: {
        title: 'हाताने नोंद',
      },
    },
    preview: {
      labels: {
        remaining: 'शिल्लक',
        totalWaterUsed: 'एकूण वापरलेले पाणी',
        change: 'बदल',
        lastUpdated: 'शेवटचे अद्ययावत',
      },
      current: {
        title: 'सध्याची पाणी पातळी',
      },
      new: {
        title: 'नवीन पाणी पातळी',
      },
    },
    method: {
      eto: 'ET0',
      manual: 'हाताने',
    },
    eto: {
      label: 'ET0 (संदर्भ बाष्पोत्सर्जन)',
    },
    growthStage: {
      label: 'वाढीचा टप्पा',
      placeholder: 'वाढीचा टप्पा निवडा',
      selected: '{{label}}',
    },
    manual: {
      label: '$t(glossary.soil)तील पाणी पातळी',
    },
    calculate: 'पाणी पातळीची गणना करा',
    growthStagePicker: {
      title: 'वाढीचा टप्पा निवडा',
      stages: {
        beginningBudbreak: 'सुरुवातीची कोंब फुटणे',
        shoot30cm: 'कोंब 30 सेमी',
        shoot50cm: 'कोंब 50 सेमी',
        shoot80cm: 'कोंब 80 सेमी',
        beginningBloom: 'सुरुवातीचे फूल येणे',
        fruitSet: 'फळ लागणे',
        berry6to8mm: 'बेरी 6-8 मिमी',
        berry12mm: 'बेरी 12 मिमी',
        closingBunches: 'गुच्छे बंद होणे',
        beginningVeraison: 'सुरुवातीचे रंग बदलणे',
        beginningHarvest: 'सुरुवातीची $t(glossary.harvest)',
        endHarvest: 'शेवटची $t(glossary.harvest)',
        afterHarvest: '$t(glossary.harvest)नंतर',
      },
    },
  },

  tabs: {
    dashboard: 'आढावा',
    explore: 'शेती',
    workers: '$t(glossary.worker)',
    tools: 'साधने',
    settings: 'सेटिंग्ज',
    farms: '$t(glossary.farm)',
  },

  onboarding: {
    language: {
      title: 'भाषा निवडा',
      subtitle: 'ही सेटिंग आपण नंतर बदलू शकता.',
      english: 'English',
      marathi: 'मराठी',
    },
    welcome: {
      title: 'Vinesight मध्ये स्वागत',
      subtitle: 'आपला स्मार्ट शेती सहकारी',
    },
    howItWorks: {
      title: 'कसे कार्य करते',
      subtitle: '$t(glossary.farm) व्यवस्थापनासाठी आवश्यक सर्व काही',
    },
    features: {
      addFarms: {
        title: '$t(glossary.farm) जोडा',
        description:
          'ठिकाण, पिकाचा प्रकार आणि क्षेत्रफळासह $t(glossary.farm) तयार करा. एकाच ठिकाणी अनेक $t(glossary.farm) व्यवस्थापित करा.',
      },
      trackEverything: {
        title: 'सर्व नोंदी ठेवा',
        description:
          '$t(glossary.irrigation), $t(glossary.spray), $t(glossary.harvest), $t(glossary.expense) इत्यादी नोंदी करा. सर्व रेकॉर्ड एकाच ठिकाणी.',
      },
      waterManagement: {
        title: 'स्मार्ट पाणी व्यवस्थापन',
        description:
          '$t(glossary.weather) आणि $t(glossary.soil) नुसार $t(glossary.waterLevel) गणना.',
      },
      labTests: {
        title: '$t(glossary.labTest) निकाल',
        description:
          '$t(glossary.soil) आणि $t(glossary.petiole) चाचणी निकाल जतन करा आणि पोषक घटक ट्रॅक करा.',
      },
      reports: {
        title: '$t(glossary.report) तयार करा',
        description: 'दिनांक श्रेणीनुसार $t(glossary.report) तयार करून कामगिरी विश्लेषित करा.',
      },
    },
    preferences: {
      title: '$t(glossary.farm) प्राधान्ये',
      country: 'देश',
      selectCountry: 'देश निवडा',
      currency: 'चलन',
      areaUnit: 'क्षेत्रफळ एकक',
      subtitle: 'आपला अनुभव सानुकूल करण्यासाठी मदत करा',
    },
    notifications: {
      title: 'सूचना',
      subtitle: 'आठवणी आणि इशारे मिळवा',
      enable: 'सूचना सक्षम करा',
      item1: '$t(glossary.irrigation) आठवणी',
      item2: '$t(glossary.task) अंतिम वेळ',
      item3: '$t(glossary.weather) इशारे',
      eyebrow: 'एक पाऊल पुढे रहा',
      slideTitle: 'फक्त त्या क्षणांसाठी इशारे चालू करा जे तुम्हाला महागात पडू शकतात.',
      slideSubtitle:
        'स्प्रे विंडो, $t(glossary.irrigation) ची वेळ आणि मजुरांतील बदल दिवस हातातून जाण्यापूर्वी तुम्हाला कळतात.',
      stats: {
        lateSpray: 'उशिरा मिळालेली स्प्रे माहिती निर्यात गुणवत्तेला फटका देऊ शकते',
        missedIrrigation: '$t(glossary.irrigation) ची वेळ चुकल्याने ब्लॉकवर ताण येतो',
        unclearLabour: 'अस्पष्ट मजूर बदल पेरोलमध्ये अडचण निर्माण करतात',
      },
      assurance: 'फक्त उपयोगी आठवणी. हे तुम्ही नंतर सेटिंग्जमध्ये बदलू शकता.',
      enableAlerts: 'इशारे चालू करा',
      checkingPermissions: 'परवानग्या तपासत आहोत...',
      skipAlerts: 'इशाऱ्यांशिवाय पुढे चला',
    },
    firstFarm: {
      title: 'तुमचे पहिले $t(glossary.farm) जोडा.',
      subtitle: 'आवश्यक गोष्टींनी सुरुवात करा. तपशील नंतर संपादित करू शकता.',
      assurance:
        'आत्ता फक्त आवश्यक गोष्टी पुरेशा आहेत. उरलेले सर्व नंतर $t(glossary.farm) पानावरून जोडता येईल.',
      createButton: 'पहिले $t(glossary.farm) तयार करा',
      existingTitle: 'तुमचे पहिले $t(glossary.farm) आधीच अस्तित्वात आहे.',
      existingSubtitle:
        'इशाऱ्यांपर्यंत पुढे जा आणि ऑनबोर्डिंग पूर्ण करा. $t(glossary.farm) चे तपशील नंतर संपादित करू शकता.',
      existingFarmFallback: '$t(glossary.farm)',
      existingRegionFallback: 'प्रदेश',
      existingCropFallback: '$t(glossary.crop)',
    },
    complete: {
      title: 'सर्व तयार!',
      subtitle:
        'Vinesight सोबत $t(glossary.farm) व्यवस्थापन सुरू करा. पहिले $t(glossary.farm) जोडा.',
    },
    cta: {
      continue: 'पुढे चला',
      enableNotifications: 'सूचना सक्षम करा',
      getStarted: 'सुरू करा',
    },
  },

  auth: {
    subtitle: '$t(glossary.farm) व्यवस्थापन',
    fullName: 'पूर्ण नाव',
    email: 'ईमेल',
    password: 'पासवर्ड',
    signIn: 'साइन इन',
    signUp: 'साइन अप',
    or: 'किंवा',
    continueWithApple: 'Apple सह पुढे जा',
    continueWithGoogle: 'Google सह पुढे जा',
    continueWithPhone: 'फोनने पुढे जा',
    continueWithEmail: 'ईमेलने साइन इन करा',
    alreadyHaveAccount: 'आधीच खाते आहे?',
    dontHaveAccount: 'खाते नाही?',
    a11y: {
      switchToSignIn: 'साइन इन वर स्विच करा',
      switchToSignUp: 'साइन अप वर स्विच करा',
      continueWithPhone: 'फोन नंबरने साइन इन करा',
    },
  },

  authOtp: {
    invalidEmail: 'अवैध ईमेल',
    title: 'पडताळणी कोड टाका',
    subtitle: 'आम्ही 6-अंकी कोड पाठवला आहे:',
    verify: 'पडताळा',
    resend: 'कोड पुन्हा पाठवा',
    resendA11y: 'कोड पुन्हा पाठवा',
    resendA11yWithSeconds: '{{seconds}} सेकंदांनी कोड पुन्हा पाठवा',
    resendInSecondsShort: '{{seconds}}s नंतर पुन्हा पाठवा',
    useDifferentEmail: 'वेगळा ईमेल वापरा',
    useDifferentEmailA11y: 'वेगळा ईमेल वापरा',
    subtitlePhone: 'आम्ही 6-अंकी कोड पाठवला',
    verifying: 'पडताळणी सुरू आहे...',
    useDifferentPhone: 'वेगळा फोन नंबर वापरा',
    useDifferentPhoneA11y: 'वेगळा फोन नंबर वापरा',
  },

  authPhone: {
    title: 'फोन साइन इन',
    subtitle: 'सत्यापन कोड मिळवण्यासाठी तुमचा मोबाइल नंबर प्रविष्ट करा',
    phoneNumber: 'फोन नंबर',
    phoneLabel: 'फोन नंबर',
    phonePlaceholder: 'फोन नंबर प्रविष्ट करा',
    sendCode: 'सत्यापन कोड पाठवा',
    sendingCode: 'कोड पाठवला जात आहे...',
    preferEmail: 'ईमेल पसंत आहे?',
    signInWithEmail: 'ईमेलने साइन इन करा',
    selectCountry: 'देश निवडा',
    selectCountryA11y: 'देश निवडक उघडा',
    closeA11y: 'देश निवडक बंद करा',
    backToLoginPrefix: 'परत जा',
    backToLoginLink: 'ईमेल साइन इन',
    backToLoginA11y: 'ईमेल साइन इनवर परत जा',
    invalidPhone: 'कृपया देश कोडसह वैध फोन नंबर प्रविष्ट करा',
    countryCode: 'देश कोड',
    searchCountry: 'देश शोधा...',
    namePlaceholder: 'तुमचे नाव',
    nameRequired: 'कृपया तुमचे नाव प्रविष्ट करा',
    a11y: {
      selectCountryCode: 'देश कोड निवडा',
      phoneInput: 'फोन नंबर इनपुट',
    },
  },

  profileCompletion: {
    title: 'तुमचे प्रोफाइल पूर्ण करा',
    subtitle: 'आम्हाला तुमच्याबद्दल थोडे सांगा',
    firstName: 'नाव',
    lastName: 'आडनाव',
    fullName: 'पूर्ण नाव',
    fullNamePlaceholder: 'तुमचे पूर्ण नाव प्रविष्ट करा',
    emailOptional: 'ईमेल',
    emailPlaceholder: 'तुमचा ईमेल प्रविष्ट करा',
    continue: 'पुढे जा',
    skip: 'आता सोडा',
    emailExistsWarning:
      'या ईमेलसह खाते आधीपासून अस्तित्वात आहे. कृपया आधी ईमेलने साइन इन करा, नंतर सेटिंग्जमधून तुमचा फोन नंबर लिंक करा.',
    a11y: {
      skipProfileCompletion: 'प्रोफाइल पूर्णता सोडा',
    },
  },

  settings: {
    sectionGeneral: 'सामान्य',
    sectionNotifications: 'सूचना',
    sectionAccount: 'खाते',
    sectionAssistant: 'AI सहाय्यक',
    language: 'भाषा',
    selectLanguage: 'भाषा निवडा',
    languageEnglish: 'English',
    languageMarathi: 'मराठी',
    languageHindi: 'हिंदी',
    theme: 'थीम',
    selectTheme: 'थीम निवडा',
    themeSystem: 'सिस्टम',
    themeLight: 'लाइट',
    themeDark: 'डार्क',
    areaUnit: 'क्षेत्रफळ एकक',
    currency: 'चलन',
    featureOverviewNotifications: 'दैनिक फीचर ओव्हरव्ह्यू',
    featureOverviewNotificationsSubtitle: 'पहिल्या 7 दिवसांसाठी दररोज एक मुख्य मॉड्यूलची ओळख दाखवा',
    dailyWaterReminder: 'दैनिक पाणी आठवण',
    dailyWaterReminderSubtitle: '$t(glossary.waterLevel) तपासण्याची आठवण',
    lowWaterAlerts: 'कमी $t(glossary.waterLevel) इशारे',
    lowWaterAlertsSubtitle: '$t(glossary.waterLevel) खूप कमी असल्यास इशारा',
    taskReminders: '$t(glossary.task) आठवणी',
    taskRemindersSubtitle: 'नियोजित $t(glossary.task) बद्दल आठवण',
    warehouseReorderAlerts: 'गोदाम पुनर्भरण इशारे',
    warehouseReorderAlertsSubtitle: 'वस्तू पुनर्भरण मर्यादेपेक्षा कमी झाल्यावर इशारा द्या',
    petioleTestReminders: '$t(glossary.petiole) चाचणी आठवणी',
    petioleTestRemindersSubtitle: 'छाटणीच्या ३०, ६०, ९०, १२० दिवसांच्या एक दिवस आधी आठवण',
    notificationNote:
      'रिमाइंडर सेटिंग्ज या डिव्हाइसवर राहतात. दैनिक फीचर ओव्हरव्ह्यू तुमच्या खात्यासोबतही सिंक होतो.',
    madeForVineyardManagement: 'द्राक्षमळा व्यवस्थापनासाठी',
    sentry: {
      testButton: 'Sentry चाचणी इव्हेंट पाठवा',
      testButtonA11y: 'Sentry चाचणी इव्हेंट पाठवा',
      transportDisabledTitle: 'Sentry ट्रान्सपोर्ट बंद आहे',
      transportDisabledDescriptionDev:
        'डेव्हलपमेंटमध्ये या अॅपमध्ये Sentry बंद आहे. पडताळणीसाठी preview/production build वापरा किंवा स्थानिक तपासणीसाठी app/_layout.tsx मध्ये Sentry तात्पुरते सक्षम करा.',
      transportDisabledDescriptionProd:
        'Sentry DSN उपलब्ध नाही. EXPO_PUBLIC_SENTRY_DSN जोडा आणि पुन्हा build करा.',
      testSentTitle: 'Sentry चाचणी इव्हेंट पाठवला',
      testSentDescription: 'काही क्षणांनी तुमच्या Sentry प्रोजेक्टमध्ये टेस्ट issue तपासा.',
      testSentDescriptionWithId: 'इव्हेंट आयडी: {{eventId}}',
      testFailedTitle: 'Sentry चाचणी अयशस्वी',
      testFailedDescription: 'चाचणी इव्हेंट पाठवता आला नाही. Sentry संरचना तपासा.',
    },
    signOut: 'साइन आउट',
    signOutConfirmTitle: 'साइन आउट',
    signOutConfirmBody: 'आपण साइन आउट करू इच्छिता का?',
    deleteAccount: 'खाते हटवा',
    editProfile: 'प्रोफाइल संपादित करा',
    email: 'ईमेल',
    emailCannotBeChanged: 'ईमेल बदलता येत नाही',
    fullName: 'पूर्ण नाव',
    phone: 'फोन',
    enterName: 'आपले नाव लिहा',
    enterPhone: 'फोन नंबर लिहा',
    selectCurrency: 'चलन निवडा',
    selectAreaUnit: 'क्षेत्रफळ एकक निवडा',
    errors: {
      signOutFailed: 'साइन आउट अयशस्वी. पुन्हा प्रयत्न करा.',
      notificationsPermissionDenied: 'सूचना परवानगी मंजूर झाली नाही.',
      notificationsUnavailable: 'या वातावरणात सूचना उपलब्ध नाहीत.',
      updateProfileFailed: 'प्रोफाइल अद्ययावत होऊ शकले नाही. कृपया पुन्हा प्रयत्न करा.',
      updateAreaUnitFailed: 'क्षेत्रफळ एकक अद्ययावत होऊ शकले नाही. कृपया पुन्हा प्रयत्न करा.',
      linkPhoneFailed: 'फोन नंबर लिंक करण्यात अयशस्वी. कृपया पुन्हा प्रयत्न करा.',
      verifyPhoneFailed: 'फोन नंबर सत्यापित करण्यात अयशस्वी. कृपया पुन्हा प्रयत्न करा.',
      assistantMemoryExportFailed:
        'सहाय्यक मेमरी एक्सपोर्ट करण्यात अयशस्वी. कृपया पुन्हा प्रयत्न करा.',
      assistantMemoryDeleteFailed: 'सहाय्यक मेमरी हटवण्यात अयशस्वी. कृपया पुन्हा प्रयत्न करा.',
    },

    assistantMemory: {
      exportAction: 'सहाय्यक मेमरी एक्सपोर्ट करा',
      exportShareTitle: 'सहाय्यक मेमरी एक्सपोर्ट शेअर करा',
      exportedTitle: 'सहाय्यक मेमरी एक्सपोर्ट झाली',
      exportedBody: 'संवाद: {{conversations}}, टर्न: {{turns}}, मेमरी: {{memories}}.',
      deleteAction: 'सहाय्यक मेमरी हटवा',
      deleteConfirmTitle: 'सहाय्यक मेमरी हटवायची?',
      deleteConfirmBody:
        'यामुळे तुमच्या खात्यातील सहाय्यक संवाद, टर्न आणि मेमरी कायमची हटवली जाईल.',
      deletedTitle: 'सहाय्यक मेमरी हटवली',
      deletedBody: 'तुमचा सहाय्यक मेमरी डेटा हटवला गेला आहे.',
      retentionNote: 'तुम्ही हटवले नाही तर सहाय्यक मेमरी {{days}} दिवसांपर्यंत जतन होते.',
    },

    deleteAccountModal: {
      title: 'खाते हटवा',
      warningTitle: 'इशारा: ही कृती परत करता येणार नाही',
      warningBody: 'खाते हटवल्यास खालील सर्व डेटा कायमचा हटवला जाईल:',
      dataList: {
        farms:
          'सर्व $t(glossary.farm) डेटा ($t(glossary.farm), पिके, $t(glossary.soil) प्रोफाइल, $t(glossary.labTest))',
        records:
          'सर्व नोंदी ($t(glossary.irrigation), $t(glossary.spray), $t(glossary.fertigation), $t(glossary.harvest), $t(glossary.expense))',
        workers: '$t(glossary.worker) माहिती आणि $t(glossary.attendance) नोंदी',
        org: 'संस्था सदस्यत्व आणि कनेक्शन्स',
        uploads:
          'सर्व अपलोड केलेल्या फाइल्स ($t(glossary.soil) चाचणी $t(glossary.report), फोटो, दस्तऐवज)',
        profile: 'आपला प्रोफाइल, प्राधान्ये आणि प्रमाणीकरण डेटा',
      },
      confirmEmail: {
        label: 'आपला ईमेल पुष्टी करा',
        placeholder: 'आपला ईमेल टाका',
        hint: 'खाते हटवण्याची पुष्टी करण्यासाठी खात्यातील ईमेल टाका',
      },
      confirmPassword: {
        label: 'आपला पासवर्ड पुष्टी करा',
        placeholder: 'आपला पासवर्ड टाका',
        hint: 'आपली ओळख पडताळण्यासाठी पासवर्ड टाका',
      },
      phoneVerificationLabelRequired: 'मोबाईल पडताळणी (आवश्यक)',
      phoneVerificationLabelOptional: 'मोबाईल पडताळणी',
      reason: {
        label: 'खाते हटवण्याचे कारण (ऐच्छिक)',
        placeholder: 'आपण का जात आहात ते लिहा…',
        hint: 'सेवा सुधारण्यासाठी हे उपयोगी ठरते',
      },
      checkbox: {
        prefix: 'मला समजते की माझे खाते आणि संबंधित सर्व डेटा',
        bold: 'कायमचा हटवला जाईल',
        suffix: 'आणि तो परत मिळू शकणार नाही. ही कृती परत करता येणार नाही हेही मला समजते.',
      },
      submit: 'माझे खाते हटवा',
      submittedTitle: 'खाते हटवण्याची विनंती नोंदवली',
      submittedBody:
        'आपली खाते हटवण्याची विनंती नोंदवली आहे. आपले खाते 30 दिवसांत हटवले जाईल. मत बदलल्यास कृपया तात्काळ सपोर्टशी संपर्क साधा.',
      errors: {
        emailMismatch: 'ईमेल आपल्या खात्यातील ईमेलशी जुळत नाही.',
        missingPassword: 'कृपया आपला पासवर्ड टाका.',
        missingConfirmation: 'कृपया परिणाम समजल्याची पुष्टी करा.',
        invalidPassword: 'अवैध पासवर्ड.',
        submitFailed: 'विनंती पाठवता आली नाही. कृपया पुन्हा प्रयत्न करा.',
      },
    },

    linkPhone: {
      title: 'फोन नंबर लिंक करा',
      subtitle: 'सोप्या साइन-इनसाठी तुमच्या खात्याशी फोन नंबर लिंक करा',
      phoneLabel: 'फोन नंबर',
      phonePlaceholder: '+1234567890',
      sendCode: 'सत्यापन कोड पाठवा',
      verifyTitle: 'फोन नंबर पडताळा',
      verifySubtitle: 'पाठवलेला 6-अंकी कोड टाका',
      codeLabel: 'सत्यापन कोड',
      codePlaceholder: '000000',
      verify: 'पडताळा आणि लिंक करा',
      resend: 'कोड पुन्हा पाठवा',
      cancel: 'रद्द करा',
      success: 'फोन नंबर यशस्वीरित्या लिंक झाला',
      alreadyLinked: 'फोन नंबर आधीपासून तुमच्या खात्याशी लिंक आहे',
      changePhone: 'फोन नंबर बदला',
      editLimitReached_one: 'एका सत्यापन प्रवाहात तुम्ही फोन नंबर {{count}} वेळेपर्यंत बदलू शकता.',
      editLimitReached_other:
        'एका सत्यापन प्रवाहात तुम्ही फोन नंबर {{count}} वेळांपर्यंत बदलू शकता.',
      verified: 'पडताळलेला फोन नंबर',
      notLinked: 'कोणताही पडताळलेला फोन नंबर लिंक नाही',
      verificationRequired: 'फोन साइन-इन वापरण्यासाठी फोन नंबर पडताळा',
    },
    phoneEnforcement: {
      title: 'पुढे जाण्यासाठी तुमचा फोन लिंक करा',
      body: 'खाते सुरक्षितता आणि सोप्या साइन-इनसाठी अॅप वापरण्यापूर्वी तुमचा मोबाइल नंबर लिंक करा.',
      linkNow: 'फोन नंबर लिंक करा',
    },
  },

  ai: {
    title: 'AI सहाय्यक',
    openAssistant: 'AI सहाय्यक उघडा',
    description:
      'आपला वैयक्तिक शेती सहाय्यक. द्राक्ष लागवड, $t(glossary.irrigation), $t(glossary.disease) किंवा $t(glossary.harvest)बद्दल काहीही विचारा!',
    suggestedQuestions: 'सूचित प्रश्न:',
    apiKeyRequiredTitle: 'API की आवश्यक',
    apiKeyRequiredBody: 'कृपया पर्यावरण सेटिंग्जमध्ये आपली OpenAI API की सेट करा.',
    input: {
      placeholder: 'शेतीबद्दल विचारा…',
    },
    errors: {
      failedResponse: 'AI कडून उत्तर मिळाले नाही',
    },
    voice: {
      starting: 'मायक्रोफोन सुरू होत आहे...',
      listening: 'ऐकत आहे...',
      readyToListen: 'ऐकण्यासाठी तयार...',
      startA11y: 'व्हॉइस इनपुट सुरू करा',
      stopA11y: 'व्हॉइस इनपुट थांबवा',
      permissionTitle: 'मायक्रोफोन परवानगी आवश्यक',
      permissionBody: 'आवाजातून प्रश्न विचारण्यासाठी मायक्रोफोन परवानगी द्या.',
      noSpeechTitle: 'आवाज सापडला नाही',
      noSpeechBody: 'मला काही ऐकू आले नाही. कृपया पुन्हा बोला.',
      unavailableTitle: 'व्हॉइस इनपुट उपलब्ध नाही',
      unavailableBody: 'या डिव्हाइसवर सध्या व्हॉइस इनपुट उपलब्ध नाही.',
      recordingTooShortTitle: 'रेकॉर्डिंग खूप लहान',
      recordingTooShortBody: 'कृपया किमान 1 सेकंद बोला आणि पुन्हा प्रयत्न करा.',
      recordingTooShortDetailBody:
        'ऑडिओ खूप लहान होता, {{reason}}. बोला दाबा, किमान 1 सेकंद थांबा, मग थांबा दाबा.',
      voiceMessage: 'व्हॉइस मेसेज',
      microphoneOff: 'मायक्रोफोन बंद',
      replyVoiceUnavailable: 'या उत्तरासाठी आवाज उपलब्ध नाही.',
      sttNotReadyTitle: 'सर्व्हर STT तयार नाही',
      sttNotReadyBody:
        'मायक्रोफोन रेकॉर्डिंग सुरू होऊ शकले नाही, त्यामुळे सर्व्हर स्पीच-टू-टेक्स्ट वापरता येत नाही.',
      fileUnavailable: 'निवडलेली फाइल आता उपलब्ध नाही.',
    },
    attach: {
      title: 'जोडा',
      choosePrompt: 'काय जोडायचे ते निवडा',
      image: 'इमेज',
      file: 'फाइल',
      imageTooLarge: 'इमेज 10MB मर्यादेपेक्षा मोठी आहे. कृपया लहान फाइल निवडा.',
      unsupportedImageType: 'असमर्थित इमेज प्रकार. JPG, PNG, WEBP किंवा HEIC वापरा.',
      imageUnavailable: 'निवडलेली इमेज आता उपलब्ध नाही.',
      fileTooLarge: 'फाइल 10MB मर्यादेपेक्षा मोठी आहे. कृपया लहान फाइल निवडा.',
      unsupportedFileType: 'असमर्थित फाइल प्रकार. PDF, TXT, CSV, JSON, XML किंवा Markdown वापरा.',
    },
    chat: {
      assistantSpeaking: 'सहाय्यक बोलत आहे...',
      retry: 'पुन्हा प्रयत्न करा',
      history: 'चॅट इतिहास',
      voiceMode: 'व्हॉइस मोड',
      thinking: 'विचार करत आहे...',
      tapToSpeak: 'बोलण्यासाठी टॅप करा',
      transcriptPlaceholder: 'तुमचा आवाज येथे दिसेल...',
      failedRequest: 'मागील विनंती अयशस्वी झाली.',
      newChat: 'नवीन चॅट',
      newConversation: 'नवीन संवाद',
      noPreviousChats: 'आतापर्यंत कोणतेही जुने चॅट नाहीत.',
      deleteChat: 'चॅट हटवा',
      deleteChatHint: 'हा संवाद इतिहासातून हटवतो.',
      deleteChatConfirm:
        'तुम्हाला खात्री आहे की तुम्ही हा चॅट हटवू इच्छिता? हे पूर्ववत करता येणार नाही.',
      deleteChatFailed: 'चॅट हटवता आला नाही. कृपया पुन्हा प्रयत्न करा.',
      openHistoryHint: 'तुमचे जतन केलेले संवाद उघडतो.',
      stop: 'थांबवा',
      replay: 'पुन्हा वाजवा',
      replayVoiceA11y: 'सहाय्यकाचा आवाज पुन्हा वाजवा',
      stopVoiceA11y: 'सहाय्यकाचा आवाज थांबवा',
      toggleVoiceSpeedA11y: 'व्हॉइस वेग बदला',
      attachFileA11y: 'फाइल जोडा',
      openVoiceModeA11y: 'व्हॉइस मोड उघडा',
      close: 'बंद करा',
      continuousOn: 'सतत चालू',
      continuousOff: 'सतत बंद',
      speak: 'बोला',
    },
    conversationBootstrapFailed: 'नवीन संवाद सुरू करता आला नाही. कृपया पुन्हा प्रयत्न करा.',
    logging: {
      cancelled: 'ठीक आहे, नोंदणी प्रक्रिया रद्द केली.',
      noFarms: 'आधी एक $t(glossary.farm) जोडा, मग मी नोंदणी फॉर्म उघडतो.',
      clarifyExhausted:
        'मला सर्व तपशील समजले नाहीत. फॉर्म उघडत आहे जेणेकरून तुम्ही स्वतः पूर्ण करू शकता.',
      openingForm:
        '{{farm}} साठी {{date}} रोजी {{type}} नोंदवले. पडताळणी आणि सबमिटसाठी फॉर्म उघडत आहे.',
      routeClarification: {
        prompt:
          'मी दोन्हीमध्ये मदत करू शकतो. उत्तर द्या:\n1) नवीन क्रियाकलाप नोंदवा\n2) जुने रेकॉर्ड दाखवा',
        cancelled: 'ठीक आहे, तो पर्याय रद्द केला. आता काहीही विचारा.',
        retry: 'कृपया पुढे जाण्यासाठी 1 किंवा 2 लिहा.',
      },
      followups: {
        common: {
          askFarm: 'हे कोणत्या $t(glossary.farm)ासाठी नोंदवू?',
          askWaterVolume: 'पाणी किती वापरले (लिटरमध्ये)?',
        },
        irrigation: {
          askDuration: '$t(glossary.irrigation) किती तास चालले?',
        },
        spray: {
          askChemicals: 'किमान एक रसायनाचे नाव आणि प्रमाण सांगा.',
        },
        harvest: {
          askQuantity: '$t(glossary.harvest) चे प्रमाण किती होते (किलो)?',
          askGrade: '$t(glossary.harvest) साठी कोणता ग्रेड नोंदवू?',
        },
        expense: {
          askCost: 'या $t(glossary.expense) साठी किती रक्कम नोंदवू?',
          askType: '$t(glossary.expense) चा प्रकार कोणता निवडू?',
        },
        fertigation: {
          askFertilizers: 'किमान एक $t(glossary.fertilizer) चे नाव आणि प्रमाण सांगा.',
        },
      },
      draft: {
        title: 'नोंदणी मसुदा',
        type: 'प्रकार',
        farm: '$t(glossary.farm)',
        status: 'स्थिती',
        date: 'तारीख',
        missingFarm: 'निवडले नाही',
        ready: 'तयार',
        waiting: 'बाकी: {{fields}}',
        clearA11y: 'एक्टिव्हिटी नोंदणी मसुदा साफ करा',
        cleared: 'मसुदा काढला',
        undo: 'पूर्ववत',
        dismissA11y: 'काढलेल्या मसुद्याची सूचना बंद करा',
        fields: {
          farm: '$t(glossary.farm)',
          duration: 'कालावधी',
          waterVolume: 'पाणी प्रमाण',
          chemicals: 'रसायने',
          quantity: 'प्रमाण',
          grade: 'ग्रेड',
          cost: 'रक्कम',
          expenseType: '$t(glossary.expense) प्रकार',
          fertilizers: '$t(glossary.fertilizer)',
        },
      },
    },
    defaultSuggestions: {
      waterNeed: 'मला किती पाणी लागेल?',
      diseases: 'सामान्य $t(glossary.disease) तपासा',
      fertilizer: '$t(glossary.fertigation) शिफारसी',
      pruning: '$t(glossary.pruning) टिपा (द्राक्षे)',
    },
  },

  notifications: {
    dailyWater: {
      title: 'दैनिक $t(glossary.waterLevel) तपासणी',
      body: '$t(glossary.waterLevel) तपासा आणि $t(glossary.irrigation) योजना करा.',
    },
    lowWater: {
      title: 'कमी $t(glossary.waterLevel)',
      body: '$t(glossary.irrigation) लवकर आवश्यक. आजची नोंद तपासा.',
    },
    taskDue: {
      title: '$t(glossary.task) आठवण',
      body: 'आपले नियोजित $t(glossary.task) आज बाकी आहे.',
    },
    taskDueTomorrow: {
      body: 'आपले नियोजित $t(glossary.task) उद्या बाकी आहे.',
    },
    warehouseReorder: {
      title: 'पुनर्भरण इशारा',
      body: '{{itemName}} कमी आहे ({{quantity}} {{unit}} शिल्लक, {{reorderQty}} {{unit}} वर पुनर्भरण करा)',
    },
    petioleTest: {
      title: '$t(glossary.petiole) चाचणी आठवण',
      body: '{{farmName}}: {{day}}व्या दिवसाची $t(glossary.petiole) चाचणी उद्या आहे',
    },
    taskOverdue: {
      title: '$t(glossary.task) मुदत संपली',
      body: 'तुमचे एक $t(glossary.task) मुदत संपलेले आहे. कृपया ते पूर्ण करा किंवा पुन्हा नियोजित करा.',
    },
  },

  dashboard: {
    greeting: {
      morning: 'शुभ सकाळ',
      afternoon: 'शुभ दुपार',
      evening: 'शुभ संध्याकाळ',
      night: 'शुभ रात्री',
    },
    greetingWithName: {
      morning: 'शुभ सकाळ, {{name}}',
      afternoon: 'शुभ दुपार, {{name}}',
      evening: 'शुभ संध्याकाळ, {{name}}',
      night: 'शुभ रात्री, {{name}}',
    },
    stats: {
      farms: '$t(glossary.farm)',
      activeWorkers: 'सक्रिय $t(glossary.worker)',
      activities: 'क्रियाकलाप',
      tasks: 'कार्ये',
    },
    needsAttention: {
      title: 'लक्ष आवश्यक',
      reasons: {
        lowWaterLevel: 'पाणी स्तर कमी',
      },
    },
    quickActions: {
      title: 'त्वरित क्रिया',
      irrigation: '$t(glossary.irrigation)',
      spray: '$t(glossary.spray)',
      expense: '$t(glossary.expense)',
      note: 'नोंद',
    },
    recentActivity: {
      title: 'अलीकडील क्रियाकलाप',
    },
    empty: {
      recentActivity: 'अजून अलीकडील क्रियाकलाप नाहीत.\nसुरू करण्यासाठी नोंद जोडा.',
      noFarms: 'अजून $t(glossary.farm) नाहीत.\nसुरू करण्यासाठी पहिले $t(glossary.farm) जोडा.',
    },
    cta: {
      addEntry: 'नोंद जोडा',
      addFirstFarm: 'पहिले $t(glossary.farm) जोडा',
    },
    farmPicker: {
      title: '$t(glossary.farm) निवडा',
      dismissA11y: '$t(glossary.farm) निवड बंद करा',
      closeA11y: '$t(glossary.farm) निवड बंद करा',
      selectFarmA11y: '$t(glossary.farm) निवडा: {{name}}',
      selectAllFarmsA11y: 'सर्व $t(glossary.farm) निवडा',
      allFarms: 'सर्व $t(glossary.farm)',
      noFarms: '$t(glossary.farm) उपलब्ध नाहीत',
    },
  },

  dailyNoteForm: {
    addTitle: 'नोंद जोडा',
    editTitle: 'नोंद संपादित करा',
    fields: {
      note: 'नोंद',
    },
    placeholders: {
      note: 'आजच्या दिवसासाठी तुमच्या निरीक्षणांची नोंद करा...',
    },
    errors: {
      missingNote: 'कृपया नोंद लिहा.',
      failedToSave: 'नोंद जतन होऊ शकली नाही. कृपया पुन्हा प्रयत्न करा.',
    },
    lastUpdated: 'शेवटचे अद्ययावत: {{date}}',
    discard: {
      title: 'बदल टाकून द्यायचे?',
      body: 'तुमचे नोंदीतील न जतन केलेले बदल आहेत.',
      confirm: 'टाकून द्या',
    },
  },

  tasks: {
    title: '$t(glossary.task)',
    unknownFarm: 'अज्ञात $t(glossary.farm)',
    filters: {
      all: 'सर्व',
      pending: 'प्रलंबित',
      overdue: 'मुदत संपली',
      completed: 'पूर्ण',
    },
    alerts: {
      completeTitle: '$t(glossary.task) पूर्ण करा',
      completeBody: '"{{title}}" $t(glossary.task) पूर्ण करायचे आहे का?',
      completeBodyGeneric: 'हे $t(glossary.task) पूर्ण करायचे आहे का?',
      deleteTitle: '$t(glossary.task) हटवा',
      deleteBody: '"{{title}}" $t(glossary.task) हटवायचे आहे का?',
      deleteBodyGeneric: 'हे $t(glossary.task) हटवायचे आहे का?',
    },
    statusSummary: {
      pending: 'प्रलंबित',
      overdue: 'मुदत संपली',
      completed: 'पूर्ण',
    },
    empty: {
      title: 'कामे आढळली नाहीत',
      subtitleAll: 'सुरू करण्यासाठी पहिले $t(glossary.task) तयार करा',
      subtitleFiltered: '{{filter}} कामे नाहीत',
    },
    cta: {
      addTask: '$t(glossary.task) जोडा',
    },
    logNow: 'आत्ताच नोंदवा',
    dueDate: {
      none: 'देय तारीख नाही',
      today: 'आज',
      tomorrow: 'उद्या',
      overdue: 'मुदत संपली: {{date}}',
    },
    types: {
      irrigation: '$t(glossary.irrigation)',
      spray: '$t(glossary.spray)',
      fertigation: '$t(glossary.fertigation)',
      harvest: '$t(glossary.harvest)',
      soilTest: '$t(glossary.soil) चाचणी',
      petioleTest: '$t(glossary.petiole) चाचणी',
      expense: '$t(glossary.expense)',
      note: 'नोंद',
    },
    priority: {
      low: 'कमी',
      medium: 'मध्यम',
      high: 'उच्च',
    },
    a11y: {
      editTask: '$t(glossary.task) संपादित करा: {{title}}',
      deleteTask: '$t(glossary.task) हटवा: {{title}}',
      completeTask: '$t(glossary.task) पूर्ण करा: {{title}}',
    },
    status: {
      pending: 'प्रलंबित',
      inProgress: 'सुरू आहे',
      completed: 'पूर्ण',
      cancelled: 'रद्द',
    },
    form: {
      addTitle: '$t(glossary.task) जोडा',
      editTitle: '$t(glossary.task) संपादित करा',
      saving: 'जतन होत आहे…',
      useTemplate: 'टेम्पलेट वापरा',
      selectFarm: '$t(glossary.farm) निवडा',
      fields: {
        farm: '$t(glossary.farm)',
        title: 'शीर्षक',
        description: 'वर्णन',
        type: 'प्रकार',
        priority: 'प्राधान्य',
        dueDate: 'देय तारीख',
      },
      placeholders: {
        title: '$t(glossary.task)ाचे शीर्षक टाका',
        description: 'या $t(glossary.task)बद्दल तपशील जोडा',
        dueDate: 'YYYY-MM-DD (उदा., 2024-01-25)',
      },
      dueDateHint: 'YYYY-MM-DD फॉरमॅटमध्ये तारीख टाका',
      dueDateErrors: {
        format: 'YYYY-MM-DD फॉरमॅट वापरा.',
        invalidDate: 'वैध दिनांक टाका.',
      },
      errors: {
        missingTitle: 'कृपया $t(glossary.task)ाचे शीर्षक टाका',
        missingFarm: 'कृपया $t(glossary.farm) निवडा',
        failedToSave: '$t(glossary.task) जतन होऊ शकले नाही. कृपया पुन्हा प्रयत्न करा.',
      },
    },
  },

  workers: {
    tabs: {
      workers: '$t(glossary.worker)',
      attendance: 'उपस्थिती',
      analytics: 'विश्लेषण',
    },
    lists: {
      activeTitle: 'सक्रिय ({{count}})',
      inactiveTitle: 'निष्क्रिय ({{count}})',
    },
    empty: {
      title: 'अजून $t(glossary.worker) नाहीत',
      subtitle: '$t(glossary.attendance) आणि देयके ट्रॅक करण्यासाठी $t(glossary.worker) जोडा.',
    },
    analyticsTab: {
      title: '$t(glossary.worker) विश्लेषण',
      subtitle: '$t(glossary.worker) कामगिरी, $t(glossary.attendance) आणि देयके ट्रॅक करा.',
      comingSoon: 'लवकरच येत आहे',
    },
    ratePerDayShort: ' /दिवस',
    edit: 'संपादित करा',
    delete: 'हटवा',
    actions: {
      title: 'एक्शन्स',
      addWorker: 'वर्कर जोडा',
      addWorkerDesc: 'एक नवा स्थायी वर्कर नोंदणी करा',
      settlePayment: 'देये व्यवस्थित करा',
      settlePaymentDesc: 'वर्करांच्या रोजगारीची गणना आणि पुष्टी करा',
      addTempWorker: 'तात्पुरा वर्कर जोडा',
      addTempWorkerDesc: 'एकदा दिवसाचा श्रम नोंदणी करा',
    },
    workerCard: {
      editA11y: '{{name}} संपादित करा',
      deleteA11y: '{{name}} हटवा',
    },
    alerts: {
      deleteWorkerTitle: '$t(glossary.worker) हटवा?',
      deleteWorkerBody:
        '{{name}} $t(glossary.worker) आणि त्यांच्याशी संबंधित सर्व नोंदी कायमच्या हटवल्या जातील.',
      markInactiveTitle: 'निष्क्रिय म्हणून चिन्हांकित करायचे?',
      markInactiveBody: 'यामुळे {{name}} सक्रिय $t(glossary.worker) यादीतून काढला जाईल.',
      markActiveTitle: 'सक्रिय म्हणून चिन्हांकित करायचे?',
      markActiveBody: 'यामुळे {{name}} सक्रिय $t(glossary.worker) यादीत परत जोडला जाईल.',
    },
    loading: '$t(glossary.worker) तपशील लोड होत आहे...',
    notFound: {
      title: '$t(glossary.worker) सापडला नाही',
    },
    status: {
      active: 'सक्रिय',
      inactive: 'निष्क्रिय',
    },
    fields: {
      dailyRate: 'दैनिक दर',
      advanceBalance: 'अग्रिम शिल्लक',
      createdAt: 'तयार केले',
      updatedAt: 'शेवटचे अपडेट',
    },
    attendance: {
      title: 'उपस्थिती',
      empty: 'अजून कोणतीही उपस्थिती नोंद नाही',
      deleteConfirm: '{{date}} ची उपस्थिती हटवायची?',
      status: {
        full_day: 'पूर्ण दिवस',
        half_day: 'अर्धा दिवस',
        absent: 'अनुपस्थित',
      },
    },
    transactions: {
      title: 'व्यवहार',
      empty: 'अजून कोणतेही व्यवहार नाहीत',
      deleteConfirm: '{{date}} चा व्यवहार हटवायचा?',
      type: {
        advance_given: 'अग्रिम दिले',
        advance_deducted: 'अग्रिम कपात',
        payment: 'देयक',
      },
    },
    settlements: {
      title: 'निपटारे',
      empty: 'अजून कोणतेही निपटारे नाहीत',
      deleteConfirm: 'हा निपटारा हटवायचा?',
      status: {
        draft: 'मसुदा',
        confirmed: 'पुष्टी',
      },
      days: 'दिवस',
      gross: 'एकूण',
      advance: 'अग्रिम',
      net: 'शुद्ध देयक',
      confirmedAt: 'पुष्टी तारीख',
    },
    form: {
      addTitle: '$t(glossary.worker) जोडा',
      editTitle: '$t(glossary.worker) संपादित करा',
      saveAdd: '$t(glossary.worker) जोडा',
      sections: {
        details: '$t(glossary.worker) तपशील',
        status: 'स्थिती',
      },
      fields: {
        name: {
          label: '$t(glossary.worker) नाव',
          placeholder: 'उदा., राजेश कुमार',
        },
        dailyRate: {
          label: 'दैनिक दर',
          perDayShort: '/दिवस',
        },
        advanceAmountOptional: {
          label: 'अग्रिम रक्कम (ऐच्छिक)',
        },
      },
      toggles: {
        activeWorker: 'सक्रिय $t(glossary.worker)',
        activeWorkerDescription:
          '$t(glossary.worker) निष्क्रिय असल्यास $t(glossary.attendance) यादीत दिसणार नाहीत.',
      },
      infoCardMessage: 'दैनिक दरावरून कमाईची गणना होते. अग्रिम शिल्लक रक्कम थकबाकीची नोंद ठेवते.',
    },
    tempWorkers: {
      sectionTitle: 'तात्पुरते $t(glossary.worker)',
      addTitle: 'तात्पुरता $t(glossary.worker) जोडा',
      empty: {
        title: 'तात्पुरते $t(glossary.worker) नोंदवले नाहीत',
        subtitle: 'या शेतासाठी नियुक्त केलेले तात्पुरते $t(glossary.worker) नोंदवा.',
      },
      form: {
        title: 'तात्पुरता $t(glossary.worker) जोडा',
        sections: {
          workerDetails: '$t(glossary.worker) तपशील',
          workDetails: 'कामाचे तपशील',
        },
        fields: {
          name: {
            label: '$t(glossary.worker) नाव',
            placeholder: 'उदा., दिवसाळू $t(glossary.worker)',
          },
          date: {
            label: 'तारीख',
          },
          hoursWorked: {
            label: '$t(glossary.task) केलेले तास',
            suffix: 'तास',
          },
          amountPaid: {
            label: 'दिलेली रक्कम',
          },
          farm: {
            label: '$t(glossary.farm)',
            placeholder: '$t(glossary.farm) निवडा (ऐच्छिक)',
          },
          notes: {
            label: 'नोंदी (ऐच्छिक)',
            placeholder: 'नोंदी जोडा...',
          },
        },
        hourlyRate: 'तासाचा दर',
        perHour: '/तास',
        save: '$t(glossary.worker) जोडा',
        validation: 'कृपया $t(glossary.worker) नाव आणि दिलेली रक्कम एंटर करा.',
        error: 'तात्पुरता $t(glossary.worker) नोंद जतन करण्यात अयशस्वी. कृपया पुन्हा प्रयत्न करा.',
      },
      card: {
        hoursShort: '{{hours}} तास',
        deleteTitle: 'नोंद हटवायची?',
        deleteBody: 'यामुळे {{name}} साठी तात्पुरता $t(glossary.worker) नोंद कायमची काढली जाईल.',
      },
    },
  },

  settlePayment: 'पेमेंट सेटल करा',
  selectWorkerAndPeriod: '$t(glossary.worker) आणि सेटलमेंट कालावधी निवडा',
  dailyRate: 'दैनिक दर',
  advanceBalance: 'अग्रिम शिल्लक',
  period: 'कालावधी',
  startDate: 'सुरूवातीची तारीख',
  endDate: 'शेवटची तारीख',
  calculate: 'गणा',
  daysWorked: '$t(glossary.task) केलेले दिवस',
  confirm: 'पुष्टी करा',
  optional: 'ऐच्छिक',
  allFarms: 'सर्व शेते',
  farm: '$t(glossary.farm)',
  settlement: {
    this_week: 'हा आठवडा',
    last_week: 'मागील आठवडा',
    custom: 'कस्टम',
    summary: 'सारांश',
    calculatedGross: 'गणना केलेला एकूण',
    adjustments: 'समायोजन',
    totalSalary: 'एकूण पगार',
    totalSalaryHint: 'संपादन योग्य - गणना केलेल्या एकूणाने पूर्व-भरलेले',
    cutFromAdvance: 'अग्रिमातून कपात',
    max: 'कमाल: {{max}}',
    netPayment: 'निव्वळ पेमेंट',
    netPaymentHint: 'कामगाराला देण्याची रक्कम',
    settlementConfirmedTitle: 'सेटलमेंट पुष्टी झाले',
    settlementConfirmedMessage: 'निव्वळ पेमेंट: {{formattedAmount}} यशस्वीरित्या पुष्टी झाले',
    salaryCannotBeNegative: 'एकूण पगार नकारात्मक असू शकत नाही',
    deductionCannotBeNegative: 'अग्रिम कपात नकारात्मक असू शकत नाही',
    deductionExceedsBalance: 'कपात उपलब्ध अग्रिम शिल्लकापेक्षा जास्त आहे',
    deductionExceedsSalary: 'कपात एकूण पगारापेक्षा जास्त असू शकत नाही',
    invalidDateRange: 'सुरूवातीची तारीख शेवटच्या तारीखेपूर्वी असावी',
    calculationFailed: 'सेटलमेंटची गणना अयशस्वी',
    confirmationFailed: 'सेटलमेंट पुष्टी अयशस्वी',
  },

  warehouse: {
    title: 'गोदाम',
    loading: {
      inventory: 'इन्व्हेंटरी लोड होत आहे…',
    },
    labels: {
      lowStock: 'कमी स्टॉक',
      lowStockAlerts: 'कमी स्टॉक इशारे',
      itemCount_one: '{{count}} वस्तू',
      itemCount_other: '{{count}} वस्तू',
      quantity: 'प्रमाण',
      unitPrice: 'युनिट किंमत',
      totalValue: 'एकूण मूल्य',
    },
    reorderAt: 'पुनर्भरण पातळी: {{quantity}} {{unit}}',
    filters: {
      all: 'सर्व ({{count}})',
      fertilizer: '$t(glossary.fertigation) ({{count}})',
      spray: '$t(glossary.spray) ({{count}})',
    },
    search: {
      placeholder: 'गोदाम शोधा...',
      found_one: '{{count}} वस्तू आढळली',
      found_other: '{{count}} वस्तू आढळल्या',
    },
    itemsCount_one: '{{count}} वस्तू',
    itemsCount_other: '{{count}} वस्तू',
    itemTypes: {
      fertilizer: '$t(glossary.fertigation)',
      spray: '$t(glossary.spray)',
    },
    empty: {
      title: 'गोदामात वस्तू नाहीत',
      subtitle: 'पहिली इन्व्हेंटरी वस्तू जोडण्यासाठी + बटण दाबा',
    },
    actions: {
      addItem: 'वस्तू जोडा',
    },
    alerts: {
      deleteItemTitle: 'वस्तू हटवा',
      deleteItemBody: '"{{name}}" वस्तू हटवायची आहे का?',
    },
    stockForm: {
      title: 'स्टॉक जोडा',
      saveLabel: 'स्टॉक जोडा',
      currentLabel: 'सध्या: {{quantity}} {{unit}}',
      sectionTitle: 'स्टॉक तपशील',
      perUnitSuffix: 'प्रति {{unit}}',
      fields: {
        quantityToAdd: 'जोडायचे प्रमाण',
        unitPriceOptional: 'युनिट किंमत ({{currency}}) - ऐच्छिक',
      },
      preview: {
        title: 'अद्ययावत नंतर',
        newStock: 'नवीन स्टॉक',
        totalValue: 'एकूण मूल्य',
      },
    },
  },

  labTests: {
    list: {
      title: 'तपासणी',
      viewTrends: 'तुलना',
      tabs: {
        soil: '$t(glossary.soil) ({{count}})',
        petiole: '$t(glossary.petiole) ({{count}})',
      },
      card: {
        soilAnalysis: '$t(glossary.soil) विश्लेषण',
        petioleAnalysis: '$t(glossary.petiole) विश्लेषण',
        outOfRange: 'सीमेबाहेर: {{count}}',
        allWithinRange: 'सर्व काही मर्यादेत',
        more: '{{count}} आणखी पोषकतत्त्वे',
        moreLabel: 'आणखी',
        status: {
          outOfRange: 'सीमेबाहेर',
        },
      },
      deleteAction: '$t(glossary.labTest) हटवा',
      empty: {
        title: '{{type}} $t(glossary.labTest) नाहीत',
        subtitle: 'पोषकतत्त्वांचे स्तर ट्रॅक करण्यासाठी {{type}} $t(glossary.labTest) जोडा.',
        action: '{{type}} $t(glossary.labTest) जोडा',
      },
      deleteTitle: '$t(glossary.labTest) हटवा',
      deleteBody: 'ही {{type}} $t(glossary.labTest) हटवायची आहे का?',
    },
    form: {
      title: '{{type}} $t(glossary.labTest) जोडा',
      saveLabel: '$t(glossary.labTest) जतन करा',
      uploadSectionTitle: '$t(glossary.labTest) अपलोड करा',
      parsingWithAi: 'AI द्वारे प्रक्रिया होत आहे...',
      uploadButton: 'लॅब रिपोर्ट अपलोड करा',
      detailsSectionTitle: 'टेस्ट तपशील',
      parametersSectionTitle: '{{type}} पॅरामीटर्स',
      parametersSectionSubtitle: 'लॅब रिपोर्टमधील मूल्ये टाका',
      recommendationsSectionTitle: 'शिफारसी',
      notesSectionTitle: 'नोंदी',
      optionalPlaceholder: 'ऐच्छिक',
      types: {
        soil: '$t(glossary.soil)',
        petiole: '$t(glossary.petiole)',
      },
    },
    details: {
      title: '{{type}} $t(glossary.labTest) तपशील',
      sections: {
        chemical: '🧪 रासायनिक गुणधर्म',
        major: '🌿 प्रमुख पोषकतत्त्वे',
        secondary: '⚗️ दुय्यम पोषकतत्त्वे',
        micro: '💧 सूक्ष्म पोषकतत्त्वे',
        other: '📋 इतर',
        additional: '📊 अतिरिक्त पॅरामीटर्स',
      },
      optimalPrefix: 'आदर्श:',
    },
    errors: {
      unableToOpenFormTitle: '$t(glossary.labTest) फॉर्म उघडता आला नाही',
      invalidFarmId: 'अवैध $t(glossary.farm) आयडी: {{farmId}}',
      invalidFarmTitle: 'अवैध $t(glossary.farm)',
    },
    actions: {
      backToList: 'लॅब चाचण्या यादीकडे परत',
    },
    parameters: {
      ph: 'pH',
      ec: 'EC',
      organicCarbon: 'सेंद्रिय कार्बन',
      organicMatter: 'सेंद्रिय द्रव्य',
      calciumCarbonate: 'कॅल्शियम कार्बोनेट',
      carbonate: 'कार्बोनेट',
      bicarbonate: 'बायकार्बोनेट',
      nitrogen: 'नायट्रोजन',
      phosphorus: 'फॉस्फरस',
      potassium: 'पोटॅशियम',
      calcium: 'कॅल्शियम',
      magnesium: 'मॅग्नेशियम',
      sulfur: 'सल्फर',
      iron: 'लोह',
      manganese: 'मॅंगनीज',
      zinc: 'झिंक',
      copper: 'तांबे',
      boron: 'बोरॉन',
      total_nitrogen: 'एकूण नायट्रोजन',
      nitrate_nitrogen: 'नायट्रेट N',
      ammoniacal_nitrogen: 'अमोनियाकल N',
      molybdenum: 'मोलिब्डेनम',
      sodium: 'सोडियम',
      chloride: 'क्लोराइड',
    },
    upload: {
      chooseMethodTitle: 'अपलोड पद्धत निवडा',
      chooseMethodBody: '$t(glossary.labTest) रिपोर्ट कसा अपलोड करायचा?',
      permissionDeniedTitle: 'परवानगी नाकारली',
      permissionDeniedBody: 'फोटो काढण्यासाठी कॅमेरा परवानगी आवश्यक आहे.',
      uploadFailedTitle: 'अपलोड अयशस्वी',
      noValidImageSelected: 'वैध प्रतिमा निवडली गेली नाही. कृपया पुन्हा प्रयत्न करा.',
      failedToTakePhoto: 'फोटो काढता आला नाही. कृपया पुन्हा प्रयत्न करा.',
      failedToSelectImage: 'प्रतिमा निवडता आली नाही. कृपया पुन्हा प्रयत्न करा.',
      invalidPdfFile: 'अवैध PDF फाईल. कृपया पुन्हा प्रयत्न करा.',
      failedToSelectPdf: 'PDF निवडता आला नाही. कृपया पुन्हा प्रयत्न करा.',
      pdfProcessingTitle: 'PDF प्रक्रिया',
      pdfProcessingBody:
        'PDF मधून मजकूर आपोआप काढता आला नाही. चांगल्या निकालासाठी रिपोर्टचा फोटो/स्क्रीनशॉट अपलोड करा.',
      noDataFoundTitle: 'डेटा आढळला नाही',
      noDataFoundPdfBody:
        'PDF मधून पॅरामीटर्स मिळाले नाहीत. अधिक स्पष्ट डॉक्युमेंट वापरा किंवा डेटा हाताने टाका.',
      noDataFoundImageBody:
        'प्रतिमेतून पॅरामीटर्स मिळाले नाहीत. अधिक स्पष्ट प्रतिमा वापरा किंवा डेटा हाताने टाका.',
      successTitle: 'यशस्वी',
      successBody: '{{count}} पॅरामीटर्स मिळाले. कृपया तपासून जतन करा.',
      parsingFailedTitle: 'प्रक्रिया अयशस्वी',
      parsingFailedBody:
        'डेटा काढता आला नाही. चांगल्या निकालासाठी रिपोर्टचा फोटो/स्क्रीनशॉट अपलोड करा.',
    },
  },

  soilProfiling: {
    noFarm: {
      title: 'प्रथम $t(glossary.farm) निवडा',
      subtitle:
        '$t(glossary.soil) प्रोफाइल विशिष्ट $t(glossary.farm)शी संबंधित आहेत. कृपया पाहण्यासाठी $t(glossary.farm) निवडा.',
      cta: '$t(glossary.farm) पृष्ठावर जा',
    },
    title: '$t(glossary.soil) प्रोफाइलिंग',
    tabs: {
      history: 'इतिहास',
      trends: 'ट्रेंड्स',
    },
    loading: 'प्रोफाइल लोड होत आहेत…',
    alerts: {
      deleteProfileTitle: 'प्रोफाइल हटवा',
      deleteProfileBody: 'हा $t(glossary.soil) प्रोफाइल हटवायचा आहे का?',
    },
    errors: {
      unableToOpenFormTitle: '$t(glossary.soil) प्रोफाइल फॉर्म उघडता आला नाही',
      invalidFarmId: 'अवैध $t(glossary.farm) आयडी: {{farmId}}',
    },
    fusarium: 'फ्यूजेरियम: {{value}}%',
    averageMoisture: 'सरासरी आर्द्रता',
    noProfiles: 'कोणते $t(glossary.soil) प्रोफाइल नाहीत',
    noProfilesDescription:
      'तुमच्या $t(glossary.farm)ची $t(glossary.soil) आरोग्य ट्रॅक करण्यासाठी आर्द्रता प्रोफाइल जोडा.',
    addFirstProfile: 'पहिला प्रोफाइल जोडा',
    notEnoughData: 'पुरेसा डेटा नाही',
    notEnoughDataDescription: 'ट्रेंड्स पाहण्यासाठी किमान 2 प्रोफाइल जोडा.',
    avgMoisture: 'सरासरी आर्द्रता',
    totalProfiles: 'एकूण प्रोफाइल',
    recentChange: 'अलीकडील बदल',
    fromLastProfile: 'गेल्या प्रोफाइलपासून',
    latestMoisture: 'नवीनतम आर्द्रता',
  },

  soilProfile: {
    moistureStatus: {
      veryDry: 'अत्यंत कोरडे',
      dry: 'कोरडे',
      optimal: 'इष्ट',
      moist: 'ओलसर',
      wet: 'भिजलेले',
    },
  },

  soilProfileForm: {
    titleAdd: '$t(glossary.soil) प्रोफाइल जोडा',
    sections: {
      top: 'वर',
      bottom: 'खाली',
      left: 'डावी',
      right: 'उजवी',
    },
    date: {
      label: 'प्रोफाइल दिनांक',
      hint: 'हा $t(glossary.soil) प्रोफाइल घेतला तो दिनांक निवडा.',
      modalTitle: 'प्रोफाइल दिनांक निवडा',
    },
    moisture: {
      title: '$t(glossary.soil) ओलावा (%)',
      hint: 'प्रत्येक विभागासाठी $t(glossary.soil) ओलावा टक्केवारी टाका. किमान एक आवश्यक आहे.',
    },
    ec: {
      title: 'EC मूल्ये (dS/m) - ऐच्छिक',
      hint: 'प्रत्येक विभागासाठी विद्युत चालकता रीडिंग्स.',
      fieldSuffix: 'EC',
    },
    fusarium: {
      title: 'फ्युजेरियम (%) - ऐच्छिक',
      hint: 'लागू असल्यास फ्युजेरियम विल्ट टक्केवारी.',
    },
  },

  attendance: {
    filters: {
      label: 'फिल्टर',
      worker: '$t(glossary.worker)',
      farms: '$t(glossary.farm)',
      selectWorker: '$t(glossary.worker) निवडा',
      selectFarms: '$t(glossary.farm) निवडा',
      allWorkers: 'सर्व $t(glossary.worker)',
      allFarms: 'सर्व $t(glossary.farm)',
      farmsSelected_one: '{{count}} निवडले',
      farmsSelected_other: '{{count}} निवडले',
    },
    status: {
      fullDay: 'पूर्ण दिवस',
      fullDayShort: 'पू',
      halfDay: 'अर्धा दिवस',
      halfDayShort: 'अ',
      absent: 'अनुपस्थित',
      absentShort: 'अ',
      notSet: 'सेट नाही',
      notSetShort: '-',
    },
    dateRange: {
      label: 'तारीख श्रेणी',
    },
    week: {
      thisWeek: 'हा आठवडा',
      unsavedChanges: 'न जतन केलेले बदल',
      upToDate: 'अद्ययावत',
    },
    quickActions: {
      allFull: 'सर्व पूर्ण',
      allHalf: 'सर्व अर्धा',
      allOff: 'सर्व बंद',
      copyFromYesterday: 'कालचे कॉपी करा',
    },
    buttons: {
      saving: 'जतन करत आहे...',
      saveAndNext: 'जतन करा आणि पुढे',
      saveAndFinish: 'जतन करा आणि समाप्त',
      nextWorker: 'पुढील $t(glossary.worker)',
      done: 'पूर्ण',
    },
    sheet: {
      selectWorkerTitle: '$t(glossary.worker) निवडा',
      selectWorkerSubtitle:
        '$t(glossary.attendance) चिन्हांकित करण्यासाठी $t(glossary.worker) निवडा',
    },
    a11y: {
      selectWorkerButton: '$t(glossary.worker) निवडा',
      selectFarmsButton: '$t(glossary.farm) निवडा',
      setAllFullDay: 'सर्व दिवस पूर्ण दिवस सेट करा',
      setAllHalfDay: 'सर्व दिवस अर्धा दिवस सेट करा',
      setAllAbsent: 'सर्व दिवस अनुपस्थित सेट करा',
      copyFromYesterday: 'कालचे $t(glossary.attendance) रिक्त दिवसांवर कॉपी करा',
      savingAttendance: '$t(glossary.attendance) जतन करत आहे',
      saveAttendance: '$t(glossary.attendance) बदल जतन करा',
      dayStatus: '{{day}} {{date}}. {{status}}.',
    },
    errors: {
      noYesterdayData: 'कालची $t(glossary.attendance) माहिती सापडली नाही',
    },
    success: {
      copiedFromYesterday: 'कालचे $t(glossary.attendance) कॉपी केले',
    },
    empty: {
      noWorkersTitle: '$t(glossary.worker) उपलब्ध नाहीत',
    },
    alerts: {
      partialErrorTitle: 'अंशतः त्रुटी',
      partialErrorBody: '{{count}} त्रुटीसह जतन झाले. पुन्हा लोड होत आहे…',
      savedTitle: 'यशस्वी',
      savedBody: '{{name}} साठी $t(glossary.attendance) जतन झाली.',
      completeTitle: 'पूर्ण',
      completeBody: 'सर्व $t(glossary.worker) पूर्ण!',
    },
  },

  workerAnalyticsDetail: {
    notFound: '$t(glossary.worker) सापडला नाही',
    dailyRate: 'दैनंदिन दर',
    dateRange: 'दिनांक श्रेणी',
    quickStats: 'जलद आकडे',
    weeklySummary: 'साप्ताहिक सारांश',
    transactions: 'व्यवहार',
    noTransactionsInRange: 'या दिनांक श्रेणीत कोणतेही व्यवहार नाहीत.',
    days: 'दिवस',
    full: 'पूर्ण',
    half: 'अर्धा',
    absent: 'गैरहजर',
  },

  reports: {
    title: '$t(glossary.report)',
    types: {
      comprehensive: 'सविस्तर',
      operations: 'ऑपरेशन्स',
      financial: 'आर्थिक',
      stockUsage: 'स्टॉक वापर',
    },
    selectFarmLabel: '$t(glossary.farm) निवडा',
    selectFarmPlaceholder: 'एक $t(glossary.farm) निवडा',
    dateRange: {
      label: 'दिनांक श्रेणी',
    },
    season: {
      label: 'हंगाम',
      placeholder: 'हंगाम निवडा',
      allSeasons: 'सर्व हंगाम',
      selected: 'निवडलेला हंगाम',
      active: 'सक्रिय',
      window: 'हंगाम कालावधी: {{from}} ते {{to}}',
      noActiveInfo: 'सक्रिय हंगाम नाही. सर्व हंगाम वापरा किंवा जुना हंगाम निवडा.',
      presets: {
        active: 'सक्रिय हंगाम',
        mostRecent: 'सर्वात अलीकडचा हंगाम',
        previous: 'मागील हंगाम',
        thisYear: 'हे वर्ष',
      },
    },
    selectFromDate: 'पासूनचा दिनांक निवडा',
    selectToDate: 'पर्यंतचा दिनांक निवडा',
    reportType: {
      label: '$t(glossary.report) प्रकार',
    },
    loading: {
      preview: 'पूर्वावलोकन तयार होत आहे...',
    },
    preview: {
      title: '$t(glossary.report) पूर्वावलोकन',
      counts: {
        irrigations: '{{count}} $t(glossary.irrigation)',
        sprays: '{{count}} $t(glossary.spray)',
        harvests: '{{count}} $t(glossary.harvest)',
        expenses: '{{count}} $t(glossary.expense)',
        stockUsage: '{{count}} वस्तू वापरल्या',
      },
    },
    stockDetails: {
      title: 'तपशीलवार स्टॉक वापर',
      fertilizers: 'खते',
      sprays: 'फवारण्या',
      used: 'वापरलेले',
      unit: 'युनिट',
      consumedPercent: 'अंदाजे वापर टक्केवारी',
      currentStock: 'सध्याचा स्टॉक',
      estimatedOpeningStock: 'अंदाजे सुरुवातीचा स्टॉक',
      match: 'जुळणी',
      usageCount: 'वापर संख्या',
      na: 'लागू नाही',
    },
    formal: {
      metaTitle: '$t(glossary.report) प्रकार',
      currentReportType: 'सध्याचा $t(glossary.report) प्रकार',
      generatedAt: 'तयार केले',
      executiveTitle: 'कार्यकारी सारांश',
      revenue: 'महसूल',
      expenses: '$t(glossary.expense)',
      showDetails: 'तपशील दाखवा',
      hideDetails: 'तपशील लपवा',
      emptySection: 'निवडलेल्या दिनांक श्रेणीत नोंदी नाहीत',
      sections: {
        fertigationRecords: 'फर्टिगेशन नोंदी ({{count}})',
      },
      table: {
        fertilizers: 'खते',
      },
    },
    summary: {
      totalRecords: 'एकूण नोंदी',
      waterUsage: 'पाणी वापर',
      totalHarvest: 'एकूण $t(glossary.harvest)',
      netProfit: 'निव्वळ नफा',
      stockUsageCount: 'वापरलेल्या वस्तू',
      matchedItems: 'जुळलेल्या वस्तू',
      stockCoverage: 'अंदाजे कव्हरेज',
    },
    exportAs: 'या स्वरूपात निर्यात करा',
    downloadReport: 'रिपोर्ट डाउनलोड करा',
    errors: {
      unableToExport: '$t(glossary.report) निर्यात करणे अशक्य. कृपया पुन्हा प्रयत्न करा.',
    },
    alerts: {
      exportFailedTitle: 'निर्यात अयशस्वी',
      downloadCompleteTitle: 'डाउनलोड पूर्ण',
      downloadCompleteBody: 'जतन केले:\n{{fileUri}}',
      downloadReportTitle: 'रिपोर्ट डाउनलोड करा',
      chooseFormatBody: 'स्वरूप निवडा',
    },
    noFarms: {
      title: '$t(glossary.farm) उपलब्ध नाहीत',
      subtitle: '$t(glossary.report) तयार करण्यासाठी $t(glossary.farm) जोडा.',
    },
    export: {
      meta: {
        reportType: '$t(glossary.report) प्रकार',
        region: 'प्रदेश',
        area: 'क्षेत्रफळ',
        season: 'हंगाम',
        seasonWindow: 'हंगाम कालावधी',
        reportPeriod: '$t(glossary.report) कालावधी',
        to: 'ते',
      },
      summaryTitle: 'सारांश',
      generatedBy: 'Vinesight ने {{date}} रोजी तयार केले',
      moreRecords: '... आणि आणखी {{count}} नोंदी',
      sections: {
        irrigationRecords: '$t(glossary.irrigation) नोंदी ({{count}})',
        sprayRecords: '$t(glossary.spray) नोंदी ({{count}})',
        harvestRecords: '$t(glossary.harvest) नोंदी ({{count}})',
        expenseRecords: '$t(glossary.expense) नोंदी ({{count}})',
      },
      table: {
        date: 'दिनांक',
        seasonId: 'हंगाम आयडी',
        seasonName: 'हंगाम नाव',
        duration: 'कालावधी',
        area: 'क्षेत्रफळ',
        growthStage: 'वाढीचा टप्पा',
        discharge: 'डिस्चार्ज',
        chemical: 'रसायन',
        dose: 'डोस',
        weather: '$t(glossary.weather)',
        quantity: 'प्रमाण',
        grade: 'दर्जा',
        price: 'किंमत',
        buyer: 'खरेदीदार',
        type: 'प्रकार',
        cost: '$t(glossary.expense)',
        remarks: 'टिप्पणी',
      },
    },
  },

  farmAssistant: {
    title: '$t(glossary.farm) सहाय्यक',
    askAboutFarmData: 'तुमच्या $t(glossary.farm)ाच्या डेटाबद्दल विचारा...',
    listening: 'ऐकत आहे...',
    tryAsking: 'असे विचारून पहा',
    lookingUpRecords: 'तुमच्या नोंदी शोधत आहे...',
    yourQuestion: 'तुमचा प्रश्न',
    askAnotherQuestion: 'आणखी एक प्रश्न विचारा',
    tryAgain: 'पुन्हा प्रयत्न करा',
    showingRecords: '{{total}} पैकी {{shown}} नोंदी दाखवत आहे',
    categories: {
      spray: '$t(glossary.spray)',
      irrigation: '$t(glossary.irrigation)',
      fertigation: '$t(glossary.fertigation)',
      expense: '$t(glossary.expense)',
    },
    suggestedQuestions: {
      sprayLastMonth: 'मागील महिन्यात कोणती $t(glossary.spray) केली?',
      totalIrrigationSeason: 'या हंगामातील एकूण $t(glossary.irrigation)?',
      lastFertilizer: 'शेवटचे $t(glossary.fertigation) कधी दिले?',
      spendThisMonth: 'या महिन्यात किती $t(glossary.expense) झाला?',
    },
    clarification: {
      whatToKnow: 'तुम्हाला कशाबद्दल जाणून घ्यायचे आहे?',
      forWhichPeriod: 'कोणत्या कालावधीसाठी?',
      sprayHistory: '$t(glossary.spray) इतिहास',
      irrigationHistory: '$t(glossary.irrigation) इतिहास',
      fertilizerHistory: '$t(glossary.fertilizer) इतिहास',
      expenseSummary: '$t(glossary.expense) सारांश',
      thisWeek: 'हा आठवडा',
      thisMonth: 'हा महिना',
      thisSeason: 'हा हंगाम',
      lastMonth: 'मागील महिना',
    },
    errors: {
      unsupportedCategory:
        'मी फक्त $t(glossary.spray), $t(glossary.irrigation), $t(glossary.fertigation) आणि $t(glossary.expense) इतिहासासाठी मदत करू शकतो.',
      tooManyQueries: 'खूप विनंत्या. कृपया थोडा वेळ थांबा.',
      somethingWentWrong: 'काहीतरी चूक झाली. कृपया पुन्हा प्रयत्न करा.',
      unsupportedMessages: {
        sprayRecommendation:
          'मी $t(glossary.spray) सुचवू शकत नाही, पण तुमची शेवटची $t(glossary.spray) दाखवू शकतो.',
        recordCreation: 'मी नोंदी तयार करू शकत नाही, पण तुमचा अलीकडचा इतिहास दाखवू शकतो.',
        recommendation: 'मी शिफारस देऊ शकत नाही, पण तुमचा $t(glossary.farm) इतिहास दाखवू शकतो.',
        cropHealth:
          'मी $t(glossary.spray), $t(glossary.irrigation), $t(glossary.fertigation) आणि $t(glossary.expense) इतिहासात मदत करू शकतो.',
      },
      unsupportedSuggestions: {
        showLastSpray: 'माझी शेवटची $t(glossary.spray) दाखवा',
        showRecentHistory: 'अलीकडचा इतिहास दाखवा',
        showRecentActivity: 'अलीकडची क्रियाकलाप दाखवा',
        askSprayLastMonth: 'मागील महिन्यात कोणती $t(glossary.spray) केली?',
      },
    },
    a11y: {
      openAssistant: '$t(glossary.farm) सहाय्यकाला विचारा',
      closeAssistant: '$t(glossary.farm) सहाय्यक बंद करा',
      stopListening: 'ऐकणे थांबवा',
      submitQuery: 'प्रश्न पाठवा',
      selectOption: 'पर्याय निवडा: {{option}}',
    },
  },
  guidedTour: {
    welcome: {
      title: 'Vinesight मध्ये स्वागत आहे',
      body: 'चला एका मिनिटात तुमचे पहिले $t(glossary.farm) सेट करूया.',
      setupTime: '1 मिनिट सेटअप',
    },
    step1: {
      coach: 'तुमचे पहिले $t(glossary.farm) जोडण्यासाठी येथे टॅप करा.',
      formNameCoach: 'प्रथम तुमच्या $t(glossary.farm) चे नाव नोंदवा.',
      formRegionCoach: 'तुमच्या $t(glossary.farm) चे स्थान (प्रदेश) जोडा.',
      formAreaCoach: 'आता तुमच्या $t(glossary.farm) चे क्षेत्रफळ {{areaUnit}} मध्ये नोंदवा.',
      formVarietyPickCoach: 'यादीतून एक विविधता निवडा.',
      formVarietyCoach: 'तुमची पिकाची विविधता निवडा.',
      formCustomVarietyCoach: 'तुमच्या सानुकूल विविधतेचे नाव लिहा.',
      formCropCoach: 'आता तुमचे पिक प्रकार निवडा.',
      formSubmitCoach: 'छान. सुरू ठेवण्यासाठी $t(glossary.farm) तयार करा टॅप करा.',
    },
    step2: {
      coach: 'छान! आता तुमची पहिली नोंद करा.',
      addEntryCoach: '{{activity}} तपशील भरा, मग नोंद जोडा टॅप करा.',
      fillActivityDetailsCoach: 'तपशील भरा, मग पुढे जाण्यासाठी पुढे टॅप करा.',
      fillSprayDetailsCoach: 'पुढे जाण्यासाठी पाण्याचे प्रमाण आणि किमान एक रसायन नोंदवा.',
      tapAddEntryCoach: 'तुमची कृती नोंदवण्यासाठी नोंद जोडा टॅप करा.',
      tapSaveCoach: 'तुमची कृती जतन करण्यासाठी जतन करा टॅप करा.',
      startSeasonCoach: 'आधी हंगाम सुरू करा, म्हणजे Vinesight तुमच्या नोंदी व्यवस्थित ठेवू शकेल.',
      startSeasonHelper: 'गरज असेल तर टेम्पलेट/तारखा बदला, मग हंगाम सुरू करा वर टॅप करा.',
      pickActivityCoach:
        'या आठवड्यात तुम्ही तुमच्या $t(glossary.farm) वर केलेली एक गोष्ट कोणती? नोंद करण्यासाठी क्रियाकलाप निवडा.',
      pickActivityHelper:
        'ती आजची नसली तरी चालेल. आठवणीतले लॉग करा ($t(glossary.irrigation), $t(glossary.fertigation), $t(glossary.spray), $t(glossary.expense)).',
    },
    complete: {
      title: 'तुमची तयारी झाली!',
      body: 'Vinesight तुमचा $t(glossary.farm) डेटा सुरक्षित ठेवेल आणि उपयुक्त माहिती वाढवेल.',
    },
    reminderPush: {
      title: 'तुमचे $t(glossary.farm) तुमची वाट पाहत आहे!',
      body: 'सेटअप पूर्ण करण्यासाठी टॅप करा.',
    },
    coachmark: {
      title: 'मार्गदर्शक टूर',
      tapToContinue: 'सुरू ठेवण्यासाठी हायलाइट केलेल्या भागावर टॅप करा',
    },
    cta: {
      letsGo: 'चला सुरू करूया',
      done: 'पूर्ण',
      skip: 'वगळा',
      skipTour: 'टूर वगळा',
    },
    settings: {
      replay: 'गाइडेड टूर पुन्हा चालवा',
    },
  },

  guided_tour: {
    workers: {
      tabs_overview: {
        message: 'या टॅब्सचा वापर करून वर्कर्स, अटेंडन्स आणि अ‍ॅनालिटिक्समध्ये बदला करा.',
      },
      add_worker: {
        message:
          'वर्कर जोडण्यासाठी, पेमेंट सेटल करण्यासाठी किंवा टेम्प वर्कर लॉग करण्यासाठी येथे टॅप करा.',
      },
      attendance_tab: {
        message: 'आपल्या वर्कर्सची दैनिक अटेंडन्स मार्क करण्यासाठी अटेंडन्स टॅबवर टॅप करा.',
      },
      mark_day: {
        message: 'अटेंडन्स मार्क करण्यासाठी कोणत्याही दिवसाच्या सेलवर टॅप करा.',
      },
    },
    worker_form: {
      name_field: {
        message: 'वर्करचे पूर्ण नाव एंटर करा — असेच ते अटेंडन्स आणि रिपोर्टमध्ये दिसतील.',
      },
      daily_rate_field: {
        message:
          'त्यांची दैनिक मजुरी (₹) सेट करा. ही सेटलमध्ये पेमेंटची स्वचालित गणना करण्यासाठी वापरली जाते.',
      },
      save_button: {
        message:
          'त्यांना आपल्या यादीत जोडण्यासाठी सेव्हवर टॅप करा. तुम्ही वर्कर्स यादीतून कोणत्याही वेळी त्यांची माहिती एडिट करू शकता.',
      },
    },
    settlement: {
      worker_picker: {
        message: 'ज्याचे पेमेंट सेटल करायचे आहे तो वर्कर निवडा.',
      },
      period_selector: {
        message: 'पे पीरियड निवडा — हा आठवडा, मागील आठवडा किंवा कस्टम तारीख श्रेणी.',
      },
      calculate_btn: {
        message:
          'अटेंडन्सवर आधारित पगाराची स्वचालित गणना करण्यासाठी कॅल्क्युलेटवर टॅप करा. नंतर पेमेंट रेकॉर्ड करण्याची पुष्टी करा.',
      },
    },
    workersTour: {
      legend: {
        fullDay: 'पूर्ण दिवस',
        halfDay: 'अर्धा दिवस',
        absent: 'गैरहजर',
        tap1: 'पहिला टॅप',
        tap2: 'दुसरा टॅप',
        tap3: 'तिसरा टॅप',
        tap4: 'चौथा टॅप दिवस पुन्हा अनमार्क करतो.',
      },
      cyclesThrough: 'प्रत्येक टॅप यामधून जातो:',
      next: 'पुढे',
      gotIt: 'समजले!',
    },
  },
} as const;

export type MrTranslations = typeof mr;
