/**
 * Add Lab Test Modal
 * Modal for adding soil or petiole test records
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Symbol } from '@/components/ui/Symbol';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import {
  useCreateSoilTest,
  useCreatePetioleTest,
  SOIL_PARAMETERS,
  PETIOLE_PARAMETERS,
} from '../../hooks/useLabTests';
import { parseLabTestFromImage, parseLabTestFromText } from '../../utils/pdfParser';

function normalizeParameterKey(key: string, isSoil: boolean): string {
  if (isSoil) {
    const soilKeyMap: Record<string, string> = {
      pH: 'ph',
      EC: 'ec',
      OC: 'organicCarbon',
      OM: 'organicMatter',
      N: 'nitrogen',
      P: 'phosphorus',
      K: 'potassium',
      Ca: 'calcium',
      Mg: 'magnesium',
      S: 'sulfur',
      Fe: 'iron',
      Mn: 'manganese',
      Zn: 'zinc',
      Cu: 'copper',
      B: 'boron',
    };
    return soilKeyMap[key] || key;
  } else {
    const petioleKeyMap: Record<string, string> = {
      N: 'total_nitrogen',
      P: 'phosphorus',
      K: 'potassium',
      Ca: 'calcium',
      Mg: 'magnesium',
      S: 'sulfur',
      Fe: 'iron',
      Mn: 'manganese',
      Zn: 'zinc',
      Cu: 'copper',
      B: 'boron',
      Mo: 'molybdenum',
      Na: 'sodium',
      Cl: 'chloride',
    };
    return petioleKeyMap[key] || key;
  }
}

interface AddLabTestModalProps {
  visible: boolean;
  onClose: () => void;
  farmId: number;
  testType: 'soil' | 'petiole';
}

export default function AddLabTestModal({
  visible,
  onClose,
  farmId,
  testType,
}: AddLabTestModalProps) {
  const createSoilTest = useCreateSoilTest();
  const createPetioleTest = useCreatePetioleTest();
  const webViewRef = useRef<WebView>(null);

  const [date, setDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [parameters, setParameters] = useState<Record<string, string>>({});
  const [recommendations, setRecommendations] = useState('');
  const [notes, setNotes] = useState('');
  const [isParsingPDF, setIsParsingPDF] = useState(false);
  const [showPDFWebView, setShowPDFWebView] = useState(false);
  const [currentPDFBase64, setCurrentPDFBase64] = useState<string | null>(null);

  const PDF_PARSE_TIMEOUT_MS = 30000;

  const isSoil = testType === 'soil';
  const parameterList = isSoil ? SOIL_PARAMETERS : PETIOLE_PARAMETERS;
  const isLoading = createSoilTest.isPending || createPetioleTest.isPending;

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    if (showPDFWebView) {
      timeoutId = setTimeout(() => {
        setShowPDFWebView(false);
        setIsParsingPDF(false);
        setCurrentPDFBase64(null);
        Alert.alert(
          'Timeout',
          'PDF parsing timed out. Please try converting the PDF to an image or take screenshots.',
          [{ text: 'OK' }],
        );
      }, PDF_PARSE_TIMEOUT_MS);
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [showPDFWebView]);

  useEffect(() => {
    if (showPDFWebView && currentPDFBase64 && webViewRef.current) {
      webViewRef.current.postMessage(currentPDFBase64);
    }
  }, [showPDFWebView, currentPDFBase64]);

  const resetForm = () => {
    setDate(new Date());
    setParameters({});
    setRecommendations('');
    setNotes('');
  };

  const handleSubmit = async () => {
    // Convert string parameters to numbers
    const numericParams: Record<string, number> = {};
    Object.entries(parameters).forEach(([key, value]) => {
      const num = parseFloat(value);
      if (!isNaN(num)) {
        numericParams[key] = num;
      }
    });

    if (Object.keys(numericParams).length === 0) {
      Alert.alert('Error', 'Please enter at least one parameter value');
      return;
    }

    try {
      const record = {
        farm_id: farmId,
        date: date.toISOString().split('T')[0],
        parameters: numericParams,
        recommendations: recommendations || null,
        notes: notes || null,
      };

      if (isSoil) {
        await createSoilTest.mutateAsync(record);
      } else {
        await createPetioleTest.mutateAsync(record);
      }

      resetForm();
      onClose();
    } catch (error) {
      console.error('Error creating lab test:', error);
      Alert.alert('Error', 'Failed to save lab test');
    }
  };

  const handleDateChange = (_: DateTimePickerEvent, selectedDate?: Date) => {
    if (process.env.EXPO_OS === 'android') {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setDate(selectedDate);
    }
  };

  const updateParameter = (key: string, value: string) => {
    setParameters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleUploadFile = async () => {
    Alert.alert('Choose Upload Method', 'How would you like to upload the lab test report?', [
      {
        text: 'Take Photo',
        onPress: () => handleTakePhoto(),
      },
      {
        text: 'Select Image',
        onPress: () => handleSelectImage(),
      },
      {
        text: 'Select PDF',
        onPress: () => handleSelectPDF(),
      },
      {
        text: 'Cancel',
        style: 'cancel',
      },
    ]);
  };

  const handleTakePhoto = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission denied', 'Camera permission is required to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await parseAndPopulateForm(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const handleSelectImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await parseAndPopulateForm(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error selecting image:', error);
      Alert.alert('Error', 'Failed to select image. Please try again.');
    }
  };

  const handleSelectPDF = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const file = result.assets[0];
      setIsParsingPDF(true);

      const fileData = await FileSystem.readAsStringAsync(file.uri, {
        encoding: 'base64',
      });

      const pdfBase64 = `data:application/pdf;base64,${fileData}`;
      setCurrentPDFBase64(pdfBase64);
      setShowPDFWebView(true);
    } catch (error) {
      console.error('Error selecting PDF:', error);
      Alert.alert('Error', 'Failed to select PDF. Please try again.');
    }
  };

  const parseAndPopulateForm = async (uri: string) => {
    try {
      setIsParsingPDF(true);

      const parsedData = await parseLabTestFromImage(uri, testType);

      if (Object.keys(parsedData.parameters).length === 0) {
        Alert.alert(
          'No Data Found',
          'Could not extract test parameters from the image. Please try again with a clearer image or enter data manually.',
          [{ text: 'OK' }],
        );
        setIsParsingPDF(false);
        return;
      }

      // Update form with parsed data
      if (parsedData.testDate) {
        const parsedDate = new Date(parsedData.testDate);
        if (!isNaN(parsedDate.getTime())) {
          setDate(parsedDate);
        }
      }

      if (parsedData.parameters) {
        const stringParams: Record<string, string> = {};
        Object.entries(parsedData.parameters).forEach(([key, value]) => {
          const normalizedKey = normalizeParameterKey(key, isSoil);
          stringParams[normalizedKey] = value.toString();
        });
        setParameters(stringParams);
      }

      if (parsedData.recommendations) {
        setRecommendations(parsedData.recommendations);
      }

      if (parsedData.notes) {
        setNotes(parsedData.notes);
      }

      Alert.alert(
        'Success',
        `Successfully extracted ${Object.keys(parsedData.parameters).length} parameters. Please review and save.`,
        [{ text: 'OK' }],
      );
    } catch (parseError) {
      console.error('Parsing error:', parseError);
      Alert.alert(
        'Parsing Failed',
        'Could not extract data from the image. Please try again with a clearer image or enter data manually.',
        [{ text: 'OK' }],
      );
    } finally {
      setIsParsingPDF(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={process.env.EXPO_OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-[#f2f2f7]"
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-4 bg-white/80 border-b border-gray-200 backdrop-blur-lg">
          <TouchableOpacity onPress={onClose}>
            <Text className="text-gray-600 text-base">Cancel</Text>
          </TouchableOpacity>
          <Text className="text-lg font-bold text-[#408059]">
            Add {isSoil ? 'Soil' : 'Petiole'} Test
          </Text>
          <TouchableOpacity onPress={handleSubmit} disabled={isLoading}>
            <Text
              className={`text-base font-semibold ${
                isLoading ? 'text-gray-400' : 'text-[#408059]'
              }`}
            >
              {isLoading ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Hidden WebView for PDF parsing */}
        {showPDFWebView && currentPDFBase64 && (
          <WebView
            ref={webViewRef}
            source={{
              html: `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
              </head>
              <body>
                <script>
                  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                  window.__PDF_BASE64__ = null;

                  async function extractText() {
                    if (!window.__PDF_BASE64__) {
                      window.ReactNativeWebView.postMessage('PDF_PARSE_ERROR');
                      return;
                    }
                    try {
                      const loadingTask = pdfjsLib.getDocument(window.__PDF_BASE64__);
                      const pdf = await loadingTask.promise;
                      let fullText = '';

                      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                        const page = await pdf.getPage(pageNum);
                        const textContent = await page.getTextContent();
                        const pageText = textContent.items.map((item) => item.str).join(' ');
                        fullText += pageText + '\\n';
                      }

                      window.ReactNativeWebView.postMessage('PDF_TEXT:' + fullText);
                    } catch (error) {
                      window.ReactNativeWebView.postMessage('PDF_PARSE_ERROR');
                    }
                  }

                  window.addEventListener('message', (event) => {
                    window.__PDF_BASE64__ = event.data;
                    extractText();
                  });
                </script>
              </body>
              </html>
            `,
            }}
            onMessage={async (event) => {
              if (event.nativeEvent.data === 'PDF_PARSE_ERROR') {
                setShowPDFWebView(false);
                setIsParsingPDF(false);
                Alert.alert(
                  'Error',
                  'Could not parse PDF. Please try converting it to an image or take screenshots.',
                  [{ text: 'OK' }],
                );
              } else if (event.nativeEvent.data.startsWith('PDF_TEXT:')) {
                const text = event.nativeEvent.data.replace('PDF_TEXT:', '');
                setShowPDFWebView(false);

                if (!text || text.trim().length < 50) {
                  setIsParsingPDF(false);
                  Alert.alert(
                    'No Data Found',
                    'Could not extract sufficient text from the PDF. Please try a different file.',
                    [{ text: 'OK' }],
                  );
                  return;
                }

                try {
                  const parsedData = await parseLabTestFromText(text, testType);

                  if (Object.keys(parsedData.parameters).length === 0) {
                    Alert.alert(
                      'No Data Found',
                      'Could not extract test parameters from the PDF.',
                      [{ text: 'OK' }],
                    );
                    setIsParsingPDF(false);
                    return;
                  }

                  if (parsedData.testDate) {
                    const parsedDate = new Date(parsedData.testDate);
                    if (!isNaN(parsedDate.getTime())) {
                      setDate(parsedDate);
                    }
                  }

                  if (parsedData.parameters) {
                    const stringParams: Record<string, string> = {};
                    Object.entries(parsedData.parameters).forEach(([key, value]) => {
                      const normalizedKey = normalizeParameterKey(key, isSoil);
                      stringParams[normalizedKey] = value.toString();
                    });
                    setParameters(stringParams);
                  }

                  if (parsedData.recommendations) {
                    setRecommendations(parsedData.recommendations);
                  }

                  if (parsedData.notes) {
                    setNotes(parsedData.notes);
                  }

                  Alert.alert(
                    'Success',
                    `Successfully extracted ${Object.keys(parsedData.parameters).length} parameters. Please review and save.`,
                    [{ text: 'OK' }],
                  );
                } catch (error) {
                  console.error('Parsing error:', error);
                  Alert.alert(
                    'Parsing Failed',
                    'Could not parse extracted text. Please try a different file.',
                    [{ text: 'OK' }],
                  );
                }
                setIsParsingPDF(false);
              }
            }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            style={{ display: 'none' }}
          />
        )}

        <ScrollView className="flex-1 px-4" showsVerticalScrollIndicator={false}>
          {/* Upload Button */}
          <TouchableOpacity
            onPress={handleUploadFile}
            disabled={isParsingPDF || isLoading}
            className="bg-white rounded-xl p-4 mt-4 shadow-sm border-2 border-dashed border-[#408059] border-opacity-30"
          >
            {isParsingPDF ? (
              <View className="flex-row items-center justify-center">
                <ActivityIndicator color="#408059" size="small" />
                <Text className="text-base font-medium text-[#408059] ml-2">
                  Parsing with AI...
                </Text>
              </View>
            ) : (
              <View className="flex-row items-center justify-center">
                <Symbol name="document" size={24} color="#408059" />
                <Text className="text-base font-medium text-[#408059] ml-2">
                  Upload Lab Report (Photo, Image, or PDF)
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Date Picker */}
          <View className="bg-white rounded-xl p-4 mt-4 shadow-sm">
            <Text className="text-sm font-medium text-gray-500 mb-2">Test Date</Text>
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              className="flex-row items-center justify-between bg-[#f2f2f7] p-3 rounded-lg"
            >
              <View className="flex-row items-center">
                <Symbol name="calendar" size={20} color="#666" />
                <Text className="text-base text-gray-800 ml-2">{date.toLocaleDateString()}</Text>
              </View>
              <Symbol name="chevron.down" size={20} color="#666" />
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={date}
                mode="date"
                display={process.env.EXPO_OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleDateChange}
                maximumDate={new Date()}
              />
            )}
          </View>

          {/* Parameters */}
          <View className="bg-white rounded-xl p-4 mt-4 shadow-sm">
            <Text className="text-sm font-medium text-gray-500 mb-3">Test Parameters</Text>
            <Text className="text-xs text-gray-400 mb-4">
              Enter values for the parameters you have. Leave empty for unknown values.
            </Text>

            <View className="flex-row flex-wrap gap-3">
              {parameterList.map((param) => (
                <View key={param.key} className="w-[48%]">
                  <Text className="text-xs text-gray-500 mb-1">
                    {param.label} {param.unit && `(${param.unit})`}
                  </Text>
                  <TextInput
                    className="bg-[#f2f2f7] border border-gray-200 rounded-lg px-3 py-2 text-gray-800"
                    placeholder="0.00"
                    placeholderTextColor="#9ca3af"
                    keyboardType="decimal-pad"
                    value={parameters[param.key] || ''}
                    onChangeText={(value) => updateParameter(param.key, value)}
                  />
                </View>
              ))}
            </View>
          </View>

          {/* Recommendations */}
          <View className="bg-white rounded-xl p-4 mt-4 shadow-sm">
            <Text className="text-sm font-medium text-gray-500 mb-2">
              Recommendations (Optional)
            </Text>
            <TextInput
              className="bg-[#f2f2f7] border border-gray-200 rounded-lg px-3 py-3 text-gray-800 min-h-[80px]"
              placeholder="Enter lab recommendations..."
              placeholderTextColor="#9ca3af"
              multiline
              textAlignVertical="top"
              value={recommendations}
              onChangeText={setRecommendations}
            />
          </View>

          {/* Notes */}
          <View className="bg-white rounded-xl p-4 mt-4 mb-8 shadow-sm">
            <Text className="text-sm font-medium text-gray-500 mb-2">Notes (Optional)</Text>
            <TextInput
              className="bg-[#f2f2f7] border border-gray-200 rounded-lg px-3 py-3 text-gray-800 min-h-[60px]"
              placeholder="Add any additional notes..."
              placeholderTextColor="#9ca3af"
              multiline
              textAlignVertical="top"
              value={notes}
              onChangeText={setNotes}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
